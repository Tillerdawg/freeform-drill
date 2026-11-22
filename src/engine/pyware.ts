// Import Pyware 3D drill: ".3dj" files (Pyware 8 and older, and Pyware 10) and Pyware 10's ".3dz" packages (a zip
// holding the .3dj, its recording, and pictures). Clean-room: written from the behavior of Jason's own files and two
// Pyware 10 shows Shubreet Kaur sent for testing (see DECISIONS.md), no Pyware code.
// A .3dj is a chain of blocks: a 4-letter tag, a 4-byte big-endian length, then the data.
//   GRID  plain-text field description (yards from the field's center); HZHS lines are the hashes.
//   CAST  performers: u16 count, then per performer u16 id, a short string (label number), a short string (the
//         person's name, which becomes the roster).
//   CST2  (newer files) per performer u16 id + short string naming the 3D figure, e.g. "Trumpet Figure".
//   PAGE  one per count: u16 count, then 20-byte records: u16 id … byte 8 = dot symbol, byte 10's top 3 bits = label
//         side (eighths of a turn from the front, toward Side 2; worked out from where Jason's labels sit), u16 x at 13, u16 y at 15.
//         x, y are offset by 0x8000 from the field's center; 120 units = one 8-to-5 step; +x = Side 2, +y = front.
//   PROP  ends a set: the PAGEs since the previous PROP are that set's counts (the last one is the set itself), one
//         spot per count, so curved, follow-the-leader and delayed moves come through as drawn.
//         A follow-the-leader the writer only described in the note is saved as straight lines that run through
//         each other; hiddenFtl (below) rebuilds those.
//         Byte 25 starts a u16 length and the set's note text.
// Files keep 300+ PAGEs; the ones after the last PROP are unused.
// Pyware 10 (Shubreet's files, 2026-11-22) has the same PAGEs, one per count from count 0, but no CAST or PROP:
//   CST6  performers: u16 count, then per performer u16 id and six short strings (the first is the label number; the
//         rest were empty in every file seen, so they aren't read).
//   PTB6  the sets: u16 (unknown), u16 count, then per set u16 count where the set falls, three u16-length strings
//         (title as the writer typed it, e.g. "A, 3 - 6" for rehearsal A, measures 3 to 6; the set's note; one more),
//         then 10 bytes, the last 1 for a sub-set (2A after 2). Strings are UTF-8.
//   PTBC, PTBT  u16 length, then text, one ";"-separated entry per set: its color ("255,0,0", or "." for none) and
//         its tempo, when the writer typed one (not read: SYNC has the timing).
//   PRP7, PRPM  props, one pair per count when the show has props (not read yet).
//   SYNC  the recording's name (u16 length, UTF-16), then u16 n and n doubles: the seconds where each count falls,
//         count 0 first. Its stored length is too short, so it's read by what it holds.
// Locked or encrypted files: FreeFORM never unlocks or decrypts drill (DECISIONS.md, 2026-11-16). A file whose bytes look
// like noise (encrypted or compressed) gets LOCKED_MESSAGE instead of "damaged" or "not a Pyware file".
import { FIELD_WIDTH, ftlPositions } from './coords';
import type { HashPreset } from './coords';
import { MAX_NAME, evenPath, newId, parseShow, scoreOrder, type DrillSet, type LabelSide, type Performer, type Section, type SectionList, type SetColor, type Show } from './show';
import { isZip, readZip } from './zip';

const UNIT = 120; // file units per step
/**
 * Section letters as Jason wrote his Pyware shows, with the 3D figure names each one fits. Used to name sections:
 * this tells Alto from Tenor Saxophone, which the figures can't, and names files that have no figures at all.
 */
const LETTERS: Record<string, [string, RegExp]> = {
  F: ['Flute', /flute|piccolo/i], K: ['Clarinet', /clarinet/i], A: ['Alto Saxophone', /sax/i], X: ['Tenor Saxophone', /sax/i],
  P: ['Trumpet', /trumpet/i], H: ['Mellophone', /mellophone|horn/i], N: ['Trombone', /trombone/i], E: ['Baritone', /baritone|euphonium/i],
  T: ['Tuba', /tuba|sousaphone/i], S: ['Snare Drum', /snare/i], B: ['Bass Drum', /bass drum/i], Q: ['Quads', /quad|tenor drum/i],
  G: ['Color Guard', /flag|rifle|sabre|saber|guard/i],
  C: ['Cymbals', /cymbal/i], // not in Jason's list, but his files give C cymbal figures
};
const MAX_BYTES = 50_000_000;
/** Pyware label codes 0–7, from the front around toward Side 2, as FreeFORM's sides (above = toward the back, right = Side 2). */
const PY_SIDES: LabelSide[] = ['below', 'below-right', 'right', 'above-right', 'above', 'above-left', 'left', 'below-left'];

