// "What changed for me?": when a newer copy of a show reaches a phone, compare it with the copy the phone had, for the
// performer who uses the phone. Sets are matched by their ids (they keep them through renaming and reordering), and
// performers by theirs. A student at rehearsal can then hear "revision 7 is out" and know what to relearn.
import type { Point } from '../engine/coords';
import { positionsAt, setStarts, type Show } from '../engine/show';

/** What changed in one set: `new` (a set that wasn't there), my `spot`, its `counts`, `route` (how I get there: the path,
 * a step-off, a follow-the-leader), my `notes`, or the `ensemble` notes. For staff, `spot` means anyone's spot. */
export type What = 'new' | 'spot' | 'counts' | 'route' | 'notes' | 'ensemble';
const WHATS: What[] = ['new', 'spot', 'counts', 'route', 'notes', 'ensemble'];

export interface Changes {
  /** The revisions compared (either can be missing, for a show from before revision numbers). */
  from?: number;
  to?: number;
  /** Changed sets, by set id, in show order. Empty: nothing changed for this performer. */
  sets: { id: string; what: What[] }[];
  /** Names of sets that were taken out. */
  gone: string[];
  /** Compared for the whole band (Staff), not one performer. */
  staff?: boolean;
}

const same = (a: Point | undefined, b: Point | undefined) => (!a && !b) || (!!a && !!b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01);

/** One set of `next`, compared with the same set (by id) in `old`: what changed for the set, and for each performer in `who`. */
interface SetCompare { id: string; index: number; isNew: boolean; counts: boolean; ensemble: boolean; per: Map<string, What[]> }

/**
 * The comparison under both the phone's "What changed for you" and Print's "only what changed": each performer's spot,
 * their route (same spots and counts, a different way there), and their notes, plus each set's counts and ensemble
 * notes. One pass over the counts covers every performer, so a whole band is quick.
 */
function compare(old: Show, next: Show, who: string[]): SetCompare[] {
  const oldAt = new Map(old.sets.map((s, i) => [s.id, i])), oldStarts = setStarts(old), newStarts = setStarts(next);
  return next.sets.map((s, i) => {
    const j = oldAt.get(s.id), per = new Map<string, What[]>();
    if (j === undefined) return { id: s.id, index: i, isNew: true, counts: false, ensemble: false, per };
    const o = old.sets[j], add = (id: string, w: What) => (per.get(id) ?? per.set(id, []).get(id)!).push(w);
    for (const id of who) if (!same(o.pos[id], s.pos[id])) add(id, 'spot');
    // How they get there: same start and end, same counts, but a different route count by count (a path, a step-off, a
    // turn). Only for performers whose spots at both ends are the same: a moved spot already says it (the route follows).
    const prevSame = i > 0 && j > 0 && old.sets[j - 1].id === next.sets[i - 1].id;
    let steady = prevSame && o.counts === s.counts ? who.filter((id) => same(o.pos[id], s.pos[id]) && same(old.sets[j - 1].pos[id], next.sets[i - 1].pos[id])) : [];
    for (let k = 1; steady.length && k < s.counts; k++) {
      const a = positionsAt(old, oldStarts[j - 1] + k), b = positionsAt(next, newStarts[i - 1] + k);
      const moved = steady.filter((id) => !same(a[id], b[id]));
      for (const id of moved) add(id, 'route');
      steady = steady.filter((id) => !moved.includes(id));
    }
    for (const id of who) if ((o.cues?.[id] ?? '') !== (s.cues?.[id] ?? '')) add(id, 'notes');
    return { id: s.id, index: i, isNew: false, counts: i > 0 && o.counts !== s.counts, ensemble: (o.note ?? '') !== (s.note ?? ''), per };
  });
}
const inBoth = (old: Show, next: Show) => next.performers.map((p) => p.id).filter((id) => old.performers.some((p) => p.id === id));
const ordered = (ws: Iterable<What>) => { const set = new Set(ws); return WHATS.filter((w) => set.has(w)); };

