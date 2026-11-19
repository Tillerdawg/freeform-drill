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

/**
 * What changed between the phone's old copy and the new one, for performer `me` (STAFF compares everyone). Null when
 * there's nothing to compare for them: no one picked yet, or a performer who isn't in both copies.
 */
export function changesFor(old: Show, next: Show, me: string | null, staffId = 'staff'): Changes | null {
  if (!me) return null;
  const staff = me === staffId;
  if (!staff && !(old.performers.some((p) => p.id === me) && next.performers.some((p) => p.id === me))) return null;
  const who = staff ? next.performers.map((p) => p.id).filter((id) => old.performers.some((p) => p.id === id)) : [me];
  const oldAt = new Map(old.sets.map((s, i) => [s.id, i])), oldStarts = setStarts(old), newStarts = setStarts(next);
  const sets: Changes['sets'] = [];
  next.sets.forEach((s, i) => {
    const j = oldAt.get(s.id);
    if (j === undefined) { sets.push({ id: s.id, what: ['new'] }); return; }
    const o = old.sets[j], what: What[] = [];
    if (who.some((id) => !same(o.pos[id], s.pos[id]))) what.push('spot');
    if (i > 0 && o.counts !== s.counts) what.push('counts');
    // How I get there: same start and end, same counts, but a different route count by count (a path, a step-off, a turn).
    // Only for performers whose spots at both ends are the same: a moved spot already says it (the route follows).
    const prevSame = i > 0 && j > 0 && old.sets[j - 1].id === next.sets[i - 1].id;
    const steady = prevSame && o.counts === s.counts ? who.filter((id) => same(o.pos[id], s.pos[id]) && same(old.sets[j - 1].pos[id], next.sets[i - 1].pos[id])) : [];
    for (let k = 1; steady.length && k < s.counts; k++) {
      const a = positionsAt(old, oldStarts[j - 1] + k), b = positionsAt(next, newStarts[i - 1] + k);
      if (steady.some((id) => !same(a[id], b[id]))) { what.push('route'); break; }
    }
    if (!staff && (o.cues?.[me] ?? '') !== (s.cues?.[me] ?? '')) what.push('notes');
    if ((o.note ?? '') !== (s.note ?? '')) what.push('ensemble');
    if (what.length) sets.push({ id: s.id, what });
  });
  const kept = new Set(next.sets.map((s) => s.id));
  return {
    ...(old.revision ? { from: old.revision } : {}), ...(next.revision ? { to: next.revision } : {}),
    sets, gone: old.sets.filter((s) => !kept.has(s.id)).map((s) => s.name), ...(staff ? { staff: true } : {}),
  };
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