const fail = (msg: string): never => { throw new Error(msg); };

/** What a director sees when a .3dj is locked, encrypted, or saved in a scrambled newer format. */
export const LOCKED_MESSAGE = "FreeFORM can't open this Pyware file because it looks locked or encrypted. Drill writers can lock a show they sell, and FreeFORM doesn't unlock or decrypt drill. If you bought this show, ask the drill writer for an unlocked copy. If it's your own show and it still won't open, please tell me which version of Pyware saved it (Help → Send feedback).";

/**
 * True when a file's bytes look like noise: encrypted or compressed data, not Pyware's plain blocks. Real .3dj files
 * are full of zeros and repeats (about 5 to 6 bits per byte in their first 64 KB); encrypted or compressed data is
 * close to 8. A zip (PK) header counts too. Too little data to judge (under 1 KB) is never called scrambled.
 */
export function looksScrambled(b: Uint8Array): boolean {
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return true; // a zip
  const n = Math.min(b.length, 65536);
  if (n < 1024) return false;
  const counts = new Uint32Array(256);
  for (let i = 0; i < n; i++) counts[b[i]]++;
  let bits = 0;
  for (const c of counts) if (c) bits -= (c / n) * Math.log2(c / n);
  return bits > 7.5;
}

/** Read a .3dj file into a FreeFORM show. Throws a readable error for anything it can't use. */
/** `notes`: what came in approximated, in plain sentences, for the import summary (filled in when given). */
/** `own`: the drill writer's own section list (their letters), used to name sections the file gives no instrument for. */
export function parse3dj(data: ArrayBuffer, title = 'Imported show', notes?: string[], own?: SectionList): Show {
  if (data.byteLength > MAX_BYTES) fail('That file is too big to be a Pyware show.');
  const b = new Uint8Array(data);
  const v = new DataView(data);
  // Can't read it: say "locked" when the bytes look encrypted, so a locked show isn't called damaged or not Pyware.
  const cant = (msg: string): never => fail(looksScrambled(b) ? LOCKED_MESSAGE : msg);
  const tagAt = (o: number) => (o + 8 <= b.length ? String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]) : '');
  if (tagAt(0) !== '3DJV') cant("That isn't a Pyware 3D (.3dj) drill file.");

  // Walk the blocks. A few blocks store a wrong length, so when the chain breaks, look ahead for the next real block.
  const blocks: { tag: string; at: number; len: number }[] = [];
  const known = /^(PREF|PRF2|GRID|CAST|CST2|CST3|CST6|COLR|PLST|PLS1|PTAB|PTB2|PTB5|PTB6|PTBC|PTBT|PTBI|PTL1|FACE|PAGE|PROP|PRP7|PRPM|SEL1|VIS1|VsD1|TxD1|FAB1|SYNC|END\.)$/;
  const validAt = (o: number) => known.test(tagAt(o)) && o + 8 + v.getUint32(o + 4) <= b.length;
  let o = indexOf(b, 'PREF', 0);
  if (o < 0) cant("That Pyware file looks damaged (no settings block found).");
  while (o >= 0 && o + 8 <= b.length) {
    const tag = tagAt(o), len = v.getUint32(o + 4);
    blocks.push({ tag, at: o + 8, len });
    if (tag === 'END.' || tag === 'SYNC') break;
    let next = o + 8 + len;
    if (!validAt(next)) next = resync(b, v, o + 8, validAt);
    o = next;
  }

  const first = (tag: string) => blocks.find((x) => x.tag === tag);
  const cast = first('CAST');
  const cast6 = cast ? undefined : first('CST6'); // Pyware 10
  if (!cast && !cast6) cant('That Pyware file has no performers.');

  // Performers: label numbers from CAST (or CST6), the person's name from CAST, figure names from CST2 (when present).
  const labels = new Map<number, string>(), people = new Map<number, string>();
  if (cast) readList(b, v, cast, (id, strs) => { labels.set(id, strs[0] ?? ''); people.set(id, (strs[1] ?? '').trim()); }, 2);
  else readList(b, v, cast6!, (id, strs) => labels.set(id, strs[0] ?? ''), 6);
  const figures = new Map<number, string>();
  const c2 = first('CST2');
  if (c2) readList(b, v, c2, (id, strs) => figures.set(id, strs[0] ?? ''), 1);

  const rebuilt: string[] = []; // sets whose follow-the-leader was worked out from straight lines (for the import summary)
  // Sets: the PAGEs between PROPs.
  type Rec = { x: number; y: number; sym: string; lab: number };
  const readPage = (blk: { at: number; len: number }) => {
    const n = v.getUint16(blk.at), recs = new Map<number, Rec>();
    if (2 + n * 20 !== blk.len) return null;
    for (let i = 0; i < n; i++) {
      const r = blk.at + 2 + i * 20;
      recs.set(v.getUint16(r), { x: v.getUint16(r + 13) - 0x8000, y: v.getUint16(r + 15) - 0x8000, sym: String.fromCharCode(b[r + 8]), lab: b[r + 10] >> 5 });
    }
    return recs;
  };
  type Run = { last: Map<number, Rec>; pages: Map<number, Rec>[]; counts: number; note: string; name?: string; measures?: string; color?: SetColor };
  const runs: Run[] = [];
  let pages: Map<number, Rec>[] = [];
  const table = first('PTB6'); // Pyware 10: the sets are listed in one table, by the count each falls on
  if (table) {
    const list = readSetTable(b, v, table) ?? cant("That Pyware file looks damaged (its list of sets can't be read).");
    const colors = textList(b, v, first('PTBC'));
    const all = blocks.filter((x) => x.tag === 'PAGE').map(readPage);
    let number = 0, letter = 0;
    list.forEach((t, k) => {
      const from = k ? list[k - 1].start + 1 : t.start, got = all.slice(from, t.start + 1);
      if (got.length !== t.start + 1 - from || got.some((p) => !p)) cant("That Pyware file looks damaged (some of a set's counts are missing).");
      // Names: Pyware's own (1, 2, 2A, 3).
      if (t.subset && k) letter++; else { number++; letter = 0; }
      const name = `${number}${letter ? String.fromCharCode(64 + Math.min(letter, 26)) : ''}`;
      const m = t.title.match(/^(?:(.*?)\s*,\s*)?(\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?)$/); // "A, 3 - 6" or "33"
      const measures = m ? m[2].replace(/\s+/g, '').replace('-', '–') : undefined;
      const heading = m ? (m[1] ? t.title : '') : t.title; // a title with more than measures stays, as written, atop the note
      const color = setColorOf(colors[k] ?? '');
      runs.push({ last: got[got.length - 1]!, pages: got as Map<number, Rec>[], counts: k ? t.start - list[k - 1].start : 0,
        note: [heading, t.note].filter(Boolean).join('\n').replace(/\r\n?/g, '\n').trim(), name, measures, ...(color ? { color } : {}) });
    });
  }
  for (const blk of table ? [] : blocks) {
    if (blk.tag === 'PAGE') { const p = readPage(blk); if (p) pages.push(p); }
    if (blk.tag === 'PROP') {
      const textLen = blk.len >= 27 ? v.getUint16(blk.at + 25) : 0;
      const note = latin1(b.subarray(blk.at + 27, Math.min(blk.at + 27 + textLen, blk.at + blk.len))).replace(/\r\n?/g, '\n').trim();
      if (pages.length) runs.push({ last: pages[pages.length - 1], pages, counts: runs.length ? pages.length : 0, note });
      else if (runs.length && note) runs[runs.length - 1].note += '\n' + note;
      pages = [];
    }
  }
  if (!runs.length) cant('That Pyware file has no saved sets (it may be a backup or draft copy). Try another version of the show.');

  // Sections: one per dot symbol, named after the figure most of its performers use.
  const firstSeen = new Map<number, Rec>();
  for (const r of runs) for (const [id, rec] of r.last) if (!firstSeen.has(id)) firstSeen.set(id, rec);
  const symbols = [...new Set([...firstSeen.values()].map((r) => r.sym))].sort();
  const figureOf = (sym: string) => {
    const counts = new Map<string, number>();
    for (const [id, r] of firstSeen) if (r.sym === sym) { const f = (figures.get(id) ?? '').replace(/\s*Figure$/i, '').trim(); if (f) counts.set(f, (counts.get(f) ?? 0) + 1); }
    return [...counts].sort((a, c) => c[1] - a[1])[0]?.[0] ?? '';
  };
  // A symbol's name: the letter scheme below when the file's 3D figure agrees with it (or there is no figure), else the figure.
  const mine = (sym: string) => own?.find((x) => x.letter.trim().toUpperCase() === sym.toUpperCase())?.name.trim();
  const names = symbols.map((sym) => {
    const fig = figureOf(sym), known = LETTERS[sym];
    if (!fig && mine(sym)) return mine(sym)!; // the writer's own letter for it (Jason, 2026-11-22)
    return known && (!fig || known[1].test(fig)) ? known[0] : fig;
  });
  const sections: Section[] = symbols.map((sym, i) => {
    const base = names[i] || `Symbol ${sym}`;
    const shared = names[i] && names.filter((x) => x === names[i]).length > 1;
    return { id: newId('s'), name: shared ? `${base} (${sym})` : base, letter: sym };
  });
  const sectionOf = new Map(symbols.map((s, i) => [s, sections[i].id]));

  const performers: Performer[] = [];
  const pid = new Map<number, string>();
  const used = new Map<string, Set<number>>();
  for (const [id, rec] of [...firstSeen].sort((a, c) => a[0] - c[0])) {
    const section = sectionOf.get(rec.sym)!;
    const taken = used.get(section) ?? new Set<number>();
    let number = parseInt(labels.get(id) ?? '', 10);
    if (!Number.isFinite(number) || number < 1 || taken.has(number)) { number = 1; while (taken.has(number)) number++; }
    taken.add(number); used.set(section, taken);
    const p: Performer = { id: newId('p'), section, number, ...(people.get(id) ? { name: people.get(id)!.slice(0, MAX_NAME) } : {}) };
    performers.push(p); pid.set(id, p.id);
  }

  // Field position: FreeFORM measures x in steps from the 50 (+ = Side 2) and y in steps from the front sideline.
  const sets: DrillSet[] = [];
  const spot = (rec: Rec) => ({ x: rec.x / UNIT, y: FIELD_WIDTH / 2 - rec.y / UNIT });
  const taken = new Set<string>();
  let prev: Record<string, { x: number; y: number }> = {};
  runs.forEach((r, i) => {
    const pos: Record<string, { x: number; y: number }> = { ...prev };
    for (const [id, rec] of r.last) pos[pid.get(id)!] = spot(rec);
    for (const p of performers) pos[p.id] ??= { x: 0, y: FIELD_WIDTH / 2 };
    // The set's name as the drill writer wrote it in the note ("Mario, Set 2A", "Set:  3A", "Page: 2"), else its number.
    const named = r.name ?? r.note.split('\n').slice(0, 3).join(' ').match(/\b(?:set|page)\s*:?\s*(\d+[A-Za-z]?)\b/i)?.[1].toUpperCase();
    const name = named && !taken.has(named) ? named : !taken.has(String(i + 1)) ? String(i + 1) : `${i + 1}′`;
    taken.add(name);
    const set: DrillSet = { id: newId('set'), name, counts: r.counts, pos };
    const mm = r.note.match(/\bmm?\.?\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
    if (r.measures) set.measures = r.measures;
    else if (mm) set.measures = mm[1].replace(/\s+/g, '').replace('-', '–');
    if (r.note) set.note = r.note;
    if (r.color) set.color = r.color;
    // Label sides the drill writer chose in Pyware. Code 1 (below-right) is where Pyware leaves a label nobody moved,
    // so those stay automatic (readable) in FreeFORM.
    const sides: Record<string, LabelSide> = {};
    for (const [id, rec] of r.last) if (rec.lab !== 1) sides[pid.get(id)!] = PY_SIDES[rec.lab];
    if (Object.keys(sides).length) set.labels = sides;
    // Count-by-count spots, with even steps while moving (Pyware's pages sometimes jump on one count), kept only for
    // performers who leave the straight line (more than 1/50 of a step).
    if (i > 0 && r.pages.length === r.counts) {
      const paths: Record<string, { x: number; y: number }[]> = {};
      for (const [id, rec] of r.last) {
        const p = pid.get(id)!, from = prev[p] ?? pos[p], to = spot(rec);
        const raw = [from, ...r.pages.map((pg) => (pg.get(id) ? spot(pg.get(id)!) : null))];
        if (raw.some((q) => !q)) continue;
        const path = evenPath(raw as { x: number; y: number }[]);
        const n = r.counts;
        if (path.some((q, k) => Math.hypot(q!.x - (from.x + ((to.x - from.x) * k) / n), q!.y - (from.y + ((to.y - from.y) * k) / n)) > 0.02)) paths[p] = path as { x: number; y: number }[];
      }
      if (Object.keys(paths).length) set.paths = paths;
      // Performers whose straight lines put them on one spot mid-move: a follow-the-leader, if their spots fit one.
      const crowded = new Set<string>();
      for (const pg of r.pages.slice(0, -1)) {
        const dots = [...pg].filter(([id]) => r.last.has(id) && !paths[pid.get(id)!]);
        for (const [id, a] of dots) if (dots.some(([other, c]) => other !== id && Math.hypot(a.x - c.x, a.y - c.y) < UNIT * SHARED)) crowded.add(pid.get(id)!);
      }
      const ftl = hiddenFtl(prev, pos, [...crowded].filter((p) => prev[p]), r.counts);
      if (ftl.length) { set.ftl = ftl; rebuilt.push(set.name); }
    }
    sets.push(set); prev = pos;
  });

  if (!figures.size && notes) {
    const guessed = sections.filter((x) => mine(x.letter) || LETTERS[x.letter]).map((x) => `${x.letter} = ${x.name}`);
    if (guessed.length) notes.push(`This file doesn't say which instrument each dot symbol is, so FreeFORM named the sections from ${own ? 'your section letters' : "FreeFORM's letters"}: ${guessed.join(', ')}. Rename any that are wrong under Sections in the sidebar.`);
  }
  if (runs.some((r) => r.color)) notes?.push("The sets' colors came in as the nearest FreeFORM set color. FreeFORM saves red, yellow, and green for warnings, so red sets are Pink.");
  if (blocks.some((x) => x.tag === 'PRP7' && x.len > 2)) notes?.push("The file has props, which FreeFORM doesn't bring in from Pyware yet. Add them under Props in the sidebar.");
  if (rebuilt.length) notes?.push(`Follow-the-leader moves were saved in the file as straight lines that run through each other, so FreeFORM worked them out: ${rebuilt.length === 1 ? 'set' : 'sets'} ${rebuilt.join(', ')}. Watch ${rebuilt.length === 1 ? 'it' : 'them'} to be sure ${rebuilt.length === 1 ? "it's" : "they're"} what the writer meant.`);
  // setNaming 'manual': the writer's set names stay as they are when sets are added or deleted (Jason, 2026-11-17)
  const show: Show = { format: 'freeform-show', version: 1, title, hash: hashFrom(b, first('GRID')), sections: scoreOrder(sections), performers, sets, setNaming: 'manual' };
  return parseShow(JSON.stringify(show)); // same checks as any imported file
}

