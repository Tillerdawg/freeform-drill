import { describe, expect, it } from 'vitest';
import { pageNames, parseDots, sampleRoute } from './openmarch';
import { addSetAfter, label, moveSteps, removeSet } from './show';
import { makeDatabase } from './sqliteFixture';

// A show file shaped like OpenMarch's: its tables and columns (written here from the file, not from OpenMarch's code).
const PX = 11.25; // canvas pixels per 8-to-5 step (half a pixel per inch)
const hsField = (custom?: { name: string; w: number; d: number }) => JSON.stringify(custom
  ? { name: custom.name, isCustom: true, stepSizeInches: 22.5, xCheckpoints: [{ id: 1, name: 'left', axis: 'x', stepsFromCenterFront: -custom.w / 2 }, { id: 2, name: 'right', axis: 'x', stepsFromCenterFront: custom.w / 2 }],
    yCheckpoints: [{ id: 3, name: 'front', axis: 'y', stepsFromCenterFront: 0 }, { id: 4, name: 'back', axis: 'y', stepsFromCenterFront: -custom.d }] }
  : { name: 'High school football field (no end zones)', isCustom: false, useHashes: true, stepSizeInches: 22.5,
    xCheckpoints: Array.from({ length: 21 }, (_, k) => ({ id: k, name: `${k} line`, axis: 'x', stepsFromCenterFront: (k - 10) * 8, useAsReference: true })),
    yCheckpoints: [['front sideline', 0], ['HS front hash', -28], ['HS back hash', -56], ['grid back sideline', -85], ['real back sideline', -85.33]]
      .map(([name, s], k) => ({ id: 100 + k, name, axis: 'y', stepsFromCenterFront: s, useAsReference: true })) });
// Field point (steps from the 50, steps behind the front sideline) → canvas pixels, for a field 160 wide and 85.33 deep.
const px = (x: number, y: number, w = 160, d = 85.33) => [x * PX + (w * PX) / 2, d * PX - y * PX];

