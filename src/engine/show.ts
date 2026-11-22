// Show data model and the pure operations on it. All positions are in steps (see coords.ts).
import { HASHES, FIELD_WIDTH, STEP_LIMIT, distance, fieldDepth, ftlPositions, stepSize, type FieldSpec, type Floor, type HashPreset, type Point, type StepTier } from './coords';
import { assign } from './shapes';
import { validMusic, type Music } from './music';
import { validMark, type Mark } from './marks';

/** `color`: optional #rrggbb the section's dots are drawn in. */
export interface Section { id: string; name: string; letter: string; color?: string }
export const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** `name`: the person marching this dot (the roster), if assigned. */
export interface Performer { id: string; section: string; number: number; name?: string }
export const MAX_NAME = 100;

/** Assign (or, with an empty string, clear) the people on these dots. */
export const setNames = (show: Show, names: Record<string, string>): Show => ({
  ...show,
  performers: show.performers.map((p) => {
    if (!(p.id in names)) return p;
    const name = names[p.id].slice(0, MAX_NAME);
    const { name: _, ...rest } = p;
    return name.trim() ? { ...rest, name } : rest;
  }),
});

/** The same show with no people's names: for plain share links, which anyone holding the link can read. */
export const withoutNames = (show: Show): Show =>
  show.performers.some((p) => p.name) ? { ...show, performers: show.performers.map(({ name: _, ...p }) => p) } : show;
/** A set ("page"). `counts` = counts of the move INTO this set; ignored for the first set. */
/** The colors a set can be tagged with (Shubreet Kaur asked for color-coded sets, 2026-11-21). Shades: SET_COLORS in src/ui/palette.ts. */
export const SET_COLOR_NAMES = ['blue', 'purple', 'pink', 'orange', 'teal', 'gray'] as const;
export type SetColor = (typeof SET_COLOR_NAMES)[number];

export interface DrillSet {
  id: string;
  name: string;
  counts: number;
  pos: Record<string, Point>;
  /** Measures the move into this set covers, typed by the drill writer as on a score (e.g. "9–12"; a pickup bar is m. 1, as the score numbers it). */
  measures?: string;
  /**
   * Follow-the-leader groups for the move into this set. order[0] is the leader; the rest follow in order.
   * Followers' spots in this set are computed from the trail (see normalizeFtl), not placed by hand.
   */
  ftl?: { order: string[]; turns?: Point[]; smooth?: boolean }[]; // turns: the leader's turning points, in order (none = a straight leader move); smooth: a curve through them. A group of one is a performer's own route.
  /** Page markup shown on this set only: notes, arrows, freehand drawing. */
  marks?: Mark[];
  /** A note for the whole set, printed under its chart. */
  note?: string;
  /** A color the drill writer gives the set, to group sets their own way (the timeline shows it). Only a name; the shade is the palette's. */
  color?: SetColor;
  /** Per-performer cue for this set ("Slide L, horns 45"), printed on their dot sheet. */
  cues?: Record<string, string>;
  /** Label sides pinned by the drill writer for this set's picture; everyone else's label is placed automatically. */
  labels?: Record<string, LabelSide>;
  /**
   * Count-by-count spots for performers whose move into this set isn't a straight line (imported from Pyware's
   * per-count pages: follow-the-leader, delayed step-offs, rotations). path[k] = spot on count k, from the previous
   * set (k = 0) to this one (k = counts). Used only while both ends still match: editing either set or the counts falls
   * back to a straight line (the editor says so, and Review lists it; see brokenPaths). Kept, so moving back restores it.
   */
  paths?: Record<string, Point[]>;
  /** Delayed step-offs: hold `wait` counts, then move `move` counts (any counts left over are a hold at the end). Missing = moves all counts. */
  timing?: Record<string, { wait: number; move: number }>;
  /** Groups whose move into this set turns (a gate turn, a pivot): each member marches an arc around the one turn that best carries the group from its old spots to its new ones. */
  turning?: string[][];
  /** Where each prop is in this set (every prop has a spot in every set, like performers). */
  props?: Record<string, PropSpot>;
}

/**
 * A prop on the field (a platform, a backdrop): a rectangle or an oval (`round`) `w` steps side to side and `h` front to back, or a triangle
 * (`triangle`). A triangle is set by its three sides. Side 1 is `w` steps long and runs side to side along the front, until it's turned;
 * the corner across from it is `h` steps behind it, `point` × w from side 1's left end (missing means the middle; below 0 or past 1 when
 * the triangle leans out past an end of side 1). Side 2 runs from side 1's left end to that corner, side 3 from its right end. A triangle's
 * center is the middle of the box around it.
 */
export interface Prop { id: string; name: string; w: number; h: number; round?: boolean; triangle?: boolean; point?: number }
export type PropShape = 'rectangle' | 'oval' | 'triangle';
export const propShape = (p: Pick<Prop, 'round' | 'triangle'>): PropShape => (p.triangle ? 'triangle' : p.round ? 'oval' : 'rectangle');
/** The patch that makes a prop this shape (older files only know `round`, so ovals stay `round`). */
export const shapePatch = (shape: PropShape): Pick<Prop, 'round' | 'triangle' | 'point'> =>
  ({ round: shape === 'oval' || undefined, triangle: shape === 'triangle' || undefined, ...(shape === 'triangle' ? {} : { point: undefined }) });

/** A triangle prop's corners in its own frame (steps, y toward the back), around its center: side 1's left end, its right end, the far corner. */
export function triangleCorners(p: Pick<Prop, 'w' | 'h' | 'point'>): [Point, Point, Point] {
  const x = (p.point ?? 0.5) * p.w, mid = (Math.min(0, x) + Math.max(p.w, x)) / 2;
  return [{ x: -mid, y: -p.h / 2 }, { x: p.w - mid, y: -p.h / 2 }, { x: x - mid, y: p.h / 2 }];
}

/** A triangle prop's sides 1, 2, and 3, in steps. */
export function triangleSides(p: Pick<Prop, 'w' | 'h' | 'point'>): [number, number, number] {
  const x = (p.point ?? 0.5) * p.w;
  return [p.w, Math.hypot(x, p.h), Math.hypot(p.w - x, p.h)];
}

/** The widest a triangle prop's box may be, in steps (as for Wide). */
export const MAX_PROP_SIZE = 200;
/** How wide a triangle prop's box is, in steps. */
export const triangleWidth = (p: Pick<Prop, 'w' | 'point'>) => { const x = (p.point ?? 0.5) * p.w; return Math.max(p.w, x) - Math.min(0, x); };

/** The triangle with sides 1, 2, and 3 (in steps), or a sentence saying why there isn't one. */
export function triangleFromSides(s1: number, s2: number, s3: number): { w: number; h: number; point: number | undefined } | string {
  const sides = [s1, s2, s3];
  if (!sides.every((n) => Number.isFinite(n) && n > 0)) return 'Each side needs a length.';
  if (Math.max(...sides) * 2 >= s1 + s2 + s3 - 1e-9) return 'Those sides don\'t make a triangle: the longest side has to be shorter than the other two put together.';
  const x = (s1 * s1 + s2 * s2 - s3 * s3) / (2 * s1), h = Math.sqrt(Math.max(0, s2 * s2 - x * x)), point = x / s1;
  const t = { w: s1, h, point: Math.abs(point - 0.5) < 1e-9 ? undefined : point };
  if (triangleWidth(t) > MAX_PROP_SIZE || h > MAX_PROP_SIZE) return `That's bigger than a prop can be (${MAX_PROP_SIZE} steps across).`;
  return t;
}

/** A prop's center and its turn in degrees (counterclockwise as the director sees it). */
export interface PropSpot { x: number; y: number; angle: number }
export const MAX_PROPS = 100;


/** Sides are on the field: "above" = toward the back sideline (up on the editor's screen). */
export type LabelSide = 'above' | 'above-right' | 'right' | 'below-right' | 'below' | 'below-left' | 'left' | 'above-left' | 'hidden';
export const LABEL_SIDES: LabelSide[] = ['above', 'above-right', 'right', 'below-right', 'below', 'below-left', 'left', 'above-left', 'hidden'];
export interface Show {
  format: 'freeform-show';
  version: 1;
  /** A permanent random id, made when the show is first created and kept forever (copies made with Duplicate get a new one),
   * so phones can tell two shows with the same title apart. Shows from before ids have none. */
  id?: string;
  title: string;
  hash: HashPreset;
  sections: Section[];
  performers: Performer[];
  sets: DrillSet[];
  /** The show's recording and the tapped count timings (the audio itself stays in the browser). */
  music?: Music;
  /** Goes up by one each time the show is published to phones (or a locked file is downloaded), so paper and phones can be compared. */
  revision?: number;
  /** A fingerprint of the drill (drillSig) when `revision` went out, so paper printed after later edits can say so. */
  revisionSig?: string;
  /** How performers are drawn: their section letter with the number as the label (default), or 'dots' with the full label. */
  symbols?: 'dots';
  /** Count-first layout: the show's music in named stretches (one per tune, or one for a one-tune file), typed up front.
   * The timeline runs to their total even before every set is written; past the last set, performers hold. */
  movements?: Movement[];
  /** Props: shapes on the field that can sit somewhere new in each set and move between sets. */
  props?: Prop[];
  /** A picture under the field to trace (a logo, a sketch): centered on (x, y), `w` steps wide. The picture itself stays in the browser that added it. */
  trace?: Trace;
  /** An indoor surface instead of the football field; `hash` is kept (and used again) if the show goes back outside. */
  surface?: Floor;
  /** The biggest step allowed, as N-to-5: a step bigger than a `stepLimit`-to-5 is red and listed in Review. Missing = STEP_LIMIT (4). */
  stepLimit?: number;
  /** Review warnings the director has looked at and dismissed (see issueKey in review.ts). */
  dismissed?: string[];
  /** 'manual' once the director names a set by hand: adding or deleting a set then leaves every other set's name alone.
   * Missing = automatic (sets are renumbered 1, 1A, 2… as they're added and deleted). numberSetsInOrder turns it back on. */
  setNaming?: 'manual';
}

/** What the show is written on: its floor, or the football field with its hashes. */
export const fieldOf = (show: Show): FieldSpec => show.surface ?? show.hash;

export interface Trace { id: string; x: number; y: number; w: number; opacity: number }

