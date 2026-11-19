// Reading a show file: the checks every show from outside goes through (a file, a link, a phone's copy, the autosave),
// and the small fixes that bring older files up to date. Files are untrusted, so anything new in a show is checked here.
// Split out of show.ts (2026-11-16) so the show's model and its file checks are each easier to read and test.
import { HASHES, type Point } from './coords';
import { validMusic } from './music';
import { validMark } from './marks';
import {
  COLOR_RE, LABEL_SIDES, MAX_PROP_SIZE, triangleWidth, MAX_MOVEMENT, MAX_NAME, MAX_PROPS, MAX_STEP_LIMIT, MAX_TURNS, MIN_STEP_LIMIT, normalizeFtl, validField,
  type DrillSet, type LabelSide, type Movement, type Performer, type Prop, type PropSpot, type Section, type Show,
} from './show';

const SHOW_ID_RE = /^[\w-]{1,64}$/;
/** Names every JavaScript object already has: never allowed as a performer, section, set, or prop id. */
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);

// Facing and guard equipment were set per performer until 2026-11-07, when they went back to being written in the notes (Jason).
const OLD_FACING: Record<string, string> = { front: 'Front', back: 'Back', side1: 'Side 1', side2: 'Side 2', 'front-side1': 'Front-Side 1', 'front-side2': 'Front-Side 2', 'back-side1': 'Back-Side 1', 'back-side2': 'Back-Side 2' };
const OLD_EQUIPMENT: Record<string, string> = { flag: 'Flag', rifle: 'Rifle', saber: 'Saber', none: 'Put down equipment' };
/** An older file's facings and equipment become performer notes on the same set ("Face Side 2 · Flag · <the note>"), so nothing written is lost. */
function oldFacingToCues(set: DrillSet & { facing?: unknown; equipment?: unknown }) {
  const add: Record<string, string[]> = {};
  for (const [field, names, pre] of [[set.facing, OLD_FACING, 'Face '], [set.equipment, OLD_EQUIPMENT, '']] as const)
    if (field && typeof field === 'object') for (const [id, v] of Object.entries(field)) if (Object.hasOwn(set.pos, id) && typeof v === 'string' && Object.hasOwn(names, v)) (add[id] ??= []).push(pre + names[v]);
  if (Object.keys(add).length) set.cues = { ...set.cues, ...Object.fromEntries(Object.entries(add).map(([id, t]) => [id, [...t, set.cues?.[id]].filter(Boolean).join(' · ')])) };
  delete set.facing; delete set.equipment;
}

export function parseShow(text: string): Show {
  return parseShowFile(text).show;
}

/** A recording or tracing picture packed into a full backup file: its type and its bytes as base64. */
export interface Attached { type: string; data: string }
export const MAX_ATTACHED_AUDIO = 25_000_000, MAX_ATTACHED_PICTURE = 10_000_000; // bytes, before base64

const mb = (bytes: number) => `${Math.round(bytes / 100_000) / 10} MB`;

/**
 * Said when a recording or picture is added, if it's too big to go in a Full backup (the limits every FreeFORM opens),
 * so a director finds out now and not on the new computer. Null when it fits.
 */
export function tooBigForBackup(kind: 'audio' | 'picture', bytes: number): string | null {
  const max = kind === 'audio' ? MAX_ATTACHED_AUDIO : MAX_ATTACHED_PICTURE;
  if (bytes <= max) return null;
  return kind === 'audio'
    ? `It's ${mb(bytes)}, too big to go in a Full backup (up to ${mb(max)}), so keep the recording's own file too. An MP3 of the same music is usually small enough.`
    : `It's ${mb(bytes)}, too big to go in a Full backup (up to ${mb(max)}), so keep the picture's own file too.`;
}

/**
 * What a Full backup will carry, checked with the same limits Import uses (parseShowFile), so a backup that saves always
 * opens again. `found`: the recording and picture as this browser has them (undefined: the show points at one that's gone).
 * `problems`: one plain sentence for each one that has to stay out.
 */
export function planBackup(show: Show, found: { audio?: { size: number }; picture?: { size: number } }): { audio: boolean; picture: boolean; problems: string[] } {
  const problems: string[] = [];
  const check = (kind: 'audio' | 'picture', wanted: boolean, blob: { size: number } | undefined, what: string): boolean => {
    if (!wanted) return false;
    if (!blob) { problems.push(`${what} isn't in this browser anymore, so the backup can't carry it.`); return false; }
    const max = kind === 'audio' ? MAX_ATTACHED_AUDIO : MAX_ATTACHED_PICTURE;
    if (blob.size > max) { problems.push(`${what} is ${mb(blob.size)}, and a Full backup can carry up to ${mb(max)}, so it stays out.${kind === 'audio' ? ' An MP3 of the same music is usually small enough.' : ''}`); return false; }
    return true;
  };
  const audio = check('audio', !!show.music, found.audio, `The recording "${show.music?.name ?? ''}"`);
  const picture = check('picture', !!show.trace, found.picture, 'The tracing picture');
  return { audio, picture, problems };
}
const ATTACHED_TYPE = { audio: /^audio\/[\w.+-]{1,40}$/, picture: /^image\/[\w.+-]{1,40}$/ };
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * A show file, and the recording and tracing picture a full backup carries ("attached": base64, see Attached).
 * The attachments are checked (type, size, base64) and taken off the show, so they never reach the autosave.
 */