type Run = (sql: string, ...args: unknown[]) => void;
type Opts = { field?: string; audio?: Uint8Array; offset?: number; path?: string; withPath?: boolean; extra?: (run: Run) => void };
function dots({ field = hsField(), audio, offset = 0, path, withPath = false, extra }: Opts = {}) {
  return makeDatabase((run) => {
    run('CREATE TABLE `beats` (`id` integer PRIMARY KEY NOT NULL, `duration` real NOT NULL, `position` integer NOT NULL, `include_in_measure` integer DEFAULT 1 NOT NULL, `notes` text, `created_at` text, `updated_at` text)');
    run('CREATE TABLE `pages` (`id` integer PRIMARY KEY NOT NULL, `is_subset` integer DEFAULT 0 NOT NULL, `notes` text, `created_at` text, `updated_at` text, `start_beat` integer NOT NULL)');
    run('CREATE TABLE `marchers` (`id` integer PRIMARY KEY NOT NULL, `name` text, `section` text NOT NULL, `year` text, `notes` text, `drill_prefix` text NOT NULL, `drill_order` integer NOT NULL, `created_at` text, `updated_at` text)');
    run('CREATE TABLE `marcher_pages` (`id` integer PRIMARY KEY NOT NULL, `marcher_id` integer NOT NULL, `page_id` integer NOT NULL, `x` real NOT NULL, `y` real NOT NULL, `created_at` text, `updated_at` text, `path_data_id` integer, `path_start_position` real, `path_end_position` real, `notes` text, `rotation_degrees` real DEFAULT 0 NOT NULL)');
    run('CREATE TABLE `pathways` (`id` integer PRIMARY KEY NOT NULL, `path_data` text NOT NULL, `notes` text, `created_at` text, `updated_at` text)');
    run('CREATE TABLE `measures` (`id` integer PRIMARY KEY NOT NULL, `start_beat` integer NOT NULL, `rehearsal_mark` text, `notes` text, `created_at` text, `updated_at` text)');
    run('CREATE TABLE `field_properties` (`id` integer PRIMARY KEY NOT NULL, `json_data` text NOT NULL, `image` blob)');
    run('CREATE TABLE `utility` (`id` integer PRIMARY KEY NOT NULL, `last_page_counts` integer DEFAULT 8 NOT NULL, `default_beat_duration` real DEFAULT 0.5 NOT NULL, `updated_at` text)');
    run('CREATE TABLE `workspace_settings` (`id` integer PRIMARY KEY NOT NULL, `json_data` text NOT NULL, `created_at` text, `updated_at` text)');
    run('CREATE TABLE `audio_files` (`id` integer PRIMARY KEY NOT NULL, `path` text NOT NULL, `nickname` text, `data` blob, `selected` integer DEFAULT 0 NOT NULL, `created_at` text, `updated_at` text)');
    run('INSERT INTO field_properties (id, json_data) VALUES (1, ?)', field);
    run('INSERT INTO utility (id, last_page_counts) VALUES (0, 4)');
    run('INSERT INTO workspace_settings (id, json_data) VALUES (1, ?)', JSON.stringify({ pageNumberOffset: 0, measurementOffset: 1, audioOffsetSeconds: offset }));
    // 41 beats at 120 bpm, written out of order (position decides).
    for (let k = 40; k >= 0; k--) run('INSERT INTO beats (id, duration, position) VALUES (?, 0.5, ?)', k + 100, k);
    // Pages 0 (beat 0), 1 (beat 1, 8 counts), 1A (beat 9, 8 counts), 2 (beat 17, the last: 4 counts).
    run("INSERT INTO pages (id, is_subset, start_beat, notes) VALUES (0, 0, 100, 'Opener')");
    run('INSERT INTO pages (id, is_subset, start_beat) VALUES (2, 0, 101)');
    run('INSERT INTO pages (id, is_subset, start_beat) VALUES (3, 1, 109)');
    run("INSERT INTO pages (id, is_subset, start_beat, notes) VALUES (4, 0, 117, 'Hit')");
    // 4/4 bars from beat 1: m. 1 = beats 1–4, m. 2 = 5–8 …
    for (let m = 0; m < 10; m++) run('INSERT INTO measures (start_beat) VALUES (?)', 101 + m * 4);
    run("INSERT INTO marchers (id, name, section, drill_prefix, drill_order) VALUES (1, 'Ada Lovelace', 'Trumpet', 'T', 1)");
    run("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (2, 'Trumpet', 'T', 2)");
    run("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (3, 'Color Guard', 'G', 7)");
    run("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (4, 'Color Guard', 'R', 1)"); // a second prefix in one section
    const at = (m: number, page: number, x: number, y: number, extra: [number | null, number | null, number | null] = [null, null, null]) => {
      const [a, b] = px(x, y);
      run('INSERT INTO marcher_pages (marcher_id, page_id, x, y, path_data_id, path_start_position, path_end_position) VALUES (?, ?, ?, ?, ?, ?, ?)', m, page, a, b, ...extra);
    };
    for (const m of [1, 2, 3, 4]) at(m, 0, -16 + m * 4, 28); // across the front hash, Side 1 to Side 2
    for (const m of [1, 2, 3, 4]) at(m, 2, -16 + m * 4, 36);
    at(1, 3, -12, 44, withPath ? [1, 0, 1] : [null, null, null]); // T1 goes around a half circle to 8 steps further back
    for (const m of [2, 3, 4]) at(m, 3, -16 + m * 4, 44);
    for (const m of [1, 2, 3, 4]) at(m, 4, -16 + m * 4, 44); // a hold
    if (withPath) {
      const [sx, sy] = px(-12, 36), [ex, ey] = px(-12, 44);
      run('INSERT INTO pathways (id, path_data) VALUES (1, ?)', path ?? JSON.stringify({ segments: [{ type: 'arc', data: { startPoint: { x: sx, y: sy }, rx: 4 * PX, ry: 4 * PX, xAxisRotation: 0, largeArcFlag: 0, sweepFlag: 1, endPoint: { x: ex, y: ey } } }] }));
    }
    if (audio) run("INSERT INTO audio_files (path, nickname, data, selected) VALUES ('C:\\\\Shows\\\\closer.mp3', NULL, ?, 1)", audio);
    extra?.(run as Run);
  });
}