export interface Movement { id: string; name: string; counts: number }
export const MAX_MOVEMENT = 100_000;
/** The step limits a show can set: from a 2-to-5 (huge) to an 8-to-5 (flag any step bigger than standard). */
export const MIN_STEP_LIMIT = 2, MAX_STEP_LIMIT = 8;

/** A new show's permanent id: 16 random bytes as hex (getRandomValues works on plain-http pages too, unlike randomUUID). */
export const newShowId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
/** The show with an id, making one if it has none (an older file, or an import). */
export const withShowId = (show: Show): Show => (show.id ? show : { ...show, id: newShowId() });

let seq = 0;
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export type SectionList = { name: string; letter: string; color?: string }[];

/** FreeFORM's starting sections (Jason's lettering). No front ensemble: they're stationary, so they need no drill spots. */
export const DEFAULT_SECTIONS: SectionList = ([
  ['Flute', 'F'], ['Clarinet', 'K'], ['Alto Saxophone', 'A'], ['Tenor Saxophone', 'X'], ['Trumpet', 'P'], ['Mellophone', 'H'],
  ['Trombone', 'N'], ['Baritone', 'E'], ['Tuba', 'T'], ['Snare Drum', 'S'], ['Quads', 'Q'], ['Bass Drum', 'B'], ['Cymbals', 'C'],
  ['Color Guard', 'G'],
] as const).map(([name, letter]) => ({ name, letter }));

/** A starting list saved from a file or storage: kept only if it's a non-empty list of names and letters, no letter used twice. */
export function validSectionList(x: unknown): SectionList | null {
  if (!Array.isArray(x) || !x.length || x.length > 100) return null;
  return x.every((s) => typeof s?.name === 'string' && typeof s?.letter === 'string' && s.name.trim() && s.letter.trim()
    && (s.color === undefined || (typeof s.color === 'string' && COLOR_RE.test(s.color))))
    && !sectionListProblems(x).some(Boolean)
    ? x.map((s) => ({ name: s.name, letter: s.letter, ...(s.color ? { color: s.color } : {}) })) : null;
}

/** The longest a section letter can be: one letter is usual, but a drill writer can use up to three (TP, SN). */
export const MAX_LETTER = 3;

/**
 * Why a section can't take this letter, in words, or null if it can. A letter belongs to one section (Jason): two
 * sections with the same letter would both have an A1. Capitals don't matter (a and A are the same letter).
 * `except`: the index of the section being changed, so its own letter isn't counted against it.
 */
export function letterProblem(sections: readonly { name: string; letter: string }[], letter: string, except = -1): string | null {
  const k = letter.trim().toUpperCase();
  if (!k) return 'Give it a letter.';
  const other = sections.find((x, i) => i !== except && x.letter.trim().toUpperCase() === k);
  return other ? `"${letter.trim()}" is already the letter for ${other.name.trim() || 'another section'}. Each section needs its own.` : null;
}

/** For a list being typed (New show, Enter section counts): each row's problem in words, or null. */
export function sectionListProblems(list: readonly { name: string; letter: string }[]): (string | null)[] {
  return list.map((x, i) => (!x.name.trim() ? 'Give it a name.' : letterProblem(list, x.letter, i)));
}

/** A new show, on a football field (high school hashes unless `field` says otherwise) or the floor `field` names. */
/**
 * Nothing written in it yet: no performers, props, recording, tracing picture, or music layout, and one set with no
 * markup or note. Only such a show may be dropped from the library without asking (the blank show a first visit opens).
 * A show with a prop, a second set, or a note is a draft, even with no performers.
 */
export const isBlankShow = (s: Show): boolean => !s.performers.length && !s.props?.length && !s.music && !s.trace && !s.movements?.length
  && s.sets.length <= 1 && !s.sets.some((x) => x.marks?.length || x.note);

export function newShow(sections: SectionList = DEFAULT_SECTIONS, field: FieldSpec = 'highSchool'): Show {
  return withField({
    format: 'freeform-show',
    version: 1,
    id: newShowId(),
    title: 'Untitled show',
    hash: 'highSchool',
    sections: sections.map(({ name, letter, color }) => ({ id: newId('s'), name, letter, ...(color ? { color } : {}) })),
    performers: [],
    sets: [{ id: newId('set'), name: '1', counts: 0, pos: {} }],
  }, field);
}

/**
 * The show written on `field` instead, with everyone keeping their spots in steps. Meant for a show with no drill yet
 * (a new show, a blank field): changing the hashes under written drill goes through remapHash instead.
 */
export function withField(show: Show, field: FieldSpec): Show {
  if (typeof field !== 'string') return { ...show, surface: { ...field } };
  const { surface: _, ...rest } = show;
  return { ...rest, hash: field };
}

/** What a show can be written on, as saved for the next new show: kept only if it's a hash level or a sensibly sized floor. */
export function validField(x: unknown): FieldSpec | null {
  if (typeof x === 'string') return Object.hasOwn(HASHES, x) ? x as HashPreset : null;
  const f = x as Floor | null;
  return (f?.kind === 'court' || f?.kind === 'floor') && Number.isFinite(f.w) && f.w >= 4 && f.w <= 400 && Number.isFinite(f.d) && f.d >= 4 && f.d <= 400
    ? { kind: f.kind, w: f.w, d: f.d } : null;
}

/** The color a performer's section is drawn in, if it has one. */
export const colorOf = (show: Show, p: Performer) => show.sections.find((s) => s.id === p.section)?.color;

export function label(show: Show, p: Performer) {
  return `${show.sections.find((s) => s.id === p.section)?.letter ?? '?'}${p.number}`;
}

/** What marks a performer on a chart: their section letter (centered on the spot) labeled with the number, or a dot labeled P4. */
export function mark(show: Show, p: Performer): { glyph?: string; label: string } {
  return show.symbols === 'dots' ? { label: label(show, p) } : { glyph: show.sections.find((s) => s.id === p.section)?.letter ?? '?', label: String(p.number) };
}

const mapSet = (show: Show, i: number, f: (s: DrillSet) => DrillSet): Show => ({
  ...show,
  sets: show.sets.map((s, j) => (j === i ? f(s) : s)),
});

/** Adds a performer; it gets `at` in every set so it exists for the whole show. */
/**
 * A first formation from section counts (the first-run screen's "Enter section counts", borrowed from the other
 * Freeform repo's setup): each section in its own rows of up to 8, 2 steps apart, sections in the order given from
 * the front, starting on the front hash (a floor: 8 steps from the front edge), centered on the 50. Every set gets the
 * same spots, like Add. Returns the new performers' ids.
 */
export function placeSectionCounts(show: Show, counts: { section: string; n: number }[], perRow = 8): { show: Show; ids: string[] } {
  const ids: string[] = [];
  let y = show.surface ? 8 : HASHES[show.hash];
  for (const { section, n } of counts) {
    const k = Math.max(0, Math.floor(n));
    for (let i = 0; i < k; i += perRow) {
      const inRow = Math.min(perRow, k - i);
      for (let j = 0; j < inRow; j++) {
        const r = addPerformer(show, section, { x: (j - (inRow - 1) / 2) * 2, y });
        show = r.show; ids.push(r.id);
      }
      y += 2;
    }
  }
  return { show, ids };
}

export function addPerformer(show: Show, section: string, at: Point): { show: Show; id: string } {
  const id = newId('p');
  const number = Math.max(0, ...show.performers.filter((p) => p.section === section).map((p) => p.number)) + 1;
  return {
    id,
    show: {
      ...show,
      performers: [...show.performers, { id, section, number }],
      sets: show.sets.map((s) => ({ ...s, pos: { ...s.pos, [id]: at } })),
    },
  };
}

/**
 * Move performers to another section. They're numbered after the section's current members, in their old label
 * order (B1, B2… become T4, T5… when T1–T3 exist), so nobody in the section changes label.
 */
export function moveToSection(show: Show, ids: string[], section: string): Show {
  if (!show.sections.some((s) => s.id === section)) return show;
  const moving = show.performers.filter((p) => ids.includes(p.id) && p.section !== section)
    .sort((a, b) => show.sections.findIndex((s) => s.id === a.section) - show.sections.findIndex((s) => s.id === b.section) || a.number - b.number);
  let next = Math.max(0, ...show.performers.filter((p) => p.section === section).map((p) => p.number));
  const renumber = new Map(moving.map((p) => [p.id, ++next]));
  return { ...show, performers: show.performers.map((p) => (renumber.has(p.id) ? { ...p, section, number: renumber.get(p.id)! } : p)) };
}

/**
 * Number a section's performers 1…n: 'number' keeps their order and closes the gaps (X4 X5 X6 → X1 X2 X3);
 * 'field' goes from Side 1 to Side 2 as they stand in set `setIndex`, front to back where they line up;
 * 'ranks' goes front to back, rank by rank, each rank from Side 1 to Side 2.
 */
export function renumberSection(show: Show, section: string, by: 'number' | 'field' | 'ranks', setIndex = 0): Show {
  const pos = show.sets[setIndex]?.pos ?? {};
  const members = show.performers.filter((p) => p.section === section);
  const at = (p: Performer) => pos[p.id] ?? { x: Infinity, y: Infinity };
  const order = by === 'number' ? [...members].sort((a, b) => a.number - b.number)
    : by === 'ranks' ? [...members].sort((a, b) => Math.round(at(a).y) - Math.round(at(b).y) || at(a).x - at(b).x || a.number - b.number) // a rank = same step from the front, within half a step
    : [...members].sort((a, b) => at(a).x - at(b).x || at(a).y - at(b).y || a.number - b.number);
  const n = new Map(order.map((p, i) => [p.id, i + 1]));
  return { ...show, performers: show.performers.map((p) => (n.has(p.id) ? { ...p, number: n.get(p.id)! } : p)) };
}

/** Remove a section. Its performers move to `moveTo` first; with no `moveTo`, only an empty section can go. */
export function removeSection(show: Show, id: string, moveTo?: string): Show {
  const members = show.performers.filter((p) => p.section === id).map((p) => p.id);
  if (members.length && (!moveTo || moveTo === id)) throw new Error('Choose a section for its performers first.');
  if (show.sections.length < 2) throw new Error('A show needs at least one section.');
  const moved = members.length ? moveToSection(show, members, moveTo!) : show;
  return { ...moved, sections: moved.sections.filter((s) => s.id !== id) };
}

