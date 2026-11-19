import { describe, expect, it } from 'vitest';
import { addPerformer, addSetAfter, newShow, nextRevision, placeInSet, removeSet, setCounts, setCue, setNote, setTiming, type Show } from '../engine/show';
import { changedForPrint, changesFor, mergeChanges, readChanges } from './changes';

/** Two trumpets in four sets of 8 counts, at revision 6. */
function band() {
  let show = newShow();
  const t = show.sections.find((s) => s.letter === 'T')!.id;
  const a = addPerformer(show, t, { x: 0, y: 28 }); show = a.show;
  const b = addPerformer(show, t, { x: 4, y: 28 }); show = b.show;
  for (let i = 0; i < 3; i++) show = addSetAfter(show, i, 8);
  for (let i = 1; i < 4; i++) show = placeInSet(show, i, { [a.id]: { x: -8 * i, y: 28 }, [b.id]: { x: 4 - 8 * i, y: 28 } });
  for (let k = 0; k < 6; k++) show = nextRevision(show);
  return { show, me: a.id, other: b.id };
}
const ids = (show: Show, ...i: number[]) => i.map((k) => show.sets[k].id);

describe('what changed for me in an update', () => {
  it('names the sets where my spot moved, and says which revisions', () => {
    const { show, me } = band();
    const next = nextRevision(placeInSet(show, 2, { [me]: { x: -16, y: 32 } }));
    expect(changesFor(show, next, me)).toEqual({ from: 6, to: 7, sets: [{ id: show.sets[2].id, what: ['spot'] }], gone: [] });
  });

  it("says nothing changed for me when only someone else's spot moved", () => {
    const { show, me, other } = band();
    const next = nextRevision(placeInSet(show, 2, { [other]: { x: 0, y: 40 } }));
    expect(changesFor(show, next, me)!.sets).toEqual([]);
  });

  it('finds new sets, changed counts, my notes, the ensemble notes, and sets taken out', () => {
    const { show, me } = band();
    let next = setCounts(show, 1, 12);
    next = setCue(next, 2, [me], 'Horns up on 5');
    next = setNote(next, 3, 'Guard: flag toss');
    next = removeSet(next, 3);
    next = addSetAfter(next, 2, 8);
    const c = changesFor(show, next, me)!;
    expect(c.sets).toEqual([
      { id: show.sets[1].id, what: ['counts'] },
      { id: show.sets[2].id, what: ['notes'] },
      { id: next.sets[3].id, what: ['new'] },
    ]);
    expect(c.gone).toEqual([show.sets[3].name]);
  });

  it('finds a new way to get to the same spot (a delayed step-off)', () => {
    const { show, me } = band();
    const next = setTiming(show, 2, [me], 4, 4); // hold 4, move 4: same start, end, and counts
    expect(changesFor(show, next, me)!.sets).toEqual([{ id: show.sets[2].id, what: ['route'] }]);
  });

  it('compares the whole band for Staff, and nothing for a performer who is new or not picked yet', () => {
    const { show, me, other } = band();
    const next = placeInSet(show, 1, { [other]: { x: 0, y: 40 } });
    expect(changesFor(show, next, 'staff')).toMatchObject({ staff: true, sets: [{ id: show.sets[1].id, what: ['spot'] }] });
    expect(changesFor(show, next, null)).toBeNull();
    const t = show.sections[0].id, added = addPerformer(next, t, { x: 10, y: 10 });
    expect(changesFor(show, added.show, added.id)).toBeNull();
    expect(changesFor(show, next, me)!.sets).toEqual([]);
  });
});

describe('two updates before the student looked', () => {
  it('keeps every change since the copy they last looked at', () => {
    const { show, me } = band();
    const [s1, s2] = ids(show, 1, 2);
    const merged = mergeChanges({ from: 6, to: 7, sets: [{ id: s2, what: ['spot'] }], gone: [] },
      { from: 7, to: 8, sets: [{ id: s1, what: ['counts'] }, { id: s2, what: ['notes'] }], gone: ['9'] }, show.sets.map((s) => s.id));
    expect(merged).toEqual({ from: 6, to: 8, sets: [{ id: s1, what: ['counts'] }, { id: s2, what: ['spot', 'notes'] }], gone: ['9'] });
    expect(me).toBeTruthy();
  });
});

describe('changes kept on the phone', () => {
  it('read back checked, dropping anything that is not a known change', () => {
    expect(readChanges({ from: 6, to: 7, sets: [{ id: 'set1', what: ['spot', 'oops'] }, { id: 2, what: ['spot'] }], gone: ['4', 5] }))
      .toEqual({ from: 6, to: 7, sets: [{ id: 'set1', what: ['spot'] }], gone: ['4'] });
    expect(readChanges('junk')).toBeUndefined();
  });
});

describe('printing just what changed', () => {
  it('gives each performer only the sets where their card changed, and the charts every set that changed', () => {
    const { show, me, other } = band();
    let next = placeInSet(show, 2, { [me]: { x: -16, y: 32 } }); // my spot in set 3
    next = setNote(next, 3, 'Guard: flag toss'); // an ensemble note in set 4: on the chart, not on dot sheets
    next = setCounts(next, 1, 12); // everyone's set 2
    const p = changedForPrint(show, next);
    expect([...p.sets].sort()).toEqual([1, 2, 3]);
    expect([...p.byPerformer.get(me)!].sort()).toEqual([1, 2]);
    expect([...p.byPerformer.get(other)!]).toEqual([1]);
  });

  it('gives a performer who is new since then every set', () => {
    const { show } = band();
    const added = addPerformer(show, show.sections[0].id, { x: 10, y: 10 });
    expect(changedForPrint(show, added.show).byPerformer.get(added.id)!.size).toBe(show.sets.length);
  });
});
