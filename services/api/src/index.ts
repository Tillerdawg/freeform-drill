// FreeFORM's small web service (api.freeformdrill.org), on Cloudflare Workers. Two jobs:
//  - /feedback: the feedback form, emailed through Resend to feedback@freeformdrill.org (which Email Routing forwards to
//    Jason), with a short "we got it" note back to the sender. If Resend can't take it, Email Routing's own sending is the
//    fallback (to FEEDBACK_TO, a Cloudflare secret).
//  - /shows: Publish to phones. A director's browser uploads a show file it has already encrypted (the key is only in the
//    link it gives performers), and phones download it. The service stores only the encrypted file: it can't read it.
// Guardrails: only the site may send (CORS and Origin), per-visitor limits a minute, size caps, only locked show files,
// an edit token (hashed) to update or remove a show, and a daily cleanup of shows unused for six months.
import { EmailMessage } from 'cloudflare:email';
import { ackEmail, checkFeedback, feedbackEmail, mimeMessage, ORIGINS } from './feedback';
import { checkLocked, day, hashToken, ID_RE, MAX_BYTES, newId, newToken, sameHash, seenDue, stale } from './shows';

interface Limiter { limit(o: { key: string }): Promise<{ success: boolean }> }
interface KV {
  get(key: string, opts?: { cacheTtl?: number }): Promise<string | null>;
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>;
  put(key: string, value: string, opts?: { metadata?: unknown; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list<M>(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string; metadata?: M }[]; list_complete: boolean; cursor?: string }>;
}
interface Env {
  EMAIL: { send(m: EmailMessage): Promise<void> };
  LIMITER: Limiter; // feedback: 3 a minute per visitor
  UPLOADS: Limiter; // publishing: 6 a minute per visitor
  SHOWS: KV;
  FEEDBACK_TO: string;
  RESEND_API_KEY?: string; // a sending-only Resend key for freeformdrill.org; without it, feedback goes the old way and nobody gets a note back
}

const INBOX = 'feedback@freeformdrill.org';
/** Send one email through Resend. The idempotency key means a retry can never send it twice. */
async function resend(key: string, idem: string, email: Record<string, unknown>): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem }, body: JSON.stringify(email),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
const sha256 = async (t: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
interface Meta { hash: string; updated: number; size: number }

const SITE_ONLY = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' });
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const showUrl = (req: Request, id: string) => `https://${new URL(req.url).host}/shows/${id}`; // phones need https

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url), origin = req.headers.get('Origin') ?? '', ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
    const m = url.pathname.match(/^\/shows(?:\/([^/]+))?$/);

    // Phones download a show: anyone with the link may (the file is encrypted), from any page. Unchanged files aren't re-sent.
    if (m && m[1] && req.method === 'GET') {
      const id = m[1];
      const open = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };
      if (!ID_RE.test(id)) return new Response('Not found', { status: 404, headers: open });
      const { value, metadata } = await env.SHOWS.getWithMetadata<Meta>(`show:${id}`);
      if (value === null || !metadata) return new Response('This show isn’t online anymore.', { status: 404, headers: open });
      const etag = `"${metadata.updated}-${metadata.size}"`;
      // When it was last opened, at most once a week, so the cleanup knows it's still in use.
      const now = Date.now();
      if (seenDue(now, await env.SHOWS.get(`seen:${id}`, { cacheTtl: 3600 }))) await env.SHOWS.put(`seen:${id}`, day(now)).catch(() => {});
      if (req.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ...open, ETag: etag } });
      return new Response(value, { headers: { ...open, ETag: etag, 'Content-Type': 'application/json' } });
    }

    if (url.pathname !== '/feedback' && !m) return new Response('Not found', { status: 404 });
    if (!ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    const cors = SITE_ONLY(origin);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (m) return shows(req, env, m[1], ip, cors);

    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);
    if (!(await env.LIMITER.limit({ key: ip })).success) return json({ error: 'Too many messages at once. Please wait a minute and try again.' }, 429, cors);
    const raw = await req.text();
    if (raw.length > 20_000) return json({ error: 'That is too long.' }, 413, cors);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Nothing was sent.' }, 400, cors); }
    const r = checkFeedback(body);
    if (!r.ok) return r.quiet ? json({ ok: true }, 200, cors) : json({ error: r.error }, 400, cors);
    const { subject, text } = feedbackEmail(r.feedback), id = crypto.randomUUID(), replyTo = r.feedback.email || undefined;
    // To Jason: through Resend, from form@ and to feedback@, so it arrives the way any other mail to feedback@ does
    // (Gmail then answers from feedback@ on its own). If Resend can't take it, Email Routing's free sending to FEEDBACK_TO.
    let sent = false;
    if (env.RESEND_API_KEY) {
      try {
        await resend(env.RESEND_API_KEY, `fb-${id}`, { from: 'FreeFORM Drill feedback form <form@freeformdrill.org>', to: [INBOX], ...(replyTo ? { reply_to: replyTo } : {}), subject, text });
        sent = true;
      } catch (e) { console.error('resend failed, trying Email Routing', (e as Error).message); }
    }
    if (!sent) {
      try {
        const from = INBOX;
        const msg = mimeMessage({ from, fromName: 'FreeFORM Drill feedback', to: env.FEEDBACK_TO, replyTo, subject, text, id, date: new Date() });
        await env.EMAIL.send(new EmailMessage(from, env.FEEDBACK_TO, msg));
      } catch (e) {
        console.error('send failed', (e as { code?: string }).code, (e as Error).message);
        return json({ error: "The message couldn't be sent right now. Please try again later." }, 502, cors);
      }
    }
    // Back to the sender: one note a day per address at most, so the form can't be used to flood someone's inbox. Only a
    // hash of the address is kept, for that day. A failed note never fails the message itself.
    if (replyTo && env.RESEND_API_KEY) {
      try {
        const key = `ack:${await sha256(replyTo.toLowerCase())}`;
        if (!(await env.SHOWS.get(key))) {
          await env.SHOWS.put(key, '1', { expirationTtl: 86_400 });
          await resend(env.RESEND_API_KEY, `ack-${id}`, { from: `FreeFORM Drill <${INBOX}>`, to: [replyTo], ...ackEmail(r.feedback.lang) });
        }
      } catch (e) { console.error('note back failed', (e as Error).message); }
    }
    return json({ ok: true }, 200, cors);
  },

  // Daily: delete shows nobody has opened or updated for six months (and their "last opened" notes).
  async scheduled(_: unknown, env: Env): Promise<void> {
    const now = Date.now();
    let cursor: string | undefined;
    do {
      const page = await env.SHOWS.list<Meta>({ prefix: 'show:', cursor });
      for (const k of page.keys) {
        const id = k.name.slice(5), seen = await env.SHOWS.get(`seen:${id}`);
        if (k.metadata && stale(now, k.metadata.updated, seen ? Date.parse(seen) : undefined)) {
          await env.SHOWS.delete(k.name); await env.SHOWS.delete(`seen:${id}`);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  },
};

/** Publish (POST), update (PUT), or remove (DELETE) a show. Updates and removals need the token the first publish returned. */
async function shows(req: Request, env: Env, id: string | undefined, ip: string, cors: Record<string, string>): Promise<Response> {
  if (!(await env.UPLOADS.limit({ key: ip })).success) return json({ error: 'Too many publishes at once. Please wait a minute and try again.' }, 429, cors);
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const owned = async (): Promise<Meta | Response> => {
    if (!id || !ID_RE.test(id)) return json({ error: 'Not found.' }, 404, cors);
    const { metadata } = await env.SHOWS.getWithMetadata<Meta>(`show:${id}`);
    if (!metadata) return json({ error: 'This show isn’t online anymore.' }, 404, cors);
    if (!auth || !sameHash(await hashToken(auth), metadata.hash)) return json({ error: 'This browser can’t change that show.' }, 403, cors);
    return metadata;
  };
  if (req.method === 'DELETE') {
    const o = await owned(); if (o instanceof Response) return o;
    await env.SHOWS.delete(`show:${id}`); await env.SHOWS.delete(`seen:${id}`);
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST' && req.method !== 'PUT') return json({ error: 'Not allowed.' }, 405, cors);
  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES) return json({ error: 'That show is too big to publish (the limit is 24 MB). Try it without the music.' }, 413, cors);
  const text = await req.text();
  const bad = checkLocked(text);
  if (bad) return json({ error: bad }, text.length > MAX_BYTES ? 413 : 400, cors);
  let showId = id, token: string | undefined, hash: string;
  if (req.method === 'PUT') {
    const o = await owned(); if (o instanceof Response) return o;
    hash = o.hash;
  } else {
    if (id) return json({ error: 'Not allowed.' }, 405, cors);
    showId = newId(); token = newToken(); hash = await hashToken(token);
  }
  try {
    await env.SHOWS.put(`show:${showId}`, text, { metadata: { hash, updated: Date.now(), size: text.length } satisfies Meta });
  } catch (e) {
    console.error('store failed', (e as Error).message);
    return json({ error: 'FreeFORM’s service couldn’t store the show. It may be out of room, or past the number of saves it allows in a day. Try again tomorrow, or share it with a link or a file for now.' }, 503, cors);
  }
  return json({ id: showId, url: showUrl(req, showId!), ...(token ? { token } : {}) }, req.method === 'POST' ? 201 : 200, cors);
}