/**
 * Sections in score order: woodwinds, brass, battery (in FreeFORM's starting order), front ensemble, then the guard.
 * Sections whose names match no instrument go last, in the order they had. Sax and drum names are matched first so a
 * "Tenor Sax" isn't read as a tenor drum or a "Bass Clarinet" as a bass drum.
 */
const SCORE_ORDER: RegExp[] = [/piccolo/i, /flute/i, /oboe/i, /bassoon/i, /e-?flat clar|eb clar/i, /bass clar/i, /clarinet/i, /soprano sax/i,
  /alto sax/i, /tenor sax/i, /bari(tone)? sax/i, /sax/i, /trumpet|cornet|flugel/i, /mello|french horn|^horn/i, /trombone/i,
  /baritone|euphonium/i, /tuba|sousa/i, /snare/i, /quad|tenor|quint|tom/i, /bass drum|^bass(es)?$/i, /cymbal/i, /battery|percussion|drum(?! major)/i,
  /front|pit|marimba|xylo|vibe|keyboard|synth|mallet|timpani/i, /drum major/i, /guard|flag|rifle|sabre|saber|dance/i];
export function scoreOrder<T extends { name: string }>(sections: T[]): T[] {
  const rank = (s: T) => { const i = SCORE_ORDER.findIndex((r) => r.test(s.name)); return i < 0 ? SCORE_ORDER.length : i; };
  return sections.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}

/** Section letters used by more than one section (their labels would clash: two "A1"s). */
export const duplicateLetters = (show: Show) => {
  const seen = new Map<string, number>();
  for (const s of show.sections) { const k = s.letter.trim().toUpperCase(); seen.set(k, (seen.get(k) ?? 0) + 1); }
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
};

export function removePerformers(show: Show, ids: Set<string>): Show {
  return {
    ...show,
    performers: show.performers.filter((p) => !ids.has(p.id)),
    sets: show.sets.map((s) => ({
      ...s,
      pos: Object.fromEntries(Object.entries(s.pos).filter(([k]) => !ids.has(k))),
      cues: s.cues && Object.fromEntries(Object.entries(s.cues).filter(([k]) => !ids.has(k))),
      labels: s.labels && Object.fromEntries(Object.entries(s.labels).filter(([k]) => !ids.has(k))),
      timing: s.timing && Object.fromEntries(Object.entries(s.timing).filter(([k]) => !ids.has(k))),
      turning: s.turning?.map((g) => g.filter((id) => !ids.has(id))).filter((g) => g.length > 1),
    })),
  };
}

/**
 * Sets positions in set `i` for the given performers. A performer who was holding (standing still) from set i into
 * later sets goes along: each later set where they still stood on their old set-i spot gets the new spot too, up to
 * the first set where they'd been placed somewhere else. Holds are judged from `base`, the show before the edit began
 * (a drag passes the show from when it started, so passing over a later spot mid-drag doesn't pick it up).
 */
export function placeInSet(show: Show, i: number, moves: Record<string, Point>, base: Show = show): Show {
  const was = base.sets[i]?.pos ?? {};
  const held = (j: number, id: string) => { const p = base.sets[j]?.pos[id], q = was[id]; return !!p && !!q && p.x === q.x && p.y === q.y; };
  return { ...show, sets: show.sets.map((s, j) => {
    if (j < i) return s;
    const follow = j === i ? moves : Object.fromEntries(Object.entries(moves).filter(([id]) => {
      for (let k = i + 1; k <= j; k++) if (!held(k, id)) return false;
      return true;
    }));
    return Object.keys(follow).length ? { ...s, pos: { ...s.pos, ...follow } } : s;
  }) };
}

/** New set after `i`, starting as a copy of set i's positions. */
export function addSetAfter(show: Show, i: number, counts = 16): Show {
  const src = show.sets[i];
  const names = new Set(show.sets.map((s) => s.name));
  let n = show.sets.length + 1;
  while (names.has(String(n))) n++;
  if (show.setNaming === 'manual') { // the next number after this set's if it's free (after 7, 8), or a sub-set (7A)
    const next = String(parseInt(src.name, 10) + 1);
    n = /^\d+$/.test(next) && !names.has(next) ? Number(next) : NaN;
  }
  const name = Number.isNaN(n) ? subSetName(names, src.name) : String(n);
  const sets = [...show.sets];
  sets.splice(i + 1, 0, { id: newId('set'), name, counts, pos: { ...src.pos }, ...(src.props ? { props: { ...src.props } } : {}) });
  return renumberSets({ ...show, sets }); // added mid-show: later sets move up a number
}

export function removeSet(show: Show, i: number): Show {
  if (show.sets.length <= 1) return show;
  return renumberSets({ ...show, sets: show.sets.filter((_, j) => j !== i) }); // no gap left behind
}

export const setCounts = (show: Show, i: number, counts: number): Show =>
  mapSet(show, i, (s) => ({ ...s, counts: Math.max(1, Math.round(counts)) }));

// ---- Timeline. Time is measured in counts from the start of the show (set 1 = count 0).

/** starts[i] = the count at which set i is reached. */
export function setStarts(show: Show): number[] {
  const starts = [0];
  for (let i = 1; i < show.sets.length; i++) starts.push(starts[i - 1] + show.sets[i].counts);
  return starts;
}

export const totalCounts = (show: Show) => setStarts(show).at(-1)!;

/** A sub-set's name, as in Pyware: after 4 comes 4A, after 4A comes 4B (not 4AA); skips names in use. */
export function subSetName(names: Set<string>, before: string): string {
  const base = before.replace(/[A-Z]+$/, '');
  let k = 0, name = '';
  do name = `${base}${String.fromCharCode(65 + k++)}`; while (names.has(name) && k < 26);
  return name;
}

/**
 * Name the sets in order (adding and deleting sets do this automatically): main sets 1, 2, 3…, and sub-sets (4A) lettered A, B… after
 * the set before them. Names that aren't a number stay as they are. Does nothing once a set has been named by hand
 * (setNaming 'manual'). Returns the same show if nothing changes.
 */
export function renumberSets(show: Show): Show {
  if (show.setNaming === 'manual') return show; // the director names them
  let n = 0, k = 0;
  const names = show.sets.map((s) => {
    const sub = /^\d+([A-Z]+)?$/.exec(s.name);
    if (!sub) return s.name;
    if (sub[1] && n) return `${n}${String.fromCharCode(65 + Math.min(k++, 25))}`;
    n++; k = 0;
    return String(n);
  });
  return names.every((x, i) => x === show.sets[i].name) ? show : { ...show, sets: show.sets.map((s, i) => ({ ...s, name: names[i] })) };
}

/** The longest set name you can type: it has to fit the toolbar, the timeline, dot sheets, and the phone's set chips. */
export const MAX_SET_NAME = 8;

/**
 * Name set i by hand (Eli Williams asked, 2026-11-17: write the end picture first, then add sets where needed and number
 * them yourself). Trimmed; must be 1 to MAX_SET_NAME characters and not another set's name. Naming a set turns off
 * automatic renumbering for the show (setNaming 'manual'), so adding a set later doesn't undo it.
 */
export function renameSet(show: Show, i: number, typed: string): { show: Show } | { error: string } {
  const name = typed.trim().replace(/\s+/g, ' ');
  if (!show.sets[i]) return { error: 'There is no such set.' };
  if (!name) return { error: 'A set needs a name.' };
  if (name.length > MAX_SET_NAME) return { error: `Set names can be up to ${MAX_SET_NAME} characters.` };
  if (show.sets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) return { error: `There's already a set ${name}.` };
  if (name === show.sets[i].name) return { show };
  return { show: { ...mapSet(show, i, (s) => ({ ...s, name })), setNaming: 'manual' } };
}

/**
 * Renumber sets: every set gets the next whole number in order, sub-sets included (1, 1A, 1B, 2 become 1, 2, 3, 4), and
 * automatic numbering comes back on. Returns the same show if nothing changes.
 */
export function numberSetsInOrder(show: Show): Show {
  const { setNaming: _, ...auto } = show;
  return show.sets.every((s, i) => s.name === String(i + 1)) && !show.setNaming ? show
    : { ...auto, sets: show.sets.map((s, i) => (s.name === String(i + 1) ? s : { ...s, name: String(i + 1) })) };
}

/** The timeline's length: the written sets, or the movements' total if that's longer (the part not written yet). */
export const showLength = (show: Show) => Math.max(totalCounts(show), (show.movements ?? []).reduce((n, m) => n + m.counts, 0));

/** The count each movement starts on. */
export const movementStarts = (show: Show) => (show.movements ?? []).reduce<number[]>((a, m, i) => [...a, i ? a[i - 1] + show.movements![i - 1].counts : 0], []);

/** The movement a set belongs to: the one its move into it is in (a set hit on a movement's last count is in that movement). */
export const movementOfSet = (show: Show, i: number) => movementAt(show, i ? setStarts(show)[i] - 0.5 : 0);

/** The movement playing at count t (the last one that has started), or undefined. */
export function movementAt(show: Show, t: number): Movement | undefined {
  const st = movementStarts(show);
  for (let i = st.length - 1; i >= 0; i--) if (t >= st[i]) return show.movements![i];
}

/**
 * Count-first: a new set landing exactly on count `at`, with every other set staying where it is (moving a set never
 * shifts later sets). Mid-move, the move is split: the new set takes everyone's spots at that count. Past the last
 * set, it starts as a copy of the last set. `index` is the new set's index, or the existing set's if one is already there.
 */
