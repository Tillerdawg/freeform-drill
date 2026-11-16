// Import OpenMarch ".dots" show files. A .dots file is an SQLite database (read with sqlite.ts). Clean-room: written
// from the file's tables and columns and from how OpenMarch shows a file, with none of OpenMarch's code (it's AGPL; see
// DECISIONS.md). What FreeFORM uses:
//   marchers           section (text), drill_prefix + drill_order ("T" + 12 = T12), name.
//   beats              one row per count: position (order) and duration (seconds to the next beat).
//   pages              start_beat, is_subset (2A after 2), notes. The first page is the opening set (no counts); each
//                      later page's move is the beats from its start beat up to the next page's (the last page:
//                      utility.last_page_counts). Names as OpenMarch numbers them: 0, 1, 1A, 2 (workspace_settings
//                      pageNumberOffset moves the start).
//   marcher_pages      each marcher's spot on each page, in canvas pixels, and the pathway it marches to get there
//                      (path_data_id, from path_start_position to path_end_position, fractions of the path's length).
//   pathways           path_data: JSON {segments: [{type, data}]}, lines, arcs, quadratic and cubic curves, splines.
//   field_properties   json_data: the field's checkpoints (yard lines and hashes, in steps from the center front),
//                      stepSizeInches, name. Canvas pixels are half an inch; the center front is (width / 2, height).
//   measures           start_beat; numbered from workspace_settings measurementOffset (default 1).
//   audio_files        the recording (data), when the show file carries one; selected = the one in use.
// Midsets, shapes, tags, rotations, colors, and the field picture aren't brought in.
import { COURT, FIELD_WIDTH, HASHES, STEP_IN, type FieldSpec, type HashPreset, type Point } from './coords';
import { openDatabase, type Row, type Value } from './sqlite';
import { MAX_NAME, evenPath, newId, parseShow, scoreOrder, type DrillSet, type Performer, type Section, type Show } from './show';

const MAX_BYTES = 500_000_000; // a show with a long recording inside is big
const PX_PER_INCH = 0.5; // OpenMarch's canvas scale
const PX_PER_STEP = PX_PER_INCH * STEP_IN; // canvas pixels per FreeFORM (8-to-5) step
const MAX_PATH_COUNTS = 2000; // FreeFORM keeps count-by-count routes up to this long
const MAX_TAPS = 20_000;

const fail = (msg: string): never => { throw new Error(msg); };
const num = (v: Value | undefined, fallback = NaN) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const text = (v: Value | undefined) => (typeof v === 'string' ? v.trim() : '');
const json = (v: Value | undefined): unknown => { try { return typeof v === 'string' ? JSON.parse(v) : null; } catch { return null; } };

export interface DotsImport { show: Show; audio?: Blob }