type Pt = { x: number; y: number };
const SHARED = 0.3; // steps: closer than this on the same count is one spot
const NEAR = 0.02; // steps: Pyware's spots are whole file units, so this is "the same place"
const REACH = 16; // steps: the most room between two performers in a file

/**
 * Follow-the-leader moves that Pyware kept as straight lines. A writer who only wrote "follow-the-leader" in the
 * set's note (and didn't draw the route) left Pyware to move every dot straight to its next spot, so a file that
 * snakes around a corner collapses onto one spot mid-move. `ids` are the performers who share a spot that way.
 * This looks for the files that explain their two sets exactly: an order and a leader's route where everyone marches
 * the same distance along the trail and lands on their own spot. It prefers the longest file, then the shortest
 * march, then the leader who starts nearest the front (a file that fits with the turn at either end; Jason's did), and takes nothing shorter than three performers or faster than a 4-to-5. A file is used only if nobody in
 * it comes within a step of anyone else in it on any count. Anything else is left as Pyware had it (Review lists the too-close performers).
 */
export function hiddenFtl(from: Record<string, Pt>, to: Record<string, Pt>, ids: string[], counts: number): { order: string[]; turns?: Pt[] }[] {
  const d = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const cap = counts * 2, groups: { order: string[]; turns?: Pt[] }[] = [];
  let pool = ids.filter((id) => d(from[id], to[id]) > NEAR);
  while (pool.length > 2) {
    let budget = 0; // tries left for this leader: gives up on a crowd too tangled to read
    let best: { order: string[]; s: number[]; len: number } | undefined;
    // order: the file so far, leader first. s: how far behind the leader's start each one starts, along the trail.
    // len: the leader's route length, known once someone ends on the trail (until then, everyone ends on the route ahead).
    const grow = (order: string[], s: number[], len?: number) => {
      const last = order[order.length - 1], sl = s[s.length - 1];
      const L = len ?? sl + d(from[order[0]], to[last]);
      if (L > cap + NEAR) return;
      if (order.length > 2 && (!best || order.length > best.order.length || (order.length === best.order.length && (L < best.len - NEAR || (L < best.len + NEAR && from[order[0]].y < from[best.order[0]].y - NEAR))))) best = { order, s, len: L };
      const next = pool.filter((id) => !order.includes(id) && d(from[last], from[id]) > NEAR && d(from[last], from[id]) <= REACH)
        .sort((a, c) => d(from[last], from[a]) - d(from[last], from[c])).slice(0, 4);
      for (const id of next) {
        if (budget-- <= 0) return;
        const gap = d(from[last], from[id]), sc = sl + gap;
        // Ends on the leader's route, as far behind the one in front as they started.
        if (len === undefined && Math.abs(d(to[id], to[last]) - gap) < NEAR) grow([...order, id], [...s, sc]);
        // Ends on the trail, L ahead of their start.
        if (L > NEAR && sc >= L - NEAR) {
          const want = sc - L, hit = s.findIndex((x) => x >= want - 1e-9), k = hit < 0 ? order.length : Math.max(1, hit); // the stretch of trail it lands in
          const a = from[order[k - 1]], b = from[order[k] ?? id], f = (want - s[k - 1]) / ((s[k] ?? sc) - s[k - 1]);
          if (d(to[id], { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }) < NEAR) grow([...order, id], [...s, sc], L);
        }
      }
    };
    for (const lead of pool) { budget = 20_000; grow([lead], [0]); }
    const found = best as { order: string[]; s: number[]; len: number } | undefined; // (assigned inside grow)
    if (!found) break;
    // The leader's turns: where the ones just behind the leader end up, nearest the leader's start first, corners only.
    const { order, s, len } = found, start = from[order[0]], end = to[order[0]];
    const ahead = order.filter((_, k) => k > 0 && s[k] < len - NEAR).reverse().map((id) => to[id]);
    const turns = ahead.filter((p, k) => {
      const a = ahead[k - 1] ?? start, b = ahead[k + 1] ?? end, u = { x: p.x - a.x, y: p.y - a.y }, w = { x: b.x - p.x, y: b.y - p.y };
      return d(a, p) > NEAR && (Math.abs(u.x * w.y - u.y * w.x) > 1e-6 || u.x * w.x + u.y * w.y < 0);
    });
    const starts = order.map((id) => from[id]);
    const at = (k: number) => ftlPositions(starts, end, k / counts, turns);
    const lands = at(counts).every((p, k) => d(p, to[order[k]]) < NEAR);
    let clear = true;
    for (let k = 1; k < counts && clear; k++) { const now = at(k); clear = now.every((p, i) => now.every((q, j) => j <= i || d(p, q) >= 1)); }
    if (!lands || !clear) break;
    groups.push(turns.length ? { order, turns } : { order });
    pool = pool.filter((id) => !order.includes(id));
  }
  return groups;
}

