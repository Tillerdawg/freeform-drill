// A small read-only SQLite reader, written from SQLite's published file format (sqlite.org/fileformat2.html), for
// importing other programs' show files (OpenMarch's .dots files are SQLite databases). It reads whole tables, rows in
// rowid order, with column names from each table's CREATE TABLE. No writing, indexes, or WAL: a file saved and closed
// by its program has everything in the main file. Untrusted input: every offset is checked, and loops are bounded.

export type Value = number | string | Uint8Array | null;
export type Row = Record<string, Value>;

const fail = (msg = "That file isn't a database FreeFORM can read (it may be damaged)."): never => { throw new Error(msg); };

export interface Database {
  /** Table names, as the file lists them. */
  tables: string[];
  /** Every row of a table, as column name → value (an INTEGER PRIMARY KEY column holds the rowid). Missing table: []. */
  rows(table: string): Row[];
}

export function openDatabase(data: ArrayBuffer | Uint8Array): Database {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const head = 'SQLite format 3\0';
  if (b.length < 100 || [...head].some((c, i) => b[i] !== c.charCodeAt(0))) fail("That file isn't an SQLite database.");
  const raw = v.getUint16(16), pageSize = raw === 1 ? 65536 : raw;
  if (pageSize < 512 || pageSize & (pageSize - 1)) fail();
  const usable = pageSize - b[20];
  if (usable < 480) fail();
  const pages = Math.floor(b.length / pageSize);
  const encoding = v.getUint32(56) || 1; // 1 UTF-8, 2 UTF-16le, 3 UTF-16be
  const decoder = new TextDecoder(encoding === 2 ? 'utf-16le' : encoding === 3 ? 'utf-16be' : 'utf-8');

  const pageAt = (n: number) => { if (n < 1 || n > pages) fail(); return (n - 1) * pageSize; };

  const varint = (o: number) => varintIn(b, o);

  /** A cell's whole payload, following overflow pages (table leaf cells). */
  const payload = (o: number, size: number): Uint8Array => {
    const X = usable - 35;
    if (size <= X) { if (o + size > b.length) fail(); return b.subarray(o, o + size); }
    const M = Math.floor(((usable - 12) * 32) / 255) - 23, K = M + ((size - M) % (usable - 4));
    const local = K <= X ? K : M;
    const out = new Uint8Array(size);
    if (o + local + 4 > b.length) fail();
    out.set(b.subarray(o, o + local));
    let got = local, next = v.getUint32(o + local), guard = 0;
    while (got < size) {
      if (!next || ++guard > pages) fail();
      const at = pageAt(next), n = Math.min(usable - 4, size - got);
      out.set(b.subarray(at + 4, at + 4 + n), got);
      got += n; next = v.getUint32(at);
    }
    return out;
  };

  /** A record's values, in column order. */
  const record = (p: Uint8Array): Value[] => {
    const pv = new DataView(p.buffer, p.byteOffset, p.byteLength);
    const [hsize, hl] = varintIn(p, 0);
    if (hsize > p.length) fail();
    const types: number[] = [];
    for (let o = hl; o < hsize;) { const [t, n] = varintIn(p, o); types.push(t); o += n; }
    const out: Value[] = [];
    let o = hsize;
    const need = (n: number) => { if (o + n > p.length) fail(); };
    for (const t of types) {
      if (t === 0) out.push(null);
      else if (t >= 1 && t <= 6) {
        const n = [0, 1, 2, 3, 4, 6, 8][t]; need(n);
        out.push(int(p, o, n)); o += n;
      } else if (t === 7) { need(8); out.push(pv.getFloat64(o)); o += 8; }
      else if (t === 8) out.push(0);
      else if (t === 9) out.push(1);
      else if (t >= 12) {
        const n = Math.floor((t - 12) / 2); need(n);
        out.push(t % 2 ? decoder.decode(p.subarray(o, o + n)) : p.slice(o, o + n)); o += n;
      } else fail();
    }
    return out;
  };

  /** Every row of the table whose b-tree starts at `root`: [rowid, values][] in rowid order. */
  const walk = (root: number): [number, Value[]][] => {
    const out: [number, Value[]][] = [], seen = new Set<number>();
    const visit = (n: number) => {
      if (seen.has(n)) fail(); // a loop in a damaged file
      seen.add(n);
      const base = pageAt(n), h = base + (n === 1 ? 100 : 0), kind = b[h];
      const cells = v.getUint16(h + 3);
      if (kind === 0x0d) { // table leaf
        for (let i = 0; i < cells; i++) {
          let o = base + v.getUint16(h + 8 + i * 2);
          const [size, a] = varint(o); o += a;
          const [rowid, c] = varint(o); o += c;
          out.push([rowid, record(payload(o, size))]);
        }
      } else if (kind === 0x05) { // table interior: children left to right, then the rightmost
        for (let i = 0; i < cells; i++) visit(v.getUint32(base + v.getUint16(h + 12 + i * 2)));
        visit(v.getUint32(h + 8));
      } else fail();
    };
    visit(root);
    return out;
  };

  // The schema table (page 1): type, name, tbl_name, rootpage, sql.
  const schema = walk(1).map(([, r]) => r);
  const tables = new Map<string, { root: number; cols: string[]; rowidCol?: string }>();
  for (const [type, name, , root, sql] of schema) {
    if (type !== 'table' || typeof name !== 'string' || typeof root !== 'number' || typeof sql !== 'string' || !root) continue;
    tables.set(name, { root, ...columnsOf(sql) });
  }

  return {
    tables: [...tables.keys()],
    rows(table) {
      const t = tables.get(table);
      if (!t) return [];
      return walk(t.root).map(([rowid, vals]) => {
        const row: Row = {};
        t.cols.forEach((c, i) => { row[c] = vals[i] ?? null; }); // a column added later is missing from older rows: null
        if (t.rowidCol) row[t.rowidCol] = rowid;
        return row;
      });
    },
  };
}