export function insertSetAt(show: Show, at: number): { show: Show; index: number } {
  const c = Math.round(at), starts = setStarts(show);
  const hit = starts.indexOf(c);
  if (c <= 0 || hit >= 0) return { show, index: Math.max(0, hit) };
  const i = starts.findIndex((s) => s > c); // the set whose move gets split, or -1 past the end
  const names = new Set(show.sets.map((x) => x.name));
  if (i < 0) {
    const last = show.sets.length - 1;
    let n = Math.max(0, ...show.sets.map((x) => parseInt(x.name, 10)).filter(Number.isFinite)) + 1; // after 7 (or 7A) comes 8
    while (names.has(String(n))) n++;
    const lp = show.sets[last].props;
    return { show: { ...show, sets: [...show.sets, { id: newId('set'), name: String(n), counts: c - starts[last], pos: { ...show.sets[last].pos }, ...(lp ? { props: { ...lp } } : {}) }] }, index: last + 1 };
  }
  const fresh = { id: newId('set'), name: subSetName(names, show.sets[i - 1].name), counts: c - starts[i - 1], pos: positionsAt(show, c), ...(show.props?.length ? { props: propsAt(show, c) } : {}) };
  const sets = show.sets.map((x, j) => (j === i ? { ...x, counts: starts[i] - c } : x));
  sets.splice(i, 0, fresh);
  return { show: renumberSets({ ...show, sets }), index: i }; // a sub-set before an existing 4A becomes 4A, the old one 4B
}

/**
 * Add a set from where you are at count `t`: on a set, a new one 16 counts after it (later sets move along); mid-move or
 * past the last set, or at a typed count `at`, one landing right on that count (every other set stays put). Returns the
 * show and the count the new set is on.
 */
export function addSetHere(show: Show, t: number, at: number | null = null): { show: Show; t: number } {
  const onSet = setAt(show, t), target = at ?? (onSet < 0 ? Math.round(t) : null);
  if (target === null) { const next = addSetAfter(show, onSet); return { show: next, t: setStarts(next)[onSet + 1] }; }
  if (!Number.isFinite(target) || target < 1) return { show, t };
  const r = insertSetAt(show, target);
  return { show: r.show, t: setStarts(r.show)[r.index] };
}

/** Where time `t` falls: the set being moved into (`to`) and the fraction of that move. f = 1 means "on set `to`". */
export function locate(show: Show, t: number): { to: number; f: number; count: number } {
  const starts = setStarts(show);
  if (t <= 0 || show.sets.length === 1) return { to: 0, f: 1, count: 0 };
  for (let i = 1; i < starts.length; i++) {
    if (t <= starts[i]) {
      const c = t - starts[i - 1];
      return { to: i, f: c / show.sets[i].counts, count: c };
    }
  }
  return { to: starts.length - 1, f: 1, count: show.sets.at(-1)!.counts };
}

/** Index of the set exactly at time t, or -1 if t is mid-move. */
export function setAt(show: Show, t: number): number {
  return setStarts(show).findIndex((s) => Math.abs(s - t) < 1e-9);
}

/** Every performer's position at time t (float / straight-line moves). */
/** Each turning group's arcs, worked out once per move (playback and the too-close check ask for them many times a move). */
const turnCache = new WeakMap<string[], { a: Record<string, Point>; b: Record<string, Point>; routes: Record<string, Point[]> | null }>();
function turnRoutes(show: Show, to: number, ids: string[]): Record<string, Point[]> | null {
  const a = show.sets[to - 1].pos, b = show.sets[to].pos, hit = turnCache.get(ids);
  if (hit && hit.a === a && hit.b === b) return hit.routes;
  const fit = groupTurn(show, to, ids);
  const routes = fit ? Object.fromEntries(ids.map((id) => [id, turnRoute(a[id] ?? b[id], b[id], fit.center, fit.angle)])) : null;
  turnCache.set(ids, { a, b, routes });
  return routes;
}

export function positionsAt(show: Show, t: number): Record<string, Point> {
  const { to, f } = locate(show, t);
  const set = show.sets[to], b = set.pos;
  if (f >= 1 || to === 0) return b;
  const a = show.sets[to - 1].pos;
  const frac = (id: string) => moveFraction(set, id, f);
  const out: Record<string, Point> = {};
  for (const id of Object.keys(b)) {
    const p = a[id] ?? b[id], q = b[id], g = frac(id);
    out[id] = { x: p.x + (q.x - p.x) * g, y: p.y + (q.y - p.y) * g };
  }
  for (const ids of set.turning ?? []) {
    const routes = turnRoutes(show, to, ids);
    if (routes) for (const id of ids) out[id] = along(routes[id], frac(id));
  }
  for (const g of set.ftl ?? []) {
    const starts = g.order.map((id) => a[id] ?? b[id]);
    if (!g.order.some((id) => set.timing?.[id])) {
      const at = ftlPositions(starts, b[g.order[0]], f, routeTurns(g, starts[0], b[g.order[0]]));
      g.order.forEach((id, k) => { out[id] = at[k]; });
    } else { const r = routeTurns(g, starts[0], b[g.order[0]]); g.order.forEach((id, k) => { out[id] = ftlPositions(starts, b[g.order[0]], frac(id), r)[k]; }); } // each on their own count
  }
  const n = show.sets[to].counts;
  for (const [id, path] of Object.entries(show.sets[to].paths ?? {})) {
    if (!pathFits(path, a[id] ?? b[id], b[id], n)) continue;
    const c = f * n, k = Math.min(n - 1, Math.floor(c)), g = c - k;
    out[id] = { x: path[k].x + (path[k + 1].x - path[k].x) * g, y: path[k].y + (path[k + 1].y - path[k].y) * g };
  }
  return out;
}

/**
 * Whether performer `id`'s route into set `i` bends away from a straight line (a drawn path, a follow-the-leader, a
 * turning group) by more than half a step, so the phone doesn't describe it as if they walk straight to the new spot.
 */
export function routeBends(show: Show, i: number, id: string): boolean {
  const set = show.sets[i], a = show.sets[i - 1]?.pos[id], b = set?.pos[id];
  if (!i || !a || !b) return false;
  if (!set.paths?.[id] && !set.ftl?.some((g) => g.order.includes(id)) && !set.turning?.some((g) => g.includes(id))) return false;
  const from = setStarts(show)[i - 1], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  for (let h = 1; h < 2 * set.counts; h++) {
    const p = positionsAt(show, from + h / 2)[id];
    const off = len < 1e-9 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    if (off > 0.5) return true;
  }
  return false;
}

/**
 * Even steps along a count-by-count path: performers march a move with one step size, so within each stretch of
 * counts where the performer is moving, the spots are re-spaced evenly along the same route (corners and arcs kept).
 * Counts standing still (holds, mark time before a delayed step-off) stay still. Ends are unchanged.
 */
export function evenPath(path: Point[], still = 0.02): Point[] {
  const out = path.map((p) => ({ ...p }));
  const d = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  for (let a = 0; a < path.length - 1; ) {
    if (d(path[a], path[a + 1]) <= still) { a++; continue; }
    let b = a + 1;
    while (b < path.length - 1 && d(path[b], path[b + 1]) > still) b++; // counts a..b-1 move: one stretch
    const cum = [0];
    for (let k = a; k < b; k++) cum.push(cum[cum.length - 1] + d(path[k], path[k + 1]));
    const total = cum[cum.length - 1];
    for (let j = 1; j < b - a; j++) {
      const want = (total * j) / (b - a);
      let k = 0;
      while (cum[k + 1] < want) k++;
      const f = (want - cum[k]) / (cum[k + 1] - cum[k] || 1), p = path[a + k], q = path[a + k + 1];
      out[a + j] = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
    }
    a = b;
  }
  return out;
}

// ---- Delayed step-offs and turning moves.

/** How far through their move a performer is at fraction f of the move's counts: 0 while holding before stepping off, 1 once there. */
export function moveFraction(set: DrillSet, id: string, f: number): number {
  const tm = set.timing?.[id], n = set.counts;
  if (!tm || n < 1) return f;
  const w = Math.min(tm.wait, n - 1), m = Math.min(tm.move, n - w); // counts cut after the timing was set: keep it inside the move
  return Math.min(1, Math.max(0, (f * n - w) / m));
}

/** The counts a performer holds before stepping off and the counts they move, as playback uses them. */
export function timingOf(set: DrillSet, id: string): { wait: number; move: number } {
  const tm = set.timing?.[id], n = set.counts;
  if (!tm) return { wait: 0, move: n };
  const w = Math.min(tm.wait, n - 1);
  return { wait: w, move: Math.min(tm.move, n - w) };
}

/**
 * Hold `wait` counts, then move `move` counts, for these performers in the move into set i (kept inside the move's
 * counts). Moving every count from the start clears it. An imported count-by-count route for them is dropped (it would override).
 */
export function setTiming(show: Show, i: number, ids: string[], wait: number, move: number): Show {
  if (i < 1) return show;
  return mapSet(show, i, (s) => {
    const n = s.counts, w = Math.max(0, Math.min(n - 1, Math.round(wait))), m = Math.max(1, Math.min(n - w, Math.round(move)));
    const timing = { ...s.timing }, paths = { ...s.paths };
    for (const id of ids) { delete paths[id]; if (w === 0 && m === n) delete timing[id]; else timing[id] = { wait: w, move: m }; }
    return { ...s, timing: Object.keys(timing).length ? timing : undefined, paths: Object.keys(paths).length ? paths : undefined };
  });
}

/** Make these performers' move into set i a turn, as one group (`on`), or straight again. They leave any other turning group. */
export function setTurning(show: Show, i: number, ids: string[], on: boolean): Show {
  if (i < 1) return show;
  return mapSet(show, i, (s) => {
    const groups = (s.turning ?? []).map((g) => g.filter((id) => !ids.includes(id))).filter((g) => g.length > 1);
    if (on && ids.length > 1) groups.push([...ids]);
    const paths = { ...s.paths };
    for (const id of ids) delete paths[id];
    return { ...s, turning: groups.length ? groups : undefined, paths: Object.keys(paths).length ? paths : undefined };
  });
}

/**
 * The one turn that best carries `from` onto `to` (least squares, as a rigid turn): the point it turns around and the
 * angle in radians (positive = counterclockwise as the director sees it). Null when the group hardly turns (under 1°).
 */