/** PTB6 (Pyware 10's sets): see the top of the file. Null unless it reads exactly to the block's end, counts in order. */
function readSetTable(b: Uint8Array, v: DataView, blk: { at: number; len: number }) {
  const end = blk.at + blk.len, out: { start: number; title: string; note: string; subset: boolean }[] = [];
  if (blk.len < 4) return null;
  let o = blk.at + 4;
  for (let k = v.getUint16(blk.at + 2); k > 0; k--) {
    if (o + 2 > end) return null;
    const start = v.getUint16(o); o += 2;
    const strs: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (o + 2 > end) return null;
      const n = v.getUint16(o); if (o + 2 + n > end) return null;
      strs.push(utf8(b.subarray(o + 2, o + 2 + n))); o += 2 + n;
    }
    if (o + 10 > end || (out.length && start < out[out.length - 1].start)) return null;
    out.push({ start, title: strs[0].trim(), note: strs[1], subset: b[o + 9] === 1 }); o += 10;
  }
  return o === end && out.length ? out : null;
}

/** PTBC (and PTBT): a u16 length, then one ";"-separated entry per set. */
function textList(b: Uint8Array, v: DataView, blk?: { at: number; len: number }): string[] {
  if (!blk || blk.len < 2) return [];
  const n = Math.min(v.getUint16(blk.at), blk.len - 2);
  return utf8(b.subarray(blk.at + 2, blk.at + 2 + n)).split(';');
}