/** A varint at o: [value, bytes read]. Values past 2^53 lose precision, which no show needs. */
function varintIn(p: Uint8Array, o: number): [number, number] {
  let x = 0;
  for (let i = 0; i < 9; i++) {
    if (o + i >= p.length) fail();
    const c = p[o + i];
    if (i === 8) return [x * 256 + c, 9];
    x = x * 128 + (c & 0x7f);
    if (!(c & 0x80)) return [x, i + 1];
  }
  return fail();
}

/** A big-endian two's-complement integer of n bytes. */
function int(p: Uint8Array, o: number, n: number): number {
  let x = 0;
  for (let i = 0; i < n; i++) x = x * 256 + p[o + i];
  return p[o] & 0x80 ? x - 2 ** (8 * n) : x;
}

/**
 * Column names from a CREATE TABLE statement, in order, and the INTEGER PRIMARY KEY column (it holds the rowid).
 * Table constraints (PRIMARY KEY (...), UNIQUE, CHECK, FOREIGN KEY, CONSTRAINT) aren't columns.
 */
export function columnsOf(sql: string): { cols: string[]; rowidCol?: string } {
  const open = sql.indexOf('('), close = sql.lastIndexOf(')');
  if (open < 0 || close < open) return { cols: [] };
  const body = sql.slice(open + 1, close), parts: string[] = [];
  let depth = 0, quote = '', cur = '';
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'" || ch === '`' || ch === '[') { quote = ch === '[' ? ']' : ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  const cols: string[] = [];
  let rowidCol: string | undefined;
  for (const raw of parts) {
    const part = raw.trim();
    if (!part || /^(constraint|primary\s+key|unique|check|foreign\s+key)\b/i.test(part)) continue;
    const m = part.match(/^("(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|'[^']+'|\S+)\s*(.*)$/s);
    if (!m) continue;
    const name = m[1].replace(/^["`'[]|["`'\]]$/g, '').replace(/""/g, '"');
    cols.push(name);
    if (/^integer\b[^,]*\bprimary\s+key\b/i.test(m[2]) && !/\bdesc\b/i.test(m[2])) rowidCol = name;
  }
  return { cols, rowidCol };
}