/**
 * What changed between the phone's old copy and the new one, for performer `me` (STAFF compares everyone). Null when
 * there's nothing to compare for them: no one picked yet, or a performer who isn't in both copies.
 */
export function changesFor(old: Show, next: Show, me: string | null, staffId = 'staff'): Changes | null {
  if (!me) return null;
  const staff = me === staffId;
  if (!staff && !(old.performers.some((p) => p.id === me) && next.performers.some((p) => p.id === me))) return null;
  const sets: Changes['sets'] = [];
  for (const c of compare(old, next, staff ? inBoth(old, next) : [me])) {
    const mine = staff ? [...c.per.values()].flat().filter((w) => w !== 'notes') : c.per.get(me) ?? [];
    const what = c.isNew ? ['new' as What] : ordered([...mine, ...(c.counts ? ['counts' as What] : []), ...(c.ensemble ? ['ensemble' as What] : [])]);
    if (what.length) sets.push({ id: c.id, what });
  }
  const kept = new Set(next.sets.map((s) => s.id));
  return {
    ...(old.revision ? { from: old.revision } : {}), ...(next.revision ? { to: next.revision } : {}),
    sets, gone: old.sets.filter((s) => !kept.has(s.id)).map((s) => s.name), ...(staff ? { staff: true } : {}),
  };
}

/**
 * For printing just what changed since `old`: the sets (indexes in `next`) with any change, for drill charts; and for each
 * performer, the sets where their own card changed (a new set, the counts, their spot, route, or notes), for dot sheets.
 * A performer who wasn't in `old` gets every set.
 */
export function changedForPrint(old: Show, next: Show): { sets: Set<number>; byPerformer: Map<string, Set<number>> } {
  const sets = new Set<number>(), byPerformer = new Map<string, Set<number>>();
  const mark = (id: string, i: number) => (byPerformer.get(id) ?? byPerformer.set(id, new Set()).get(id)!).add(i);
  const both = new Set(inBoth(old, next));
  for (const c of compare(old, next, [...both])) {
    if (c.isNew || c.counts || c.ensemble || c.per.size) sets.add(c.index);
    for (const p of next.performers) if (c.isNew || c.counts || c.per.has(p.id) || !both.has(p.id)) mark(p.id, c.index);
  }
  return { sets, byPerformer };
}

/**
 * Two updates in a row before the student looked: what changed since the copy they last looked at. A set that's in
 * both keeps every kind of change; a set taken out after being changed is just taken out.
 */
export function mergeChanges(prev: Changes | undefined, next: Changes, kept: string[]): Changes {
  if (!prev || prev.staff !== next.staff) return next;
  const byId = new Map<string, Set<What>>();
  for (const c of [...prev.sets, ...next.sets]) for (const w of c.what) (byId.get(c.id) ?? byId.set(c.id, new Set()).get(c.id)!).add(w);
  return {
    ...(prev.from ? { from: prev.from } : {}), ...(next.to ? { to: next.to } : {}),
    sets: kept.filter((id) => byId.has(id)).map((id) => ({ id, what: WHATS.filter((w) => byId.get(id)!.has(w)) })),
    gone: [...new Set([...prev.gone, ...next.gone])], ...(next.staff ? { staff: true } : {}),
  };
}

/** Changes read back from the phone's storage, checked (storage can hold anything). Undefined if it doesn't read. */
export function readChanges(x: unknown): Changes | undefined {
  const c = x as Changes;
  if (!c || typeof c !== 'object' || !Array.isArray(c.sets) || !Array.isArray(c.gone)) return undefined;
  const sets = c.sets.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.what))
    .map((s) => ({ id: s.id, what: s.what.filter((w): w is What => WHATS.includes(w)) })).filter((s) => s.what.length);
  const num = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 ? (n as number) : undefined);
  const from = num(c.from), to = num(c.to);
  return { ...(from ? { from } : {}), ...(to ? { to } : {}), sets, gone: c.gone.filter((g) => typeof g === 'string'), ...(c.staff === true ? { staff: true } : {}) };
}