/**
 * A Pyware set color ("r,g,b", or "." for none) as the nearest FreeFORM set color by hue. FreeFORM keeps red, yellow,
 * and green for warnings, selection, and done, so red goes to Pink, yellow to Orange, and green to Teal (Claude, 2026-11-22).
 */
export function setColorOf(text: string): SetColor | undefined {
  const m = text.trim().match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
  if (!m) return undefined;
  const [r, g, bl] = [m[1], m[2], m[3]].map((x) => Math.min(255, +x) / 255);
  const max = Math.max(r, g, bl), min = Math.min(r, g, bl), c = max - min;
  if (max === 0 || c / max < 0.2) return 'gray';
  const h = (max === r ? ((g - bl) / c + 6) % 6 : max === g ? (bl - r) / c + 2 : (r - g) / c + 4) * 60;
  return h < 15 || h >= 290 ? 'pink' : h < 75 ? 'orange' : h < 200 ? 'teal' : h < 255 ? 'blue' : 'purple';
}

/** A .3dj's SYNC: the recording's file name and the seconds where each count falls (count 0 first). */
export function readSync(data: ArrayBuffer): { name: string; times: number[] } | null {
  const b = new Uint8Array(data), v = new DataView(data);
  for (let o = indexOf(b, 'SYNC', 0); o >= 0; o = indexOf(b, 'SYNC', o + 4)) {
    let p = o + 8;
    if (p + 2 > b.length) return null;
    const chars = v.getUint16(p); p += 2;
    if (p + chars * 2 + 2 > b.length) continue;
    let path = '';
    for (let i = 0; i < chars; i++) path += String.fromCharCode(v.getUint16(p + i * 2));
    p += chars * 2;
    const n = v.getUint16(p); p += 2;
    if (n < 2 || p + n * 8 > b.length) continue;
    const times: number[] = [];
    for (let i = 0; i < n; i++) times.push(v.getFloat64(p + i * 8));
    if (!times.every((t, i) => Number.isFinite(t) && t >= 0 && t < 36_000 && (i === 0 || t > times[i - 1]))) continue;
    const name = decodeURIComponent(path.split(/[\\/]/).pop() ?? '').trim();
    return { name, times };
  }
  return null;
}