export function fitTurn(from: Point[], to: Point[]): { center: Point; angle: number } | null {
  const n = from.length;
  if (n < 2) return null;
  const mean = (ps: Point[]) => ({ x: ps.reduce((t, p) => t + p.x, 0) / n, y: ps.reduce((t, p) => t + p.y, 0) / n });
  const ca = mean(from), cb = mean(to);
  let dot = 0, cross = 0;
  for (let k = 0; k < n; k++) {
    const u = { x: from[k].x - ca.x, y: from[k].y - ca.y }, v = { x: to[k].x - cb.x, y: to[k].y - cb.y };
    dot += u.x * v.x + u.y * v.y; cross += u.x * v.y - u.y * v.x;
  }
  const angle = Math.atan2(cross, dot);
  if (Math.abs(angle) < Math.PI / 180) return null;
  // The center stays put under the turn: c = R(c - ca) + cb, so (I - R)c = cb - R·ca.
  const cos = Math.cos(angle), sin = Math.sin(angle), p = 1 - cos, det = 2 - 2 * cos;
  const rx = cb.x - (cos * ca.x - sin * ca.y), ry = cb.y - (sin * ca.x + cos * ca.y);
  return { center: { x: (p * rx - sin * ry) / det, y: (sin * rx + p * ry) / det }, angle };
}

/** The turn of a turning group in the move into set i (members missing a spot are left out). */
export function groupTurn(show: Show, i: number, ids: string[]) {
  const a = show.sets[i - 1].pos, b = show.sets[i].pos, here = ids.filter((id) => b[id]);
  return fitTurn(here.map((id) => a[id] ?? b[id]), here.map((id) => b[id]));
}

/**
 * One performer's arc in a turning move: `k` + 1 spots from `a` to `b`, swinging around `center` by about `angle`
 * (their own sweep is the one nearest the group's), with the distance from the center changing evenly if it changes.
 * Spaced evenly along the route, so every step is the same size. A performer on the center itself stands still.
 */
export function turnRoute(a: Point, b: Point, center: Point, angle: number, k = 32): Point[] {
  const u = { x: a.x - center.x, y: a.y - center.y }, v = { x: b.x - center.x, y: b.y - center.y };
  const r0 = Math.hypot(u.x, u.y), r1 = Math.hypot(v.x, v.y);
  const raw: Point[] = [];
  if (r0 < 1e-6 || r1 < 1e-6) for (let j = 0; j <= k; j++) raw.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
  else {
    const p0 = Math.atan2(u.y, u.x);
    let d = Math.atan2(v.y, v.x) - p0 - angle;
    d = d - 2 * Math.PI * Math.round(d / (2 * Math.PI)) + angle;
    for (let j = 0; j <= k; j++) {
      const g = j / k, r = r0 + (r1 - r0) * g, phi = p0 + d * g;
      raw.push({ x: center.x + r * Math.cos(phi), y: center.y + r * Math.sin(phi) });
    }
  }
  raw[0] = a; raw[k] = b;
  return evenPath(raw, 1e-9);
}

/** The spot a fraction g of the way along an evenly spaced route. */
const along = (route: Point[], g: number): Point => {
  const c = g * (route.length - 1), k = Math.min(route.length - 2, Math.floor(c)), h = c - k, p = route[k], q = route[k + 1];
  return { x: p.x + (q.x - p.x) * h, y: p.y + (q.y - p.y) * h };
};
const routeLength = (r: Point[]) => r.slice(1).reduce((t, p, k) => t + distance(r[k], p), 0);

/**
 * Counter-march the FTL group `order` (order[0] leads, the rest in file behind it) in the move into set i: the leader
 * turns into the next lane, `lane` steps to its left or right, and marches back past the file, so the file ends
 * reversed beside where it started. Built on follow-the-leader (a leader route with one turn).
 */
export function counterMarch(show: Show, i: number, order: string[], side: 'left' | 'right', lane = 1): Show {
  if (i < 1 || order.length < 2) return show;
  const a = show.sets[i - 1].pos, b = show.sets[i].pos, at = (id: string) => a[id] ?? b[id];
  const head = at(order[0]), back = at(order[1]), tail = at(order.at(-1)!), len = distance(head, back);
  if (len < 1e-6) throw new Error('The leader and the next in line start on the same spot.');
  const dir = { x: (head.x - back.x) / len, y: (head.y - back.y) / len };
  const n = side === 'left' ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
  const off = (p: Point) => ({ x: p.x + n.x * lane, y: p.y + n.y * lane });
  const moved = placeInSet(setFtl(show, i, order), i, { [order[0]]: off(tail) });
  return setFtlTurns(moved, i, order[0], [off(head)]);
}

/** The paths into set i to draw, each piece colored by its step size: straight lines, arcs for turning moves, imported routes, and one trail per FTL group. */
export function moveSegments(show: Show, i: number, keep: (id: string) => boolean = () => true): { from: Point; to: Point; tier: StepTier }[] {
  const steps = moveSteps(show, i);
  const a = show.sets[i - 1].pos, b = show.sets[i].pos;
  const groups = show.sets[i].ftl ?? [];
  const inFtl = new Set(groups.flatMap((g) => g.order));
  const own = show.sets[i].paths ?? {}, n = show.sets[i].counts;
  // A turning move is drawn along each member's arc.
  const arcs = new Map<string, Point[]>();
  for (const ids of show.sets[i].turning ?? []) {
    const fit = groupTurn(show, i, ids);
    if (fit) for (const id of ids) if (a[id] && !inFtl.has(id)) arcs.set(id, turnRoute(a[id], b[id], fit.center, fit.angle));
  }
  const straight = Object.keys(b).filter((id) => keep(id) && !inFtl.has(id) && a[id] && (a[id].x !== b[id].x || a[id].y !== b[id].y || own[id]))
    .flatMap((id) => {
      const path = arcs.get(id) ?? own[id];
      if (arcs.has(id)) return path.slice(1).map((q, k) => ({ from: path[k], to: q, tier: steps[id].tier }));
      // A count-by-count move (from Pyware) is drawn along its real route; still counts (holds) add nothing.
      if (path && pathFits(path, a[id], b[id], n))
        return path.slice(1).flatMap((q, k) => (q.x !== path[k].x || q.y !== path[k].y ? [{ from: path[k], to: q, tier: steps[id].tier }] : []));
      return [{ from: a[id], to: b[id], tier: steps[id].tier }];
    });
  // A follow-the-leader group draws its trail once, in the leader's step-size color.
  const trails = groups.filter((g) => keep(g.order[0])).flatMap((g) => {
    const t = ftlTrail(show, i, g.order);
    return t.slice(1).map((p, k) => ({ from: t[k], to: p, tier: steps[g.order[0]].tier }));
  });
  return [...straight, ...trails];
}

// ---- Close calls: performers who come too near each other.

/** Closer than this (in steps), at any point in a move, gets a warning (Jason: under 1 step). */
export const TOO_CLOSE = 1;

/**
 * Pairs of performers closer than TOO_CLOSE at any moment of the move into set i (for set 1, its own spots),
 * each pair once, at its closest, nearest first. `count` is the count of the move it happens on, to the nearest
 * quarter (0 for set 1). Positions are sampled every half count; between samples each performer moves in a straight
 * line, so the closest approach inside each half count is worked out exactly (a fast crossing between samples counts).
 * Moves with arcs or corners between counts (turning groups, follow-the-leader) are sampled every eighth of a count instead,
 * so a performer cutting across the inside of a curve can't hide between samples.
 */
export function closeCalls(show: Show, i: number): { a: string; b: string; count: number; d: number }[] {
  const best = new Map<string, { a: string; b: string; count: number; d: number }>();
  const note = (id: string, o: string, d: number, count: number) => {
    const [x, y] = id < o ? [id, o] : [o, id], k = `${x} ${y}`;
    if (d < TOO_CLOSE && (!best.has(k) || d < best.get(k)!.d)) best.set(k, { a: x, b: y, count: Math.round(count * 4) / 4, d });
  };
  const n = i > 0 ? show.sets[i].counts : 0, from = i > 0 ? setStarts(show)[i - 1] : 0;
  const per = i > 0 && (show.sets[i].turning?.length || show.sets[i].ftl?.length) ? 8 : 2; // samples per count
  let prev = i > 0 ? positionsAt(show, from) : show.sets[0].pos;
  for (let h = i > 0 ? 1 : 0; h <= per * n; h++) {
    const pos = i > 0 ? positionsAt(show, from + h / per) : prev;
    // Bucket each performer's straight stretch (padded half a step) into 1-step cells; pairs sharing a cell are checked.
    const cells = new Map<string, string[]>(), seen = new Set<string>(), r = TOO_CLOSE / 2;
    for (const [id, q] of Object.entries(pos)) {
      const p = prev[id] ?? q;
      const x0 = Math.floor((Math.min(p.x, q.x) - r) / TOO_CLOSE), x1 = Math.floor((Math.max(p.x, q.x) + r) / TOO_CLOSE);
      const y0 = Math.floor((Math.min(p.y, q.y) - r) / TOO_CLOSE), y1 = Math.floor((Math.max(p.y, q.y) + r) / TOO_CLOSE);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const k = `${cx},${cy}`, here = cells.get(k) ?? [];
        for (const o of here) {
          const pk = id < o ? `${id} ${o}` : `${o} ${id}`;
          if (seen.has(pk)) continue;
          seen.add(pk);
          const op = prev[o] ?? pos[o], oq = pos[o];
          // Relative position goes from r0 to r1 in a straight line; its closest point to zero is at t (0..1).
          const r0x = op.x - p.x, r0y = op.y - p.y, dx = oq.x - q.x - r0x, dy = oq.y - q.y - r0y, vv = dx * dx + dy * dy;
          const t = vv > 0 ? Math.min(1, Math.max(0, -(r0x * dx + r0y * dy) / vv)) : 1;
          note(id, o, Math.hypot(r0x + dx * t, r0y + dy * t), i > 0 ? (h - 1 + t) / per : 0);
        }
        here.push(id);
        cells.set(k, here);
      }
    }
    prev = pos;
  }
  return [...best.values()].sort((x, y) => x.d - y.d);
}

/** closeCalls, kept per move: a move is checked again only when its set or the set before it changed (those are all it reads). */
const closeMemo = new WeakMap<DrillSet, { prev: DrillSet | undefined; calls: ReturnType<typeof closeCalls> }>();
export function closeCallsMemo(show: Show, i: number) {
  const set = show.sets[i], prev = show.sets[i - 1], hit = closeMemo.get(set);
  if (hit && hit.prev === prev) return hit.calls;
  const calls = closeCalls(show, i);
  closeMemo.set(set, { prev, calls });
  return calls;
}

// ---- Props.