export function parseDots(data: ArrayBuffer | Uint8Array, title = 'Imported show'): DotsImport {
  if (data.byteLength > MAX_BYTES) fail('That file is too big to be an OpenMarch show.');
  let db;
  try { db = openDatabase(data); } catch { return fail("That isn't an OpenMarch (.dots) file, or it's damaged."); }
  for (const t of ['marchers', 'pages', 'beats', 'marcher_pages']) if (!db.tables.includes(t)) fail("That isn't an OpenMarch (.dots) show file.");

  // ---- The field: where the center front is in canvas pixels, and what FreeFORM surface it is.
  const field = readField(db.rows('field_properties').find((r) => r.id === 1) ?? db.rows('field_properties')[0]);
  const spot = (x: number, y: number): Point => ({ x: (x - field.cx) / PX_PER_STEP, y: (field.cy - y) / PX_PER_STEP });

  const settings = (json(db.rows('workspace_settings')[0]?.json_data) ?? {}) as { pageNumberOffset?: unknown; measurementOffset?: unknown; audioOffsetSeconds?: unknown };
  const pageOffset = Number.isInteger(settings.pageNumberOffset) ? settings.pageNumberOffset as number : 0;
  const measureOffset = Number.isInteger(settings.measurementOffset) ? settings.measurementOffset as number : 1;
  const audioOffset = Number.isFinite(settings.audioOffsetSeconds) ? settings.audioOffsetSeconds as number : 0;

  // ---- Beats, in order: index and the time each starts.
  const beats = db.rows('beats').filter((b) => Number.isFinite(num(b.position)) && num(b.duration) >= 0).sort((a, b) => num(a.position) - num(b.position));
  if (!beats.length) fail('That OpenMarch show has no counts.');
  const beatIndex = new Map(beats.map((b, i) => [b.id, i]));
  const startTime: number[] = [0];
  for (const b of beats) startTime.push(startTime[startTime.length - 1] + num(b.duration, 0));

  // ---- Pages, in beat order, with their counts and names.
  const pages = db.rows('pages').filter((p) => beatIndex.has(p.start_beat)).sort((a, b) => beatIndex.get(a.start_beat)! - beatIndex.get(b.start_beat)!);
  if (!pages.length) fail('That OpenMarch show has no pages.');
  const lastCounts = Math.max(1, num(db.rows('utility')[0]?.last_page_counts, 8));
  const counts = pages.map((p, i) => {
    if (i === 0) return 0;
    const from = beatIndex.get(p.start_beat)!, next = pages[i + 1] ? beatIndex.get(pages[i + 1].start_beat)! : Math.min(beats.length, from + lastCounts);
    return Math.max(1, next - from);
  });
  const names = pageNames(pages.map((p) => num(p.is_subset, 0) === 1), pageOffset);

  // ---- Sections and performers: one section per OpenMarch section, split if its marchers use different drill prefixes.
  const marchers = db.rows('marchers').filter((m) => typeof m.id === 'number').sort((a, b) => text(a.section).localeCompare(text(b.section)) || text(a.drill_prefix).localeCompare(text(b.drill_prefix)) || num(a.drill_order, 0) - num(b.drill_order, 0));
  if (!marchers.length) fail('That OpenMarch show has no marchers.');
  const groupOf = (m: Row) => `${text(m.section) || 'Performers'}\u0000${text(m.drill_prefix)}`;
  const groups = [...new Set(marchers.map(groupOf))];
  const sections: Section[] = groups.map((g) => {
    const [name, prefix] = g.split('\u0000');
    const split = groups.filter((x) => x.split('\u0000')[0] === name).length > 1;
    const letter = (prefix || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'P').slice(0, 4);
    return { id: newId('s'), name: (split ? `${name} (${prefix || '?'})` : name).slice(0, MAX_NAME), letter };
  });
  const sectionId = new Map(groups.map((g, i) => [g, sections[i].id]));
  const performers: Performer[] = [], pid = new Map<Value, string>(), taken = new Map<string, Set<number>>();
  for (const m of marchers) {
    const section = sectionId.get(groupOf(m))!, used = taken.get(section) ?? new Set<number>();
    let number = num(m.drill_order);
    if (!Number.isInteger(number) || number < 0 || used.has(number)) { number = 1; while (used.has(number)) number++; }
    used.add(number); taken.set(section, used);
    const name = text(m.name).slice(0, MAX_NAME);
    const p: Performer = { id: newId('p'), section, number, ...(name ? { name } : {}) };
    performers.push(p); pid.set(m.id, p.id);
  }

  // ---- Spots, page by page (a marcher with no spot on a page stays where they were), and curved routes.
  const pathways = new Map(db.rows('pathways').map((r) => [r.id, r.path_data]));
  const byPage = new Map<Value, Row[]>();
  for (const mp of db.rows('marcher_pages')) { const list = byPage.get(mp.page_id) ?? []; list.push(mp); byPage.set(mp.page_id, list); }
  const measures = db.rows('measures').filter((m) => beatIndex.has(m.start_beat)).map((m) => beatIndex.get(m.start_beat)!).sort((a, b) => a - b);
  const measureAt = (beat: number) => { let k = -1; for (let i = 0; i < measures.length && measures[i] <= beat; i++) k = i; return k < 0 ? null : k + measureOffset; };

  const sets: DrillSet[] = [];
  let prev: Record<string, Point> = {};
  pages.forEach((page, i) => {
    const pos: Record<string, Point> = { ...prev }, routes: Record<string, Point[]> = {};
    for (const mp of byPage.get(page.id) ?? []) {
      const id = pid.get(mp.marcher_id), x = num(mp.x), y = num(mp.y);
      if (!id || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      pos[id] = spot(x, y);
      if (i > 0 && prev[id] && counts[i] <= MAX_PATH_COUNTS && mp.path_data_id != null) {
        const route = sampleRoute(pathways.get(mp.path_data_id), num(mp.path_start_position, 0), num(mp.path_end_position, 1), counts[i]);
        if (route) routes[id] = route.map((q) => spot(q.x, q.y));
      }
    }
    for (const p of performers) pos[p.id] ??= { x: 0, y: field.depth / 2 };
    const set: DrillSet = { id: newId('set'), name: names[i], counts: counts[i], pos };
    // Routes that really leave the straight line, pinned to the two spots and stepped evenly.
    const paths: Record<string, Point[]> = {};
    for (const [id, raw] of Object.entries(routes)) {
      const a = prev[id], b = pos[id], n = counts[i];
      raw[0] = { ...a }; raw[n] = { ...b };
      const path = evenPath(raw);
      if (path.some((q, k) => Math.hypot(q.x - (a.x + ((b.x - a.x) * k) / n), q.y - (a.y + ((b.y - a.y) * k) / n)) > 0.02)) paths[id] = path;
    }
    if (Object.keys(paths).length) set.paths = paths;
    if (i > 0 && measures.length) {
      const from = beatIndex.get(page.start_beat)!, a = measureAt(from), b = measureAt(from + counts[i] - 1);
      if (a !== null && b !== null) set.measures = a === b ? `${a}` : `${a}–${b}`;
    }
    const note = text(page.notes);
    if (note) set.note = note;
    sets.push(set); prev = pos;
  });

  // ---- The recording, timed to the beats: count 0 is where the first move starts.
  let audio: Blob | undefined, music: Show['music'];
  const files = db.rows('audio_files').filter((f) => f.data instanceof Uint8Array && f.data.length > 0);
  const file = files.find((f) => num(f.selected, 0) === 1) ?? files[0];
  if (file && pages.length > 1) {
    const first = beatIndex.get(pages[1].start_beat)!, taps: number[] = [];
    for (let k = first; k <= beats.length && taps.length < MAX_TAPS; k++) {
      const t = Math.max(0, startTime[k] - audioOffset);
      taps.push(taps.length && t <= taps[taps.length - 1] ? taps[taps.length - 1] + 0.001 : t);
    }
    if (taps.length >= 2) {
      const name = (text(file.nickname) || text(file.path).split(/[\\/]/).pop() || 'Recording').slice(0, 300);
      audio = new Blob([file.data as Uint8Array<ArrayBuffer>], { type: audioType(text(file.path) || name) });
      music = { name, audioId: 'import', taps };
    }
  }

  const show: Show = { format: 'freeform-show', version: 1, title, hash: field.hash, ...(field.surface ? { surface: field.surface } : {}),
    sections: scoreOrder(sections), performers, sets, ...(music ? { music } : {}) };
  return { show: parseShow(JSON.stringify(show)), audio }; // the same checks as any imported file
}

/** OpenMarch's page names: "0", "1", "1A", "1B", "2" … (the first page always takes the offset's number). */
export function pageNames(subset: boolean[], offset = 0): string[] {
  const out: string[] = [];
  let n = offset, letters = '';
  const next = (s: string) => { // A … Z, AA, AB … as a spreadsheet counts columns
    const c = [...s];
    for (let i = c.length - 1; i >= 0; i--) { if (c[i] !== 'Z') { c[i] = String.fromCharCode(c[i].charCodeAt(0) + 1); return c.join(''); } c[i] = 'A'; }
    return 'A' + c.join('');
  };
  subset.forEach((sub, i) => {
    if (i === 0) { out.push(String(n)); return; }
    if (sub) { letters = next(letters); out.push(`${n}${letters}`); } else { n++; letters = ''; out.push(String(n)); }
  });
  return out;
}

const audioType = (name: string) => ({ mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'audio/mpeg';

// ---- The field.

interface Checkpoint { name?: unknown; axis?: unknown; stepsFromCenterFront?: unknown; useAsReference?: unknown }

/** Center front in canvas pixels, FreeFORM's surface, and the depth in steps. No field settings: OpenMarch's default high school field. */
function readField(row: Row | undefined): { cx: number; cy: number; hash: HashPreset; surface?: FieldSpec & object; depth: number } {
  const f = (json(row?.json_data) ?? {}) as { name?: unknown; xCheckpoints?: unknown; yCheckpoints?: unknown; stepSizeInches?: unknown; isCustom?: unknown; useHashes?: unknown };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((c: Checkpoint) => Number.isFinite(c?.stepsFromCenterFront)) as Checkpoint[] : []);
  const xs = list(f.xCheckpoints), ys = list(f.yCheckpoints);
  const stepIn = Number.isFinite(f.stepSizeInches) && (f.stepSizeInches as number) > 0 ? f.stepSizeInches as number : STEP_IN;
  if (!xs.length || !ys.length) {
    // OpenMarch's default: a high school football field, goal line to goal line (+/- 80 steps), 85.33 steps deep.
    return { cx: 80 * PX_PER_STEP, cy: 85.33 * PX_PER_STEP, hash: 'highSchool', depth: FIELD_WIDTH };
  }
  const span = (cs: Checkpoint[]) => { const v = cs.map((c) => c.stepsFromCenterFront as number); return Math.max(0, ...v) - Math.min(0, ...v); };
  const pxPerTheirStep = stepIn * PX_PER_INCH, width = span(xs) * pxPerTheirStep, height = span(ys) * pxPerTheirStep;
  const depth = height / PX_PER_STEP, wide = width / PX_PER_STEP;
  const name = typeof f.name === 'string' ? f.name : '';
  const football = /football/i.test(name) || (f.isCustom === false && f.useHashes === true);
  if (football) {
    // The hash: the front hash's distance from the front sideline, nearest of FreeFORM's three.
    const front = ys.filter((c) => typeof c.name === 'string' && /front hash/i.test(c.name) && !/grid/i.test(c.name));
    const pick = front.find((c) => c.useAsReference !== false) ?? front[0];
    const steps = pick ? (Math.abs(pick.stepsFromCenterFront as number) * stepIn) / STEP_IN : HASHES.highSchool;
    const hash = (Object.keys(HASHES) as HashPreset[]).reduce((a, b) => (Math.abs(HASHES[b] - steps) < Math.abs(HASHES[a] - steps) ? b : a));
    return { cx: width / 2, cy: height, hash, depth: FIELD_WIDTH };
  }
  const q = (n: number) => Math.min(400, Math.max(4, Math.round(n * 4) / 4));
  const court = /basketball|court/i.test(name) && Math.abs(wide - COURT.w) < 2 && Math.abs(depth - COURT.d) < 2;
  return { cx: width / 2, cy: height, hash: 'highSchool', surface: court ? COURT : { kind: 'floor', w: q(wide), d: q(depth) }, depth };
}

// ---- Pathways: sample the stretch a marcher walks, evenly by length, one spot per count.

type Seg = { type?: unknown; data?: Record<string, unknown> };
const pt = (v: unknown): Point | null => { const p = v as Point; return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null; };

/** counts + 1 points along the path from fraction `from` to `to` of its length, or null if it can't be read. */
export function sampleRoute(pathData: Value | undefined, from: number, to: number, counts: number): Point[] | null {
  const segs = (json(pathData) as { segments?: Seg[] } | null)?.segments;
  if (!Array.isArray(segs) || !segs.length || counts < 1) return null;
  const line: Point[] = [];
  for (const s of segs) {
    const pts = segmentPoints(s);
    if (!pts) return null;
    line.push(...(line.length ? pts.slice(1) : pts));
  }
  if (line.length < 2) return null;
  const len = [0];
  for (let i = 1; i < line.length; i++) len.push(len[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
  const total = len[len.length - 1];
  if (!(total > 0)) return null;
  const a = Math.min(1, Math.max(0, from)), b = Math.min(1, Math.max(0, to));
  const at = (d: number): Point => {
    let k = 1;
    while (k < len.length - 1 && len[k] < d) k++;
    const t = len[k] === len[k - 1] ? 0 : (d - len[k - 1]) / (len[k] - len[k - 1]);
    return { x: line[k - 1].x + (line[k].x - line[k - 1].x) * t, y: line[k - 1].y + (line[k].y - line[k - 1].y) * t };
  };
  return Array.from({ length: counts + 1 }, (_, k) => at(total * (a + ((b - a) * k) / counts)));
}

const STEPS = 32; // points per curved segment

function segmentPoints(s: Seg): Point[] | null {
  const d = s?.data ?? {}, start = pt(d.startPoint), end = pt(d.endPoint);
  const curve = (f: (t: number) => Point) => Array.from({ length: STEPS + 1 }, (_, k) => f(k / STEPS));
  switch (s?.type) {
    case 'line': return start && end ? [start, end] : null;
    case 'quadratic-curve': {
      const c = pt(d.controlPoint);
      if (!start || !end || !c) return null;
      return curve((t) => ({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * c.x + t * t * end.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * c.y + t * t * end.y }));
    }
    case 'cubic-curve': {
      const c1 = pt(d.controlPoint1), c2 = pt(d.controlPoint2);
      if (!start || !end || !c1 || !c2) return null;
      return curve((t) => {
        const u = 1 - t;
        return { x: u ** 3 * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x, y: u ** 3 * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y };
      });
    }
    case 'arc': return start && end ? arcPoints(start, end, Number(d.rx), Number(d.ry), Number(d.xAxisRotation) || 0, !!d.largeArcFlag, !!d.sweepFlag) : null;
    case 'spline': {
      const cps = Array.isArray(d.controlPoints) ? d.controlPoints.map(pt) : [];
      if (cps.length < 2 || cps.some((p) => !p)) return null;
      return catmullRom(cps as Point[]);
    }
    default: return null; // a kind FreeFORM doesn't know: the move stays a straight line
  }
}

/** An SVG-style elliptical arc from a to b (the endpoint-to-center conversion in the SVG spec's implementation notes). */
function arcPoints(a: Point, b: Point, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean): Point[] {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!(rx > 0 && ry > 0) || (a.x === b.x && a.y === b.y)) return [a, b];
  const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (a.x - b.x) / 2, dy = (a.y - b.y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); } // too small to reach: grow it, as SVG does
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (a.x + b.x) / 2, cy = sin * cx1 + cos * cy1 + (a.y + b.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(8, Math.ceil((Math.abs(dt) / (2 * Math.PI)) * 64));
  const out = Array.from({ length: n + 1 }, (_, k) => {
    const t = t1 + (dt * k) / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return { x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy };
  });
  out[0] = a; out[n] = b;
  return out;
}

/** A smooth curve through every point (a uniform Catmull-Rom spline). */
function catmullRom(p: Point[]): Point[] {
  const out: Point[] = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p[i + 1];
    for (let k = 1; k <= STEPS; k++) {
      const t = k / STEPS, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}