/** Audio types by file extension, for a recording that comes out of a .3dz. */
const AUDIO: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac' };
const MAX_TAPS = 20_000;

/**
 * Open a Pyware file: a .3dj, or a Pyware 10 .3dz package (a zip). From a package the recording comes too, already
 * timed to the counts the way the writer synced it in Pyware. `notes` gets what to check, for the import summary.
 */
export async function importPyware(data: ArrayBuffer, title = 'Imported show', notes: string[] = [], own?: SectionList): Promise<{ show: Show; audio?: Blob }> {
  if (data.byteLength > MAX_PACKAGE) fail('That file is too big to be a Pyware show.');
  if (!isZip(new Uint8Array(data))) {
    const show = parse3dj(data, title, notes, own), sync = readSync(data);
    if (sync?.name) notes.push(`In Pyware this show was synced to a recording (${sync.name}). Open the .3dz package instead of the .3dj to bring the music in with its timing, or add it under Music.`);
    return { show };
  }
  let files: ReturnType<typeof readZip>;
  try { files = readZip(data, 'Pyware'); } catch { return fail("That isn't a Pyware drill file, or it's damaged."); }
  const paths = Object.keys(files).filter((f) => !f.startsWith('__MACOSX/'));
  const drill = paths.find((f) => /\.3dj$/i.test(f)) ?? fail("That package has no Pyware drill (.3dj) inside, so FreeFORM can't open it.");
  const raw = await files[drill]();
  const inner = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const show = parse3dj(inner, title, notes, own), sync = readSync(inner);
  if (!sync) return { show };
  const base = (f: string) => f.split('/').pop()!.toLowerCase();
  const file = paths.find((f) => base(f) === sync.name.toLowerCase()) ?? paths.filter((f) => AUDIO[f.split('.').pop()!.toLowerCase()]).find(() => true);
  if (!file) {
    notes.push(`In Pyware this show was synced to a recording (${sync.name}), but it isn't in the package. Add it under Music.`);
    return { show };
  }
  const bytes = await files[file]();
  const name = file.split('/').pop()!.slice(0, 300);
  const taps = sync.times.slice(0, MAX_TAPS);
  if (name.toLowerCase().endsWith('.ogg') || name.toLowerCase().endsWith('.oga')) notes.push(`The recording (${name}) is an Ogg file. It plays in Chrome, Edge, and Firefox. If it won't play in Safari or on an iPad, open the show in one of those.`);
  return { show: { ...show, music: { name, audioId: 'import', taps } }, audio: new Blob([bytes], { type: AUDIO[name.split('.').pop()!.toLowerCase()] ?? 'audio/mpeg' }) };
}
const MAX_PACKAGE = 400_000_000; // a .3dz carries its recording and pictures

