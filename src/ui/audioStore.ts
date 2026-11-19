// This browser's IndexedDB: the shows' recordings and tracing pictures ('audio', keyed by the id the show keeps), the
// show library ('shows', keyed by show id), and earlier versions ('versions', keyed by [show id, time]). Audio is too big
// for localStorage, and several shows with their versions would be too.

const DB = 'freeform';
export type Store = 'audio' | 'shows' | 'versions';

function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => { for (const s of ['audio', 'shows', 'versions']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); }; // let a newer version of the app upgrade it
    r.onerror = () => fail(r.error);
  });
}

/**
 * One request in its own transaction. It resolves only once the transaction has committed: a request can succeed and
 * its transaction still abort afterward (a full disk often shows up that way), and then nothing was written.
 */
export async function run<T>(store: Store, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>, open: () => Promise<IDBDatabase> = db): Promise<T> {
  const d = await open();
  return new Promise((ok, fail) => {
    const tx = d.transaction(store, mode);
    const req = f(tx.objectStore(store));
    tx.oncomplete = () => ok(req.result);
    tx.onabort = tx.onerror = () => fail(tx.error ?? req.error ?? new Error('This browser refused to save.'));
  });
}

export const putAudio = (id: string, file: Blob) => run('audio', 'readwrite', (s) => s.put(file, id)).then(() => true, () => false);
export const getAudio = (id: string) => run<Blob | undefined>('audio', 'readonly', (s) => s.get(id)).catch(() => undefined);
export const deleteAudio = (id: string) => run('audio', 'readwrite', (s) => s.delete(id)).catch(() => undefined);
