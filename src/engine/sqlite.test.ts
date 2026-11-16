import { describe, expect, it } from 'vitest';
import { columnsOf, openDatabase } from './sqlite';
import { makeDatabase } from './sqliteFixture';

describe('sqlite reader', () => {
  it('reads every column type, in rowid order, with the INTEGER PRIMARY KEY as the rowid', async () => {
    const bytes = await makeDatabase((run) => {
      run('CREATE TABLE "things" (id integer PRIMARY KEY NOT NULL, name text, n integer, big integer, x real, data blob, CHECK (n >= -1000000))');
      run('INSERT INTO things (id, name, n, big, x, data) VALUES (?, ?, ?, ?, ?, ?)', 7, 'Trumpet', -3, 2 ** 40 + 5, 1.25, new Uint8Array([1, 2, 3]));
      run('INSERT INTO things (id, name, n, big, x, data) VALUES (?, ?, ?, ?, ?, ?)', 2, 'Café ♪', 0, -(2 ** 33), -0.5, null);
      run('INSERT INTO things (id, name, n) VALUES (?, ?, ?)', 3, null, 1);
    });
    const db = openDatabase(bytes);
    expect(db.tables).toContain('things');
    const rows = db.rows('things');
    expect(rows.map((r) => r.id)).toEqual([2, 3, 7]);
    expect(rows[0]).toMatchObject({ name: 'Café ♪', n: 0, big: -(2 ** 33), x: -0.5, data: null });
    expect(rows[1]).toMatchObject({ name: null, n: 1 });
    expect(rows[2]).toMatchObject({ name: 'Trumpet', n: -3, big: 2 ** 40 + 5, x: 1.25 });
    expect([...(rows[2].data as Uint8Array)]).toEqual([1, 2, 3]);
    expect(db.rows('missing')).toEqual([]);
  });

  it('follows interior pages and overflow pages (many rows, and a blob bigger than a page)', async () => {
    const big = new Uint8Array(20_000).map((_, i) => (i * 31) % 251);
    const bytes = await makeDatabase((run) => {
      run('CREATE TABLE rows (id integer PRIMARY KEY, label text, blob blob)');
      for (let i = 1; i <= 3000; i++) run('INSERT INTO rows (id, label) VALUES (?, ?)', i, `row ${i} ${'x'.repeat(i % 50)}`);
      run('INSERT INTO rows (id, label, blob) VALUES (?, ?, ?)', 5000, 'audio', big);
    }, 1024);
    const rows = openDatabase(bytes).rows('rows');
    expect(rows).toHaveLength(3001);
    expect(rows[2999].label).toBe(`row 3000 ${'x'.repeat(0)}`);
    expect([...(rows[3000].blob as Uint8Array)]).toEqual([...big]);
  });

  it('gives columns added later as null in older rows', async () => {
    const bytes = await makeDatabase((run) => {
      run('CREATE TABLE t (id integer PRIMARY KEY, a text)');
      run("INSERT INTO t (a) VALUES ('old')");
      run('ALTER TABLE t ADD COLUMN b real DEFAULT 0');
    });
    expect(openDatabase(bytes).rows('t')[0]).toEqual({ id: 1, a: 'old', b: null });
  });

  it('turns away files that are not databases, and damaged ones, with a plain message', async () => {
    expect(() => openDatabase(new TextEncoder().encode('{"format":"freeform-show"}'))).toThrow(/isn't an SQLite database/);
    const bytes = await makeDatabase((run) => { run('CREATE TABLE t (id integer PRIMARY KEY, a text)'); run("INSERT INTO t (a) VALUES ('x')"); });
    expect(() => openDatabase(bytes.slice(0, 1500))).toThrow(/damaged/);
  });

  it('reads column names from CREATE TABLE, skipping table constraints', () => {
    expect(columnsOf('CREATE TABLE `marchers` (\n`id` integer PRIMARY KEY NOT NULL,\n`name` text,\n`drill_order` integer NOT NULL, CONSTRAINT "c" CHECK(drill_order > 0), UNIQUE(`name`, `drill_order`))'))
      .toEqual({ cols: ['id', 'name', 'drill_order'], rowidCol: 'id' });
    expect(columnsOf('CREATE TABLE x ("a b" text DEFAULT \'(, )\', c NUMERIC(10, 2), PRIMARY KEY (c))')).toEqual({ cols: ['a b', 'c'], rowidCol: undefined });
  });
});