/** Hashes from the GRID text ("HZHS -8.75" = yards from center): high school ±8.75, college ±6.25, NFL ±3.75. */
function hashFrom(b: Uint8Array, grid?: { at: number; len: number }): HashPreset {
  if (!grid) return 'highSchool';
  const m = latin1(b.subarray(grid.at, grid.at + grid.len)).match(/HZHS\s+(-?[\d.]+)/);
  const yd = m ? Math.abs(parseFloat(m[1])) : 8.75;
  const options: [HashPreset, number][] = [['highSchool', 8.75], ['college', 6.25], ['nfl', 3.75]];
  return options.sort((a, c) => Math.abs(a[1] - yd) - Math.abs(c[1] - yd))[0][0];
}

/** CAST/CST2: u16 count, then per entry u16 id followed by `strings` short (length-prefixed) strings. */
function readList(b: Uint8Array, v: DataView, blk: { at: number; len: number }, each: (id: number, strs: string[]) => void, strings: number) {
  const end = blk.at + blk.len;
  let o = blk.at + 2;
  for (let k = v.getUint16(blk.at); k > 0 && o + 2 <= end; k--) {
    const id = v.getUint16(o); o += 2;
    const strs: string[] = [];
    for (let s = 0; s < strings && o < end; s++) { const n = b[o]; strs.push(latin1(b.subarray(o + 1, o + 1 + n))); o += 1 + n; }
    each(id, strs);
  }
}

function resync(b: Uint8Array, v: DataView, from: number, validAt: (o: number) => boolean): number {
  for (let o = from; o + 8 <= b.length; o++) {
    const t = b[o];
    if ((t === 0x50 || t === 0x53 || t === 0x45) && validAt(o)) { // P(AGE|ROP), S(YNC), E(ND.)
      const tag = String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
      if (tag !== 'PAGE' || (v.getUint32(o + 4) - 2) % 20 === 0) return o;
    }
  }
  return -1;
}

const indexOf = (b: Uint8Array, s: string, from: number) => {
  outer: for (let o = from; o + s.length <= b.length; o++) {
    for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) continue outer;
    return o;
  }
  return -1;
};
const latin1 = (a: Uint8Array) => Array.from(a, (c) => String.fromCharCode(c)).join('');
const utf8 = (a: Uint8Array) => new TextDecoder().decode(a);
