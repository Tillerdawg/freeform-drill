// The service's front door (src/index.ts), run against a stand-in for Cloudflare: who may publish, update, or remove a
// show, and what anyone else gets. The rules it leans on (shows.ts, feedback.ts) have their own tests.
import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:email', () => ({ EmailMessage: class { constructor(public from: string, public to: string, public raw: string) {} } }));
const { default: worker } = await import('./src/index');

const SITE = 'https://freeformdrill.org';
const locked = (data = 'QUJD') => JSON.stringify({ format: 'freeform-locked', version: 1, iv: 'abc_-1', data });

function fakeEnv(opts: { limited?: boolean; full?: boolean } = {}) {
  const kv = new Map<string, { value: string; metadata?: unknown }>();
  const sent: unknown[] = [];
  const env = {
    SHOWS: {
      get: async (k: string) => kv.get(k)?.value ?? null,
      getWithMetadata: async (k: string) => ({ value: kv.get(k)?.value ?? null, metadata: kv.get(k)?.metadata ?? null }),
      put: async (k: string, value: string, o?: { metadata?: unknown }) => { if (opts.full && k.startsWith('show:')) throw new Error('KV full'); kv.set(k, { value, metadata: o?.metadata }); },
      delete: async (k: string) => { kv.delete(k); },
      list: async ({ prefix }: { prefix: string }) => ({ keys: [...kv].filter(([k]) => k.startsWith(prefix)).map(([name, v]) => ({ name, metadata: v.metadata })), list_complete: true }),
    },
    LIMITER: { limit: async () => ({ success: !opts.limited }) },
    UPLOADS: { limit: async () => ({ success: !opts.limited }) },
    EMAIL: { send: async (m: unknown) => { sent.push(m); } },
    FEEDBACK_TO: 'jason@example.com',
  };
  return { env, kv, sent };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (env: any, path: string, init: RequestInit & { origin?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('Origin', init.origin ?? SITE);
  return worker.fetch(new Request('https://api.freeformdrill.org' + path, { ...init, headers }), env);
};
const publish = async (env: unknown) => (await call(env, '/shows', { method: 'POST', body: locked() })).json() as Promise<{ id: string; token: string; url: string }>;

describe('published shows', () => {
  it('publishes a locked show and gives back its address and an edit token, keeping only the token’s hash', async () => {
    const { env, kv } = fakeEnv();
    const r = await call(env, '/shows', { method: 'POST', body: locked() });
    expect(r.status).toBe(201);
    const j = await r.json() as { id: string; token: string; url: string };
    expect(j.url).toBe(`https://api.freeformdrill.org/shows/${j.id}`);
    const stored = kv.get(`show:${j.id}`)!;
    expect(stored.value).toBe(locked());
    expect(JSON.stringify(stored.metadata)).not.toContain(j.token);
  });

  it('lets any phone download it, from any page, and notes when it was opened', async () => {
    const { env, kv } = fakeEnv();
    const { id } = await publish(env);
    const r = await call(env, `/shows/${id}`, { origin: null });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await r.text()).toBe(locked());
    expect(kv.has(`seen:${id}`)).toBe(true);
    const again = await call(env, `/shows/${id}`, { origin: null, headers: { 'If-None-Match': r.headers.get('ETag')! } });
    expect(again.status).toBe(304);
  });

  it('updates and removes a show only with its token', async () => {
    const { env, kv } = fakeEnv();
    const { id, token } = await publish(env);
    expect((await call(env, `/shows/${id}`, { method: 'PUT', body: locked('WFla') })).status).toBe(403);
    expect((await call(env, `/shows/${id}`, { method: 'PUT', body: locked('WFla'), headers: { Authorization: 'Bearer wrong' } })).status).toBe(403);
    expect((await call(env, `/shows/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } })).status).toBe(403);
    expect(kv.get(`show:${id}`)!.value).toBe(locked());
    expect((await call(env, `/shows/${id}`, { method: 'PUT', body: locked('WFla'), headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect(kv.get(`show:${id}`)!.value).toBe(locked('WFla'));
    expect((await call(env, `/shows/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status).toBe(204);
    expect(kv.has(`show:${id}`)).toBe(false);
    expect((await call(env, `/shows/${id}`, { origin: null })).status).toBe(404);
  });

  it('won’t let a token for one show change another', async () => {
    const { env } = fakeEnv();
    const a = await publish(env), b = await publish(env);
    expect((await call(env, `/shows/${b.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } })).status).toBe(403);
  });

  it('turns away publishing from other sites, files that aren’t locked shows, a chosen id, and too many at once', async () => {
    const { env } = fakeEnv();
    expect((await call(env, '/shows', { method: 'POST', body: locked(), origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(env, '/shows', { method: 'POST', body: locked(), origin: null })).status).toBe(403);
    expect((await call(env, '/shows', { method: 'POST', body: '{"format":"freeform-show"}' })).status).toBe(400);
    expect((await call(env, '/shows/AAAAAAAAAAAAAAAAAAAAAA', { method: 'POST', body: locked() })).status).toBe(405);
    expect((await call(fakeEnv({ limited: true }).env, '/shows', { method: 'POST', body: locked() })).status).toBe(429);
    expect((await call(env, '/shows', { method: 'POST', body: locked(), headers: { 'Content-Length': String(30 * 1024 * 1024) } })).status).toBe(413);
  });

  it('says plainly when the service is out of room, instead of “try later today”', async () => {
    const r = await call(fakeEnv({ full: true }).env, '/shows', { method: 'POST', body: locked() });
    expect(r.status).toBe(503);
    expect((await r.json() as { error: string }).error).toMatch(/out of room/);
  });

  it('gives 404 for ids that aren’t ids, and for other paths', async () => {
    const { env } = fakeEnv();
    expect((await call(env, '/shows/../../etc', { origin: null })).status).toBe(404);
    expect((await call(env, '/shows/short', { origin: null })).status).toBe(404);
    expect((await call(env, '/admin')).status).toBe(404);
  });

  it('the daily cleanup removes shows unused for six months and keeps the rest', async () => {
    const { env, kv } = fakeEnv();
    const old = await publish(env), fresh = await publish(env);
    const meta = kv.get(`show:${old.id}`)!.metadata as { updated: number };
    meta.updated = Date.now() - 200 * 86_400_000;
    await worker.scheduled(undefined, env as never);
    expect(kv.has(`show:${old.id}`)).toBe(false);
    expect(kv.has(`show:${fresh.id}`)).toBe(true);
  });
});

describe('feedback', () => {
  it('emails Jason a message from the site, and nothing from elsewhere', async () => {
    const { env, sent } = fakeEnv();
    const body = JSON.stringify({ message: 'The print view cut off set 12', kind: 'problem' });
    expect((await call(env, '/feedback', { method: 'POST', body })).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect((await call(env, '/feedback', { method: 'POST', body, origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(env, '/feedback', { method: 'GET' })).status).toBe(405);
    expect(sent).toHaveLength(1);
  });

  it('pretends to accept a bot’s message (the hidden field is filled) but sends nothing', async () => {
    const { env, sent } = fakeEnv();
    expect((await call(env, '/feedback', { method: 'POST', body: JSON.stringify({ message: 'hi', website: 'spam.example' }) })).status).toBe(200);
    expect(sent).toHaveLength(0);
  });
});
