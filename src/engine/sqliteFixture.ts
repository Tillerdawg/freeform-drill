// For tests only: build a real SQLite database file with Node's own SQLite (node:sqlite, Node 22.5+) and return its
// bytes, so the reader in sqlite.ts is checked against SQLite itself. The app never imports this.
const load = (name: string) => import(/* @vite-ignore */ name) as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Run `build` against a fresh database file, then return the file's bytes. `pageSize` exercises small pages and overflow. */
export async function makeDatabase(build: (exec: (sql: string, ...params: unknown[]) => void) => void, pageSize = 4096): Promise<Uint8Array> {
  const [{ DatabaseSync }, fs, os, path] = await Promise.all([load('node:sqlite'), load('node:fs'), load('node:os'), load('node:path')]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeform-db-')), file = path.join(dir, 'test.db');
  try {
    const db = new DatabaseSync(file);
    db.exec(`PRAGMA page_size = ${pageSize}; PRAGMA journal_mode = DELETE;`);
    // One transaction: thousands of rows saved one by one take seconds (each waits for the disk); together, milliseconds.
    db.exec('BEGIN');
    build((sql, ...params) => { if (params.length) db.prepare(sql).run(...params); else db.exec(sql); });
    db.exec('COMMIT');
    db.close();
    return new Uint8Array(fs.readFileSync(file));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