export function parseShowFile(text: string): { show: Show; audio?: Attached; picture?: Attached; publishing?: unknown } {
  const s = JSON.parse(text);
  const att = s?.attached;
  if (s && typeof s === 'object') delete s.attached;
  const show = checkShow(s);
  if (att === undefined) return { show };
  const ok = (a: unknown, kind: 'audio' | 'picture', max: number): a is Attached => {
    const x = a as Attached;
    return typeof x?.type === 'string' && ATTACHED_TYPE[kind].test(x.type) && typeof x.data === 'string' && x.data.length % 4 === 0
      && x.data.length <= Math.ceil(max / 3) * 4 && B64_RE.test(x.data);
  };
  // Publishing (Full backup): the hosted link and edit token, checked where it's used (readPublishing); here only kept small.
  const publishing = att && typeof att === 'object' && att.publishing && typeof att.publishing === 'object' && JSON.stringify(att.publishing).length < 4000 ? att.publishing : undefined;
  if (typeof att !== 'object' || !att || (att.audio !== undefined && !(show.music && ok(att.audio, 'audio', MAX_ATTACHED_AUDIO)))
    || (att.picture !== undefined && !(show.trace && ok(att.picture, 'picture', MAX_ATTACHED_PICTURE)))) throw new Error('Not a valid FreeFORM show: attached recording or picture');
  return { show, ...(att.audio ? { audio: att.audio } : {}), ...(att.picture ? { picture: att.picture } : {}), ...(publishing ? { publishing } : {}) };
}