// An indoor floor laid out the way OpenMarch's "Indoor 50x70 - 24-inch steps" is: 35 by 25 of its 24-inch steps,
// lines every 4 steps across (5 line in the middle) and lettered lines front to back (A line half a step in).
const indoorField = JSON.stringify({ name: 'Indoor 50x70 - 24-inch steps', isCustom: false, useHashes: false, stepSizeInches: 24,
  xCheckpoints: [['5 line', 0], ['Left Edge', -17.5], ['Right Edge', 17.5], ['4 line', 4], ['4 line', -4], ['1 line', 16], ['1 line', -16]]
    .map(([name, s], k) => ({ id: k, name, axis: 'x', stepsFromCenterFront: s, useAsReference: true })),
  yCheckpoints: [['Front edge', 0], ['Back edge', -25], ['A line', -0.5], ['C line', -8.5], ['G line', -24.5]]
    .map(([name, s], k) => ({ id: 100 + k, name, axis: 'y', stepsFromCenterFront: s, useAsReference: true })) });

describe('OpenMarch import', () => {
  it('brings in performers, sets named as OpenMarch names them, counts, measures, notes, and spots', async () => {
    const { show, audio } = parseDots(await dots(), 'Closer');
    expect(audio).toBeUndefined();
    expect(show.title).toBe('Closer');
    expect(show.hash).toBe('highSchool');
    expect(show.sets.map((s) => [s.name, s.counts, s.measures ?? '', s.note ?? ''])).toEqual([['0', 0, '', 'Opener'], ['1', 8, '1–2', ''], ['1A', 8, '3–4', ''], ['2', 4, '5', 'Hit']]);
    expect(show.sections.map((s) => [s.name, s.letter])).toEqual([['Trumpet', 'T'], ['Color Guard (G)', 'G'], ['Color Guard (R)', 'R']]);
    const by = Object.fromEntries(show.performers.map((p) => [label(show, p), p]));
    expect(Object.keys(by).sort()).toEqual(['G7', 'R1', 'T1', 'T2']);
    expect(by.T1.name).toBe('Ada Lovelace');
    const at = (l: string, set: number) => { const q = show.sets[set].pos[by[l].id]; return { x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 }; };
    expect(at('T1', 0)).toEqual({ x: -12, y: 28 }); // 12 steps Side 1 of the 50, on the front hash
    expect(at('R1', 3)).toEqual({ x: 0, y: 44 });
    expect(show.sets[2].paths).toBeUndefined(); // straight moves stay plain
  });

  it("keeps OpenMarch's set names when sets are added or deleted (set 0 stays 0)", async () => {
    const { show } = parseDots(await dots(), 'Closer');
    expect(show.setNaming).toBe('manual');
    const names = (s: typeof show) => s.sets.map((x) => x.name);
    expect(names(addSetAfter(show, 3))).toEqual(['0', '1', '1A', '2', '3']);
    expect(names(removeSet(show, 2))).toEqual(['0', '1', '2']);
  });

  it("brings a pathway in as an even, count-by-count route that ends on the performer's spots", async () => {
    const { show } = parseDots(await dots({ withPath: true }));
    const t1 = show.performers.find((p) => label(show, p) === 'T1')!.id, path = show.sets[2].paths?.[t1];
    expect(path).toHaveLength(9);
    expect(path![0]).toEqual(show.sets[1].pos[t1]);
    expect(path![8]).toEqual(show.sets[2].pos[t1]);
    const steps = path!.slice(1).map((q, k) => Math.hypot(q.x - path![k].x, q.y - path![k].y));
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.01); // even steps
    expect(Math.min(...path!.map((q) => q.x))).toBeLessThan(-15.5); // sweep 1 is clockwise on screen: around the half circle on the Side 1 side
    expect(moveSteps(show, 2)[t1].per5).toBeCloseTo(8 / ((4 * Math.PI) / 8), 1); // the arc's length, not the 8-step straight line
  });

  it('a pathway FreeFORM cannot read leaves the move straight', async () => {
    const { show } = parseDots(await dots({ withPath: true, path: '{"segments":[{"type":"mystery","data":{}}]}' }));
    expect(show.sets[2].paths).toBeUndefined();
  });

  it('brings the recording in, timed to the beats (count 0 where the first move starts)', async () => {
    const r = parseDots(await dots({ audio: new Uint8Array([9, 8, 7]), offset: 0.25 }));
    expect(r.audio?.size).toBe(3);
    expect(r.audio?.type).toBe('audio/mpeg');
    expect(r.show.music?.name).toBe('closer.mp3');
    // Beat 1 starts at 0.5 s; the recording starts 0.25 s into the show.
    expect(r.show.music?.taps.slice(0, 3)).toEqual([0.25, 0.75, 1.25]);
    expect(r.show.music?.taps).toHaveLength(41);
  });

  it('a custom floor becomes a floor of the same size', async () => {
    const { show } = parseDots(await dots({ field: hsField({ name: 'Gym', w: 160, d: 85.33 }) }));
    expect(show.surface).toEqual({ kind: 'floor', w: 160, d: 85.25 });
  });

  it('an indoor floor in 24-inch steps becomes an 8-to-5 floor of the same real size, dots and all', async () => {
    const { show } = parseDots(await dots({ field: indoorField, extra: (run) => {
      // A third guard prefix and an unnamed drum numbered 0, each standing on the 4 line (Side 2), C line on every page.
      // The floor is 35 * 12 = 420 pixels wide and 25 * 12 = 300 deep, so that spot is (210 + 4 * 12, 300 - 8.5 * 12).
      run("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (5, 'Color Guard', 'C', 14)");
      run("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (6, 'Bass Drum', 'B', 0)");
      for (const m of [5, 6]) for (const page of [0, 2, 3, 4]) run('INSERT INTO marcher_pages (marcher_id, page_id, x, y) VALUES (?, ?, 258, 198)', m, page);
    } }));
    // 35 * 24 / 22.5 = 37.33 and 25 * 24 / 22.5 = 26.67 steps, to the nearest quarter step.
    expect(show.surface).toEqual({ kind: 'floor', w: 37.25, d: 26.75 });
    expect(show.sections.map((s) => s.name)).toEqual(['Trumpet', 'Bass Drum', 'Color Guard (C)', 'Color Guard (G)', 'Color Guard (R)']); // score order
    const by = Object.fromEntries(show.performers.map((p) => [label(show, p), p]));
    expect(by.B0.name).toBeUndefined();
    for (const l of ['B0', 'C14']) for (const set of show.sets) {
      const q = set.pos[by[l].id];
      expect(q.x).toBeCloseTo((4 * 24) / 22.5, 6); // 4 of their steps is 4.27 of ours
      expect(q.y).toBeCloseTo((8.5 * 24) / 22.5, 6);
    }
  });

  it('turns away files that are not OpenMarch shows', async () => {
    expect(() => parseDots(new TextEncoder().encode('{"format":"freeform-show"}'))).toThrow(/isn't an OpenMarch/);
    const other = await makeDatabase((run) => run('CREATE TABLE notes (id integer PRIMARY KEY, body text)'));
    expect(() => parseDots(other)).toThrow(/isn't an OpenMarch \(\.dots\) show file/);
  });

  it('names pages the way OpenMarch does', () => {
    expect(pageNames([false, false, true, false, true, true, false])).toEqual(['0', '1', '1A', '2', '2A', '2B', '3']);
    expect(pageNames([false, false, false], 1)).toEqual(['1', '2', '3']);
    expect(pageNames([false, ...Array(27).fill(true)]).slice(-2)).toEqual(['0Z', '0AA']);
  });

  it('samples part of a path evenly by length', () => {
    const line = JSON.stringify({ segments: [{ type: 'line', data: { startPoint: { x: 0, y: 0 }, endPoint: { x: 10, y: 0 } } }, { type: 'line', data: { startPoint: { x: 10, y: 0 }, endPoint: { x: 10, y: 10 } } }] });
    expect(sampleRoute(line, 0.25, 0.75, 2)).toEqual([{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
    expect(sampleRoute('not json', 0, 1, 4)).toBeNull();
  });
});