/** Add a prop at `at` in every set. */
export function addProp(show: Show, name: string, w: number, h: number, round: boolean, at: Point): { show: Show; id: string } {
  const id = newId('pr'), spot = { x: at.x, y: at.y, angle: 0 };
  return { id, show: { ...show, props: [...(show.props ?? []), { id, name, w, h, ...(round ? { round } : {}) }], sets: show.sets.map((s) => ({ ...s, props: { ...s.props, [id]: spot } })) } };
}

export const updateProp = (show: Show, id: string, patch: Partial<Omit<Prop, 'id'>>): Show =>
  ({ ...show, props: show.props?.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

/** Where a new prop goes: the middle of the field, or 2 steps right and 2 down (toward the front) from a prop already there, and so on (Jason). */
export function newPropSpot(show: Show): Point {
  const taken = show.sets.flatMap((s) => Object.values(s.props ?? {}));
  let at = { x: 0, y: fieldDepth(fieldOf(show)) / 2 };
  for (let k = 0; k <= taken.length && taken.some((q) => Math.abs(q.x - at.x) < 1 && Math.abs(q.y - at.y) < 1); k++) at = { x: at.x + 2, y: at.y - 2 };
  return at;
}

export function removeProp(show: Show, id: string): Show {
  const props = show.props?.filter((p) => p.id !== id);
  return { ...show, props: props?.length ? props : undefined, sets: show.sets.map((s) => {
    if (!s.props) return s;
    const { [id]: _, ...rest } = s.props;
    return { ...s, props: Object.keys(rest).length ? rest : undefined };
  }) };
}

/** Put a prop on `spot` in set i, and in each later set where it was still standing on its old set-i spot (as with performers). */
export function placeProp(show: Show, i: number, id: string, spot: PropSpot, base: Show = show): Show {
  const was = base.sets[i]?.props?.[id];
  const same = (a?: PropSpot, b?: PropSpot) => !!a && !!b && a.x === b.x && a.y === b.y && a.angle === b.angle;
  let holding = true;
  return { ...show, sets: show.sets.map((s, j) => {
    if (j < i) return s;
    if (j > i) holding = holding && same(base.sets[j]?.props?.[id], was);
    return j === i || holding ? { ...s, props: { ...s.props, [id]: spot } } : s;
  }) };
}

/** Every prop's spot at time t: they move in a straight line and turn the short way, evenly through the move. */
export function propsAt(show: Show, t: number): Record<string, PropSpot> {
  const { to, f } = locate(show, t), b = show.sets[to].props ?? {};
  if (f >= 1 || to === 0) return b;
  const a = show.sets[to - 1].props ?? {}, out: Record<string, PropSpot> = {};
  for (const [id, q] of Object.entries(b)) {
    const p = a[id] ?? q, turn = ((((q.angle - p.angle) % 360) + 540) % 360) - 180;
    out[id] = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, angle: p.angle + turn * f };
  }
  return out;
}

/** Inside triangle `c`, or within `pad` of its edge? */
function inTriangle(q: Point, c: [Point, Point, Point], pad: number) {
  const cross = (a: Point, b: Point) => (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
  const d = [cross(c[0], c[1]), cross(c[1], c[2]), cross(c[2], c[0])];
  if (d.every((n) => n >= 0) || d.every((n) => n <= 0)) return true;
  const toEdge = (a: Point, b: Point) => { // distance from q to the segment a-b
    const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(q.x - a.x - t * vx, q.y - a.y - t * vy);
  };
  return Math.min(toEdge(c[0], c[1]), toEdge(c[1], c[2]), toEdge(c[2], c[0])) <= pad;
}

/** The prop under field point `p` (the top one), with `pad` steps of reach around its edge. */
export function hitProp(show: Show, spots: Record<string, PropSpot>, p: Point, pad = 0): string | undefined {
  for (const pr of [...(show.props ?? [])].reverse()) {
    const s = spots[pr.id];
    if (!s) continue;
    const a = (-s.angle * Math.PI) / 180, dx = p.x - s.x, dy = p.y - s.y;
    const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a); // in the prop's own frame
    const hw = pr.w / 2 + pad, hh = pr.h / 2 + pad, shape = propShape(pr);
    if (shape === 'oval' ? (u / hw) ** 2 + (v / hh) ** 2 <= 1
      : shape === 'triangle' ? inTriangle({ x: u, y: v }, triangleCorners(pr), pad)
      : Math.abs(u) <= hw && Math.abs(v) <= hh) return pr.id;
  }
}

/** A count-by-count path still belongs to its move: one spot per count, ends on the two sets' spots. */
export const pathFits = (path: Point[], from: Point | undefined, to: Point | undefined, counts: number) =>
  !!from && !!to && path.length === counts + 1 && near(path[0], from) && near(path[counts], to);
const near = (p: Point, q: Point) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;

/** The trail a follow-the-leader group marches along in the move into set i: leader's end, leader's start, then each follower's start. */
export function ftlTrail(show: Show, i: number, order: string[]): Point[] {
  const a = show.sets[i - 1].pos, b = show.sets[i].pos, g = show.sets[i].ftl?.find((x) => x.order[0] === order[0]);
  const turns = g ? routeTurns(g, a[order[0]] ?? b[order[0]], b[order[0]]) : [];
  return [b[order[0]], ...[...turns].reverse(), ...order.map((id) => a[id] ?? b[id])];
}

const SMOOTH = 8; // points per stretch between turns on a smooth route

/**
 * The points a leader's route passes through between its start and end: its turns, or with `smooth`, a curve through
 * them (Catmull-Rom, which passes through every turn), as many short straight stretches. Walked at one steady speed, as always.
 */
export function routeTurns(g: { turns?: Point[]; smooth?: boolean }, start: Point, end: Point): Point[] {
  const t = g.turns ?? [];
  if (!g.smooth || !t.length) return t;
  const p = [start, ...t, end], out: Point[] = [];
  for (let k = 0; k < p.length - 1; k++) {
    const p0 = p[k - 1] ?? p[k], p1 = p[k], p2 = p[k + 1], p3 = p[k + 2] ?? p[k + 1];
    for (let j = k ? 0 : 1; j < SMOOTH; j++) { // j = 0 is the turn itself; the start and end aren't included
      const u = j / SMOOTH, u2 = u * u, u3 = u2 * u;
      const c = (a0: number, a1: number, a2: number, a3: number) => 0.5 * (2 * a1 + (a2 - a0) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u2 + (3 * a1 - a0 - 3 * a2 + a3) * u3);
      out.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

/**
 * Recompute every follow-the-leader follower's spot from its trail, set by set (a set's spots feed the next move),
 * and drop groups that lost members. Run after every edit so the stored show is always consistent.
 */
export function normalizeFtl(show: Show): Show {
  if (!show.sets.some((s) => s.ftl?.length)) return show;
  const alive = new Set(show.performers.map((p) => p.id));
  const sets = [...show.sets];
  for (let i = 1; i < sets.length; i++) {
    const groups = (sets[i].ftl ?? []).map((g) => {
      const order = g.order.filter((id) => alive.has(id));
      return order[0] === g.order[0] ? { ...g, order } : { order }; // a removed leader takes its route with it
    }).filter((g) => g.order.length > 0); // a group of one is a performer's own route
    if (!sets[i].ftl && !groups.length) continue;
    const pos = { ...sets[i].pos };
    for (const g of groups) {
      const starts = g.order.map((id) => sets[i - 1].pos[id] ?? pos[id]);
      const ends = ftlPositions(starts, pos[g.order[0]], 1, routeTurns(g, starts[0], pos[g.order[0]]));
      g.order.slice(1).forEach((id, k) => { pos[id] = ends[k + 1]; });
    }
    sets[i] = { ...sets[i], pos, ftl: groups.length ? groups : undefined };
  }
  return { ...show, sets };
}

/** Make `order` a follow-the-leader group for the move into set i (order[0] leads). Members leave any other group. */
export function setFtl(show: Show, i: number, order: string[]): Show {
  const old = (show.sets[i].ftl ?? []).find((g) => g.order[0] === order[0]); // same leader (a reorder): keep its route
  // Other groups keep their turns unless they lose their leader to this one.
  const others = (show.sets[i].ftl ?? []).filter((g) => g !== old).map((g) => (order.includes(g.order[0]) ? { order: g.order.filter((id) => !order.includes(id)) } : { ...g, order: g.order.filter((id) => !order.includes(id)) }));
  return normalizeFtl(mapSet(show, i, (s) => ({ ...s, ftl: [...others, { order, ...(old?.turns?.length ? { turns: old.turns, ...(old.smooth ? { smooth: true } : {}) } : {}) }] })));
}

export const MAX_TURNS = 50;

/** Set the turning points of the group led by `leader` in the move into set i ([] = a straight leader move). */
export const setFtlTurns = (show: Show, i: number, leader: string, turns: Point[]): Show =>
  normalizeFtl(mapSet(show, i, (s) => ({ ...s, ftl: (s.ftl ?? []).map((g) => (g.order[0] !== leader ? g
    : turns.length ? { ...g, turns: turns.slice(0, MAX_TURNS) } : { order: g.order })) })));

/** Round the corners of the route of the group led by `leader` in the move into set i into a curve (`on`), or not. */
export const setFtlSmooth = (show: Show, i: number, leader: string, on: boolean): Show =>
  normalizeFtl(mapSet(show, i, (s) => ({ ...s, ftl: (s.ftl ?? []).map((g) => { if (g.order[0] !== leader) return g; const { smooth: _, ...rest } = g; return on ? { ...rest, smooth: true } : rest; }) })));

/** How far the leader marches in the move into set i: start, through its turns (or its curve), to its end spot. */
export function leaderDistance(show: Show, i: number, g: { order: string[]; turns?: Point[]; smooth?: boolean }): number {
  const a = show.sets[i - 1].pos, b = show.sets[i].pos, id = g.order[0], start = a[id] ?? b[id];
  const route = [start, ...routeTurns(g, start, b[id]), b[id]];
  return route.slice(1).reduce((d, p, k) => d + distance(route[k], p), 0);
}

/** Put performers back to floating for the move into set i. They stay where FTL left them. */
export const clearFtl = (show: Show, i: number, ids: string[]): Show =>
  normalizeFtl(mapSet(show, i, (s) => ({ ...s, ftl: (s.ftl ?? []).map((g) => (ids.includes(g.order[0]) ? { order: g.order.filter((id) => !ids.includes(id)) } : { ...g, order: g.order.filter((id) => !ids.includes(id)) })) })));

/** Default follower order: from the leader, each next performer is the nearest remaining one (at the start of the move). */
export function chainOrder(show: Show, i: number, leader: string, ids: string[]): string[] {
  const a = show.sets[Math.max(0, i - 1)].pos;
  const order = [leader];
  const left = new Set(ids.filter((id) => id !== leader));
  while (left.size) {
    const last = a[order.at(-1)!];
    let best = '', bd = Infinity;
    for (const id of left) { const d = distance(last, a[id]); if (d < bd) { bd = d; best = id; } }
    order.push(best);
    left.delete(best);
  }
  return order;
}

// Step sizes per move, kept until the move's two sets or the step limit change: the timeline asks for every move's
// biggest step on each render (each step of a drag, each frame of playback), and Review asks again.
const stepMemo = new WeakMap<DrillSet, { prev: DrillSet; limit?: number; steps: Record<string, { per5: number; tier: StepTier }> }>();

/** Step size per performer for the move into set i (i >= 1): the arc for a turn, the leader's route for follow-the-leader. */
export function moveSteps(show: Show, i: number): Record<string, { per5: number; tier: StepTier }> {
  const set = show.sets[i], prev = show.sets[i - 1], hit = stepMemo.get(set);
  if (hit && hit.prev === prev && hit.limit === show.stepLimit) return hit.steps;
  const steps = stepsOf(show, i);
  stepMemo.set(set, { prev, limit: show.stepLimit, steps });
  return steps;
}

function stepsOf(show: Show, i: number): Record<string, { per5: number; tier: StepTier }> {
  const set = show.sets[i], a = show.sets[i - 1].pos, b = set.pos;
  const dist: Record<string, number> = Object.fromEntries(Object.keys(b).map((id) => [id, distance(a[id] ?? b[id], b[id])]));
  const counts: Record<string, number> = Object.fromEntries(Object.keys(b).map((id) => [id, timingOf(set, id).move])); // a delayed step-off covers it in fewer counts
  // A turning move marches the arc, not the straight line.
  for (const ids of set.turning ?? []) {
    const fit = groupTurn(show, i, ids);
    if (fit) for (const id of ids) dist[id] = routeLength(turnRoute(a[id] ?? b[id], b[id], fit.center, fit.angle));
  }
  // In follow-the-leader everyone marches the leader's distance, whatever the straight line says.
  for (const g of set.ftl ?? []) for (const id of g.order) dist[id] = leaderDistance(show, i, g);
  // On a count-by-count path, the step size that matters is its biggest single count.
  const n = set.counts;
  for (const [id, path] of Object.entries(set.paths ?? {}))
    if (pathFits(path, a[id] ?? b[id], b[id], n)) { dist[id] = n * Math.max(...path.slice(1).map((p, k) => distance(path[k], p))); counts[id] = n; }
  return Object.fromEntries(Object.entries(dist).map(([id, d]) => [id, stepSize(d, counts[id], show.stepLimit ?? STEP_LIMIT)]));
}

/** Performers whose step in the move into set i is bigger than the show's step limit (red). */
export const overLimit = (show: Show, i: number): string[] =>
  Object.entries(moveSteps(show, i)).filter(([, st]) => st.tier === 'red').map(([id]) => id);

/** Performers in the move into set i whose imported count-by-count path no longer fits (an edit changed an end or the counts), so they march a straight line. */
export const brokenPaths = (show: Show, i: number): string[] => {
  const set = show.sets[i], a = show.sets[i - 1]?.pos ?? {};
  return Object.entries(set.paths ?? {}).filter(([id, path]) => !pathFits(path, a[id] ?? set.pos[id], set.pos[id], set.counts)).map(([id]) => id);
};

/** The largest step (smallest N-to-5) in the move into set i. */
export function biggestStep(show: Show, i: number) {
  const all = Object.values(moveSteps(show, i));
  return all.length ? all.reduce((m, s) => (s.per5 < m.per5 ? s : m)) : null;
}

// ---- Exact coordinate entry: the inverse of the readout.

export type SideDir = 'on' | 'inside' | 'outside';
export type FrontRef = 'Front Sideline' | 'Front Hash' | 'Back Hash' | 'Back Sideline';
export type FrontDir = 'on' | 'in front of' | 'behind';

/** line: 50, 45, ..., 5, or 0 for the goal line. side is ignored for the 50. */
export function xFrom(side: 1 | 2, line: number, steps: number, dir: SideDir): number {
  const base = ((50 - line) / 5) * 8;
  const off = dir === 'on' ? 0 : dir === 'outside' || line === 50 ? steps : -steps;
  return (side === 1 ? -1 : 1) * (base + off);
}

export function yFrom(ref: FrontRef, steps: number, dir: FrontDir, hash: HashPreset): number {
  const h = HASHES[hash];
  const refY = { 'Front Sideline': 0, 'Front Hash': h, 'Back Hash': FIELD_WIDTH - h, 'Back Sideline': FIELD_WIDTH }[ref];
  return refY + (dir === 'on' ? 0 : dir === 'behind' ? steps : -steps);
}

// ---- File format. Shows from disk are untrusted: check shape before use.

/**
 * A short fingerprint of what performers see: everything in the show except the revision itself, warnings the director
 * dismissed, the step limit (it only changes warnings), and the tracing picture. Two shows with the same drill match.
 */
export function drillSig(show: Show): string {
  const { revision: _r, revisionSig: _s, dismissed: _d, stepLimit: _l, trace: _t, ...drill } = show;
  const text = JSON.stringify(drill);
  let h = 0x811c9dc5; // FNV-1a, 32 bits: not for security, just "did it change"
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

/** The show with the next revision number and the drill's fingerprint, for a copy headed to phones. */
export const nextRevision = (show: Show): Show => ({ ...show, revision: (show.revision ?? 0) + 1, revisionSig: drillSig(show) });

/**
 * The revision for paper: "rev 6", or "rev 6 + changes" when the drill was edited after revision 6 went out, so a chart
 * printed later can't pass for what's on the phones. Shows published before fingerprints just say "rev 6". '' if never published.
 */
export function revisionLabel(show: Show): string {
  if (!show.revision) return '';
  return show.revisionSig && show.revisionSig !== drillSig(show) ? `rev ${show.revision} + changes` : `rev ${show.revision}`;
}

export { parseShow, parseShowFile, MAX_ATTACHED_AUDIO, MAX_ATTACHED_PICTURE, planBackup, tooBigForBackup, type Attached } from './showFile';

// ---- Range playback.

/** The count range [lo, hi] from set `fromId` to set `toId` (null = first / last set, as do ids no longer in the show). */
export function playRange(show: Show, fromId: string | null, toId: string | null): [number, number] {
  const starts = setStarts(show);
  const idx = (id: string | null, fallback: number) => {
    const i = id ? show.sets.findIndex((s) => s.id === id) : -1;
    return i < 0 ? fallback : i;
  };
  const a = idx(fromId, 0), b = idx(toId, -1);
  if (b < 0) return [starts[a], showLength(show)]; // to the end: through any part not written yet
  return [starts[Math.min(a, b)], starts[Math.max(a, b)]];
}

/**
 * What Play does from count `t`: start right there and go forward. The play range only decides where it stops
 * (or loops back to); from outside the range, it plays on to the end of the show. Null: nothing ahead to play.
 */
export function playPlan(t: number, [lo, hi]: [number, number], total: number, loop: boolean): { from: number; span: [number, number]; loop: boolean } | null {
  if (t >= lo && t < hi) return { from: t, span: [lo, hi], loop };
  return t < total ? { from: t, span: [t, total], loop: false } : null;
}

/** Advance playback by `counts`; at the range end either stop or wrap around to the start. */
export function advance(t: number, counts: number, [lo, hi]: [number, number], loop: boolean): { t: number; done: boolean } {
  const next = t + counts;
  if (next < hi) return { t: next, done: false };
  if (!loop || hi <= lo) return { t: hi, done: true };
  return { t: lo + ((next - lo) % (hi - lo)), done: false };
}

// ---- Mirroring.

/**
 * Flip performers in set i across the 50 ('x') or across the field's front-to-back center ('y').
 * `inPlace` flips them across the middle of their own box instead, so the form turns over where it stands.
 */
export function flip(show: Show, i: number, ids: string[], axis: 'x' | 'y', inPlace = false): Show {
  const pos = show.sets[i].pos, pins = show.sets[i].labels;
  // `twice` is twice the line's coordinate (the low edge plus the high edge, for in place), so a half step stays exact.
  const v = ids.map((id) => pos[id][axis]);
  const twice = !inPlace ? (axis === 'x' ? 0 : fieldDepth(fieldOf(show))) : Math.min(...v) + Math.max(...v);
  const f = (p: Point) => (axis === 'x' ? { x: twice - p.x, y: p.y } : { x: p.x, y: twice - p.y });
  const moved = mapTurns(placeInSet(show, i, Object.fromEntries(ids.map((id) => [id, f(pos[id])]))), i, ids, f);
  return withPins(moved, i, Object.fromEntries(ids.filter((id) => pins?.[id]).map((id) => [id, mirrorSide(pins![id], axis)])));
}

/** Move the turns of FTL groups whose leader is among `ids` with them (a mirror, rotation, scale or drag of the group). */
export const mapTurns = (show: Show, i: number, ids: string[], f: (p: Point) => Point): Show =>
  !show.sets[i].ftl?.some((g) => g.turns && ids.includes(g.order[0])) ? show
    : mapSet(show, i, (s) => ({ ...s, ftl: s.ftl!.map((g) => (g.turns && ids.includes(g.order[0]) ? { ...g, turns: g.turns.map(f) } : g)) }));

/** A pinned label side reflected with its dot: across the 50, left ↔ right; front to back, above ↔ below. */
export function mirrorSide(side: LabelSide, axis: 'x' | 'y'): LabelSide {
  const swap: Record<string, string> = axis === 'x' ? { left: 'right', right: 'left' } : { above: 'below', below: 'above' };
  return side.split('-').map((w) => swap[w] ?? w).join('-') as LabelSide;
}

const withPins = (show: Show, i: number, pins: Record<string, LabelSide | null>) =>
  Object.entries(pins).reduce((s, [id, side]) => setLabelSide(s, i, [id], side), show);

/**
 * The selected performers on side `from` keep their spots; those on the other side take the mirror image across the 50.
 * Pairing is least total travel from the previous set (where the move starts), so paths don't cross.
 * Performers exactly on the 50 are left alone. Throws if the two sides have different numbers of performers.
 */
export function mirrorSides(show: Show, i: number, ids: string[], from: 1 | 2): Show {
  const pos = show.sets[i].pos;
  const onSide = (side: 1 | 2) => ids.filter((id) => (side === 1 ? pos[id].x < 0 : pos[id].x > 0));
  const src = onSide(from), dst = onSide(from === 1 ? 2 : 1);
  if (src.length !== dst.length) {
    throw new Error(`Select the same number on each side (Side ${from}: ${src.length}, Side ${from === 1 ? 2 : 1}: ${dst.length}).`);
  }
  const targets = src.map((id) => ({ x: -pos[id].x, y: pos[id].y }));
  const origin = show.sets[Math.max(0, i - 1)].pos;
  // Pair by least travel; but a follow-the-leader member's partner is whoever starts mirror-opposite it, so the copy
  // is led by the leader's twin and follows the same trail (the ends get recomputed from the trail anyway).
  const copied = (show.sets[i].ftl ?? []).filter((g) => i > 0 && g.order.every((id) => src.includes(id)));
  const inGroup = new Set(copied.flatMap((g) => g.order));
  const match = src.map((id, k) => (inGroup.has(id) && origin[id] ? { x: -origin[id].x, y: origin[id].y } : targets[k]));
  const slotOf = assign(dst.map((id) => origin[id] ?? pos[id]), match);
  const moved = placeInSet(show, i, Object.fromEntries(dst.map((id, k) => [id, targets[slotOf[k]]])));
  // Each copy takes its partner's label side, mirrored (or automatic if the partner has none).
  const pins = show.sets[i].labels;
  let out = withPins(moved, i, Object.fromEntries(dst.map((id, k) => { const p = pins?.[src[slotOf[k]]]; return [id, p ? mirrorSide(p, 'x') : null]; })));
  // A follow-the-leader group copies too: the partners follow the partner of the leader, along the mirrored route.
  const partner = Object.fromEntries(dst.map((id, k) => [src[slotOf[k]], id]));
  for (const g of copied) {
    const order = g.order.map((id) => partner[id]);
    out = setFtlTurns(setFtl(out, i, order), i, order[0], (g.turns ?? []).map((p) => ({ x: -p.x, y: p.y })));
  }
  return i > 0 ? copyMoveStyle(out, i, partner, from) : out;
}

/**
 * The rest of how the copied side moves into set i, for Copy Side 1 → 2: each partner takes its twin's delayed
 * step-off (or none), its imported route mirrored (only where it fits the partner's own two spots), and turning
 * groups wholly on the copied side turn again as their partners. A turning group wholly on the other side is the old
 * copy, so its selected members leave it; a group across the 50 is left alone.
 */
function copyMoveStyle(show: Show, i: number, partner: Record<string, string>, from: 1 | 2): Show {
  const s = show.sets[i], a = show.sets[i - 1].pos, b = s.pos;
  const twins = Object.entries(partner), dst = new Set(Object.values(partner)), src = new Set(Object.keys(partner));
  const onFrom = (id: string) => (from === 1 ? b[id]?.x < 0 : b[id]?.x > 0);
  const timing = { ...s.timing }, paths = { ...s.paths };
  for (const [id, twin] of twins) {
    if (s.timing?.[id]) timing[twin] = { ...s.timing[id] }; else delete timing[twin];
    const path = s.paths?.[id]?.map((p) => ({ x: -p.x, y: p.y }));
    if (path && pathFits(path, a[twin] ?? b[twin], b[twin], s.counts)) paths[twin] = path; else delete paths[twin];
  }
  const groups = s.turning ?? [];
  const copied = groups.filter((g) => g.every((id) => src.has(id))).map((g) => g.map((id) => partner[id]));
  const inCopy = new Set(copied.flat()); // a performer turns in one group at most
  const kept = groups
    .map((g) => (g.every((id) => !onFrom(id)) ? g.filter((id) => !dst.has(id)) : g).filter((id) => !inCopy.has(id)))
    .filter((g) => g.length > 1);
  const turning = [...kept, ...copied];
  const some = <T extends object>(o: T) => (Object.keys(o).length ? o : undefined);
  return mapSet(show, i, (x) => ({ ...x, timing: some(timing), paths: some(paths), turning: turning.length ? turning : undefined }));
}

/**
 * Rotate (degrees; positive = counterclockwise as the director sees it) and/or scale the selected performers
 * in set i around the center of their bounding box, or around `pivot` (a gate turn on an end performer's spot).
 * `ky` stretches front to back separately (default: same as `scale`).
 */
export function rotateScale(show: Show, i: number, ids: string[], deg: number, scale: number, ky = scale, pivot?: Point): Show {
  if (!ids.length) return show;
  const pos = show.sets[i].pos;
  const xs = ids.map((id) => pos[id].x), ys = ids.map((id) => pos[id].y);
  const cx = pivot ? pivot.x : (Math.min(...xs) + Math.max(...xs)) / 2, cy = pivot ? pivot.y : (Math.min(...ys) + Math.max(...ys)) / 2;
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const tidy = (n: number) => Math.round(n * 1e9) / 1e9; // keep 90° turns landing exactly on whole steps
  const f = (p: Point) => { const dx = p.x - cx, dy = p.y - cy; return { x: tidy(cx + scale * (dx * cos - dy * sin)), y: tidy(cy + ky * (dx * sin + dy * cos)) }; };
  return mapTurns(placeInSet(show, i, Object.fromEntries(ids.map((id) => [id, f(pos[id])]))), i, ids, f);
}

// ---- Grid snapping.

/** Round a point to the nearest multiple of `unit` steps (0 = leave as is). */
export const snapPoint = (p: Point, unit: number): Point =>
  unit ? { x: Math.round(p.x / unit) * unit, y: Math.round(p.y / unit) * unit } : p;

/** Snap the selected performers in set i to the grid. Returns the labels of any that ended up sharing a spot. */
export function snapSelection(show: Show, i: number, ids: string[], unit: number): { show: Show; stacked: string[] } {
  const moves = Object.fromEntries(ids.map((id) => [id, snapPoint(show.sets[i].pos[id], unit)]));
  const next = placeInSet(show, i, moves);
  const byKey = new Map<string, string[]>();
  for (const p of show.performers) {
    const q = next.sets[i].pos[p.id];
    if (!q) continue;
    const k = `${q.x},${q.y}`;
    byKey.set(k, [...(byKey.get(k) ?? []), p.id]);
  }
  const stacked = [...byKey.values()].filter((g) => g.length > 1 && g.some((id) => ids.includes(id))).flat()
    .map((id) => label(show, show.performers.find((p) => p.id === id)!));
  return { show: next, stacked };
}

/** Tag set i with a color, or none. */
export const setColor = (show: Show, i: number, color: SetColor | null): Show =>
  mapSet(show, i, (s) => { const { color: _, ...rest } = s; return color ? { ...rest, color } : rest; });

export const setMeasures = (show: Show, i: number, measures: string): Show =>
  mapSet(show, i, (s) => ({ ...s, measures: measures || undefined }));

// ---- Changing hash marks.

/**
 * Re-draw every set for a different hash preset, keeping positions relative to the hashes: on the hash stays on the
 * hash, sidelines stay sidelines, and each zone (sideline–hash, hash–hash, hash–sideline) stretches proportionally.
 */
export function remapHash(show: Show, to: HashPreset): Show {
  const h0 = HASHES[show.hash], h1 = HASHES[to], W = FIELD_WIDTH;
  const y = (v: number) =>
    v <= h0 ? (v * h1) / h0
    : v >= W - h0 ? W - ((W - v) * h1) / h0
    : h1 + ((v - h0) * (W - 2 * h1)) / (W - 2 * h0);
  const sets = show.sets.map((s) => ({ ...s, pos: Object.fromEntries(Object.entries(s.pos).map(([id, p]) => [id, { x: p.x, y: y(p.y) }])) }));
  return normalizeFtl({ ...show, hash: to, sets });
}

// ---- Markup, page notes, cues.

export const setMarks = (show: Show, i: number, f: (marks: Mark[]) => Mark[]): Show =>
  mapSet(show, i, (s) => { const marks = f(s.marks ?? []); return { ...s, marks: marks.length ? marks : undefined }; });

export const setNote = (show: Show, i: number, note: string): Show => mapSet(show, i, (s) => ({ ...s, note: note || undefined }));

/** Give the performers the same cue in set i ('' clears it). */
export function setCue(show: Show, i: number, ids: string[], cue: string): Show {
  return mapSet(show, i, (s) => {
    const cues = { ...s.cues };
    for (const id of ids) { if (cue) cues[id] = cue; else delete cues[id]; }
    return { ...s, cues: Object.keys(cues).length ? cues : undefined };
  });
}

/** Pin these performers' label side in set i, or (null) go back to automatic placement. */
export function setLabelSide(show: Show, i: number, ids: string[], side: LabelSide | null): Show {
  return mapSet(show, i, (s) => {
    const labels = { ...s.labels };
    for (const id of ids) { if (side) labels[id] = side; else delete labels[id]; }
    return { ...s, labels: Object.keys(labels).length ? labels : undefined };
  });
}

/**
 * Move set i (i >= 1) to land on count `at`, keeping every other set where it is: the move into set i and the
 * move out of it trade counts. Each move keeps at least 1 count. Returns the show unchanged for set 1.
 */
export function moveSetTo(show: Show, i: number, at: number): Show {
  if (i < 1 || i >= show.sets.length) return show;
  const starts = setStarts(show);
  const hi = i + 1 < show.sets.length ? starts[i + 1] - 1 : Infinity;
  const c = Math.min(hi, Math.max(starts[i - 1] + 1, Math.round(at)));
  if (c === starts[i]) return show;
  return {
    ...show,
    sets: show.sets.map((s, j) => (j === i ? { ...s, counts: c - starts[i - 1] } : j === i + 1 ? { ...s, counts: starts[i + 1] - c } : s)),
  };
}