function checkShow(s: any): Show { // eslint-disable-line @typescript-eslint/no-explicit-any
  const bad = (why: string) => { throw new Error(`Not a valid FreeFORM show: ${why}`); };
  if (s?.format === 'freeform-locked') throw new Error('That is a locked copy made for a hosted link, and only the link can open it. Import the .freeform file instead.');
  if (s?.format !== 'freeform-show') bad('missing format marker');
  const str = (v: unknown) => typeof v === 'string';
  // Ids are keys in plain objects (set.pos, set.cues, …), so built-in names like __proto__ would point at the object itself.
  const okId = (v: unknown) => str(v) && !RESERVED_IDS.has(v as string);
  const own = (o: object, id: string) => Object.hasOwn(o, id);
  if (s.version !== 1) bad(`unsupported version ${s.version}`);
  if (!(str(s.hash) && Object.hasOwn(HASHES, s.hash))) bad('unknown hash preset');
  if (!Array.isArray(s.sections) || !Array.isArray(s.performers) || !Array.isArray(s.sets) || !s.sets.length) bad('missing lists');
  if (typeof s.title !== 'string') bad('title');
  if (s.id !== undefined && !(str(s.id) && SHOW_ID_RE.test(s.id))) bad('id');
  if (s.music !== undefined && !validMusic(s.music)) bad('music');
  if (s.revision !== undefined && !(Number.isInteger(s.revision) && s.revision >= 1 && s.revision <= 1e6)) bad('revision');
  if (s.revisionSig !== undefined && !(typeof s.revisionSig === 'string' && /^[0-9a-f]{1,16}$/.test(s.revisionSig))) bad('revision fingerprint');
  if (s.symbols === 'icons') delete s.symbols; // equipment icons were a choice for a day (2026-11-05): such a show opens with letters
  if (s.symbols !== undefined && s.symbols !== 'dots') bad('symbols');
  if (s.movements !== undefined && (!Array.isArray(s.movements) || s.movements.length > 100 || !s.movements.every((m: Movement) =>
    str(m?.id) && str(m.name) && m.name.length <= MAX_NAME && Number.isInteger(m.counts) && m.counts >= 1 && m.counts <= MAX_MOVEMENT))) bad('movements');
  for (const x of s.sections) if (!okId(x?.id) || !str(x.name) || !str(x.letter) || (x.color !== undefined && !COLOR_RE.test(x.color))) bad('section');
  for (const x of s.performers) if (!okId(x?.id) || !str(x.section) || !Number.isFinite(x.number) || (x.name !== undefined && (!str(x.name) || x.name.length > MAX_NAME))) bad('performer');
  if (s.props !== undefined && (!Array.isArray(s.props) || s.props.length > MAX_PROPS || !s.props.every((p: Prop) => okId(p?.id) && str(p.name) && p.name.length <= MAX_NAME
    && Number.isFinite(p.w) && p.w > 0 && p.w <= 200 && Number.isFinite(p.h) && p.h > 0 && p.h <= 200 && (p.round === undefined || typeof p.round === 'boolean')
    && (p.triangle === undefined || typeof p.triangle === 'boolean') && !(p.round && p.triangle)
    && (p.point === undefined || (Number.isFinite(p.point) && triangleWidth(p) <= MAX_PROP_SIZE))))) bad('props');
  if (s.trace !== undefined && !(str(s.trace?.id) && Number.isFinite(s.trace.x) && Number.isFinite(s.trace.y) && Number.isFinite(s.trace.w) && s.trace.w > 0
    && Number.isFinite(s.trace.opacity) && s.trace.opacity >= 0 && s.trace.opacity <= 1)) bad('trace');
  if (s.surface !== undefined && (typeof s.surface !== 'object' || !validField(s.surface))) bad('surface');
  if (s.dismissed !== undefined && !(Array.isArray(s.dismissed) && s.dismissed.length <= 5000 && s.dismissed.every((k: unknown) => typeof k === 'string' && k.length <= 20_000))) bad('dismissed warnings');
  if (s.setNaming !== undefined && s.setNaming !== 'manual') bad('set naming');
  if (s.stepLimit !== undefined && !(Number.isFinite(s.stepLimit) && s.stepLimit >= MIN_STEP_LIMIT && s.stepLimit <= MAX_STEP_LIMIT)) bad('step limit');
  const propIds = new Set((s.props ?? []).map((p: Prop) => p.id));
  // Ids are how everything points at everything else, so each must be unique, and every reference must land on something.
  const unique = (list: { id: string }[], what: string) => { if (new Set(list.map((x) => x.id)).size !== list.length) bad(`two ${what} with the same id`); };
  unique(s.sections, 'sections'); unique(s.performers, 'performers'); unique(s.sets, 'sets'); unique(s.props ?? [], 'props');
  const sectionIds = new Set(s.sections.map((x: Section) => x.id)), performerIds = new Set(s.performers.map((x: Performer) => x.id));
  for (const x of s.performers) if (!sectionIds.has(x.section)) bad(`performer in a section that isn't in the show`);
  s.sets.forEach((set: DrillSet, i: number) => {
    // The opening set has no move into it (0 counts); every other set is a move of at least one count.
    if (!(Number.isInteger(set?.counts) && set.counts >= (i ? 1 : 0) && set.counts <= MAX_MOVEMENT)) bad(`counts in set ${i + 1}`);
  });
  for (const set of s.sets) {
    if (!okId(set?.id) || !str(set.name) || !Number.isFinite(set.counts) || typeof set.pos !== 'object' || !set.pos) bad('set');
    if (Object.keys(set.pos).some((id) => !performerIds.has(id))) bad(`a spot in set ${set.name} for a performer who isn't in the show`);
    if (set.measures !== undefined && !str(set.measures)) bad('set measures');
    if (set.ftl !== undefined && (!Array.isArray(set.ftl) || !set.ftl.every((g: { order?: unknown; turns?: unknown; smooth?: unknown }) =>
      Array.isArray(g?.order) && g.order.every((id) => str(id) && own(set.pos, id)) && (g.smooth === undefined || typeof g.smooth === 'boolean') && (g.turns === undefined
        || (Array.isArray(g.turns) && g.turns.length <= MAX_TURNS && g.turns.every((p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y))))))) bad('set follow-the-leader');
    if (set.marks !== undefined && (!Array.isArray(set.marks) || !set.marks.every(validMark))) bad('set markup');
    if (set.note !== undefined && !str(set.note)) bad('set note');
    if (set.cues !== undefined && (typeof set.cues !== 'object' || !set.cues ||
      !Object.entries(set.cues).every(([id, c]) => own(set.pos, id) && str(c)))) bad('set cues');
    if (set.labels !== undefined && (typeof set.labels !== 'object' || !set.labels ||
      !Object.entries(set.labels).every(([id, side]) => own(set.pos, id) && LABEL_SIDES.includes(side as LabelSide)))) bad('set label sides');
    for (const p of Object.values(set.pos) as Point[]) if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) bad(`position in set ${set.name}`);
    if (set.paths !== undefined && (typeof set.paths !== 'object' || !set.paths || !Object.entries(set.paths).every(([id, path]) =>
      own(set.pos, id) && Array.isArray(path) && path.length <= 2001 && path.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))))) bad('set paths');
    if (set.timing !== undefined && (typeof set.timing !== 'object' || !set.timing || !Object.entries(set.timing).every(([id, tm]) => {
      const x = tm as { wait?: unknown; move?: unknown };
      return own(set.pos, id) && Number.isInteger(x?.wait) && (x.wait as number) >= 0 && Number.isInteger(x.move) && (x.move as number) >= 1;
    }))) bad('set timing');
    if (set.turning !== undefined && (!Array.isArray(set.turning) || set.turning.length > 1000 || !set.turning.every((g: unknown) =>
      Array.isArray(g) && g.length >= 2 && g.every((id) => str(id) && own(set.pos, id))))) bad('set turning');
    oldFacingToCues(set);
    if (set.props !== undefined && (typeof set.props !== 'object' || !set.props || !Object.entries(set.props).every(([id, q]) => {
      const x = q as PropSpot;
      return propIds.has(id) && Number.isFinite(x?.x) && Number.isFinite(x.y) && Number.isFinite(x.angle);
    }))) bad('set props');
  }
  return normalizeFtl(s as Show);
}
