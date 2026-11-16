// The show library and version history, in this browser's IndexedDB (see audioStore). The open show is also in
// localStorage (App's AUTOSAVE), written on every change; this copy follows a moment later.
import { parseShow, type Show } from '../engine/show';
import { versionDue, versionsToDrop } from '../engine/versions';
import { deleteAudio, run } from './audioStore';

/** The open show, in localStorage. Here, not in App, so the phone's performer view can read it without loading the editor. */
export const AUTOSAVE = 'freeform:autosave';
/** The open show's id, so a reload can find it in the library when it was too big for localStorage. */
export const AUTOSAVE_ID = 'freeform:autosave-id';

/**
 * Write the open show to localStorage, what a reload opens. Browsers give localStorage about 5 MB; a big show (a large
 * band with many curved moves) can pass that. Then the old copy comes out, so a reload can't open a stale show, and
 * AUTOSAVE_ID points the reload at the library copy instead. True when the whole show was written.
 */
export function writeAutosave(show: Show, store: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): boolean {
  let ok = true;
  try { store.setItem(AUTOSAVE, JSON.stringify(show)); } catch {
    ok = false;
    try { store.removeItem(AUTOSAVE); } catch { /* storage blocked */ }
  }
  try { if (show.id) store.setItem(AUTOSAVE_ID, show.id); } catch { /* storage blocked: the full copy, if written, is enough */ }
  return ok;
}

/** What a reload opens: the autosaved text, or the id of the library copy to open (the show was too big), or nothing. */
export function readAutosave(store: Pick<Storage, 'getItem'> = localStorage): { raw: string } | { id: string } | null {
  try {
    const raw = store.getItem(AUTOSAVE);
    if (raw) return { raw };
    const id = store.getItem(AUTOSAVE_ID);
    return id ? { id } : null;
  } catch { return null; }
}

/** A kept show or version: the show as text, and enough to list it without reading it. */
export interface Entry { json: string; title: string; at: number; performers: number; sets: number }
export type Listed = Omit<Entry, 'json'> & { id: string };

const entry = (show: Show, at: number, json = JSON.stringify(show)): Entry => ({ json, title: show.title, at, performers: show.performers.length, sets: show.sets.length });
const range = (id: string) => IDBKeyRange.bound([id, 0], [id, Infinity]);
const versionTimes = (id: string) => run<IDBValidKey[]>('versions', 'readonly', (s) => s.getAllKeys(range(id))).then((ks) => ks.map((k) => (k as [string, number])[1]));

async function pruneVersions(id: string, times: number[], now: number) {
  for (const t of versionsToDrop(times, now)) await run('versions', 'readwrite', (s) => s.delete([id, t]));
}

/**
 * Keep the show (it must have an id) in the library. Before writing over the copy already kept, that copy becomes a
 * version if the last version is VERSION_EVERY older. False if the browser refused.
 */
export async function keepShow(show: Show, now = Date.now()): Promise<boolean> {
  try {
    const id = show.id!, json = JSON.stringify(show);
    const old = await run<Entry | undefined>('shows', 'readonly', (s) => s.get(id));
    if (old?.json === json) return true;
    if (old) {
      const times = await versionTimes(id);
      if (versionDue(old.at, times.length ? Math.max(...times) : undefined)) {
        await run('versions', 'readwrite', (s) => s.put(old, [id, old.at]));
        await pruneVersions(id, [...times, old.at], now);
      }
    }
    await run('shows', 'readwrite', (s) => s.put(entry(show, now, json), id));
    return true;
  } catch { return false; }
}

/** Keep the show as it is now as a version, whenever it was last kept (before a version is restored over it). */
export async function addVersion(show: Show, now = Date.now()): Promise<boolean> {
  try {
    const id = show.id!;
    await run('versions', 'readwrite', (s) => s.put(entry(show, now), [id, now]));
    await pruneVersions(id, await versionTimes(id), now);
    return true;
  } catch { return false; }
}

/** The library, most recently changed first. */
export async function listShows(): Promise<Listed[]> {
  const [keys, vals] = await Promise.all([run<IDBValidKey[]>('shows', 'readonly', (s) => s.getAllKeys()), run<Entry[]>('shows', 'readonly', (s) => s.getAll())]);
  return vals.map(({ json: _, ...e }, i) => ({ ...e, id: String(keys[i]) })).sort((a, b) => b.at - a.at);
}

/** A kept show, read like a file (throws if it no longer reads). */
export async function loadShow(id: string): Promise<Show> {
  const e = await run<Entry | undefined>('shows', 'readonly', (s) => s.get(id));
  if (!e) throw new Error('That show is no longer in this browser.');
  return { ...parseShow(e.json), id };
}

/** A show's versions, newest first. */
export async function listVersions(id: string): Promise<Entry[]> {
  const vals = await run<Entry[]>('versions', 'readonly', (s) => s.getAll(range(id)));
  return vals.sort((a, b) => b.at - a.at);
}

/**
 * The recording and picture ids a kept show's text points at, read without checking the rest of the show: a show that
 * no longer opens must still count, or forgetting another show could delete a recording it uses. Null if the text
 * isn't JSON at all (then nothing is safe to delete).
 */
export function filesUsed(json: string): string[] | null {
  try {
    const s = JSON.parse(json);
    return [s?.music?.audioId, s?.trace?.id].filter((x): x is string => typeof x === 'string');
  } catch { return null; }
}

/** Take a show and its versions out of the library, and its recording and picture unless another kept show uses them. */
export async function forgetShow(id: string): Promise<void> {
  const gone = await run<Entry | undefined>('shows', 'readonly', (s) => s.get(id));
  await run('shows', 'readwrite', (s) => s.delete(id));
  await run('versions', 'readwrite', (s) => s.delete(range(id)));
  const mine = gone ? filesUsed(gone.json) : null;
  if (!mine?.length) return;
  const others = (await run<Entry[]>('shows', 'readonly', (s) => s.getAll())).map((e) => filesUsed(e.json));
  if (others.includes(null)) return; // a kept show we can't read at all: keep every file rather than guess
  for (const blob of mine) if (!others.some((o) => o!.includes(blob))) await deleteAudio(blob);
}
