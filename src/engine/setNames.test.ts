import { describe, expect, it } from 'vitest';
import { addSetAfter, insertSetAt, MAX_SET_NAME, newShow, numberSetsInOrder, parseShow, removeSet, renameSet, type Show } from './show';

const names = (s: Show) => s.sets.map((x) => x.name);
const ok = (r: ReturnType<typeof renameSet>) => { if ('error' in r) throw new Error(r.error); return r.show; };
/** Sets 1, 2, 3, 16 counts apart. */
const three = () => addSetAfter(addSetAfter(newShow(), 0, 16), 1, 16);

describe('naming a set by hand', () => {
  it('renames the set and turns off automatic renumbering', () => {
    const s = ok(renameSet(three(), 2, ' 12 '));
    expect(names(s)).toEqual(['1', '2', '12']);
    expect(s.setNaming).toBe('manual');
  });

  it('refuses a blank name, a long one, and one another set has', () => {
    const s = three();
    expect(renameSet(s, 1, '   ')).toEqual({ error: 'A set needs a name.' });
    expect(renameSet(s, 1, 'x'.repeat(MAX_SET_NAME + 1))).toHaveProperty('error');
    expect(renameSet(s, 1, '3')).toEqual({ error: "There's already a set 3." });
  });

  it("leaves the show alone when the name doesn't change", () => {
    const s = three();
    expect(ok(renameSet(s, 1, '2'))).toBe(s);
  });

  it('keeps hand-typed names when sets are added and deleted (Eli: the end picture first)', () => {
    let s = ok(renameSet(addSetAfter(newShow(), 0, 16), 1, '12')); // 1, then the closer as 12
    s = insertSetAt(s, 8).show; // a set between them: a sub-set of 1, and 12 stays 12
    expect(names(s)).toEqual(['1', '1A', '12']);
    s = ok(renameSet(s, 1, '6'));
    s = addSetAfter(s, 1); // after 6 comes 7
    expect(names(s)).toEqual(['1', '6', '7', '12']);
    s = addSetAfter(s, 0); // 2 is free
    expect(names(s)).toEqual(['1', '2', '6', '7', '12']);
    s = removeSet(s, 1); // no renumbering
    expect(names(s)).toEqual(['1', '6', '7', '12']);
    s = insertSetAt(s, 1000).show; // past the end: after 12 comes 13
    expect(names(s).at(-1)).toBe('13');
  });

  it('gives a sub-set name when the next number is taken', () => {
    const s = addSetAfter(ok(renameSet(three(), 2, '9')), 0); // after 1 comes 2, which is taken
    expect(names(s)).toEqual(['1', '1A', '2', '9']);
  });

  it('still renumbers automatically if no set was ever named by hand', () => {
    expect(names(addSetAfter(three(), 0))).toEqual(['1', '2', '3', '4']);
  });
});

describe('Renumber sets', () => {
  it('numbers every set in order, sub-sets included, and turns automatic numbering back on', () => {
    let s = insertSetAt(three(), 8).show;
    expect(names(s)).toEqual(['1', '1A', '2', '3']);
    s = ok(renameSet(s, 3, 'Hit'));
    const r = numberSetsInOrder(s);
    expect(names(r)).toEqual(['1', '2', '3', '4']);
    expect(r.setNaming).toBeUndefined();
    expect(names(addSetAfter(r, 0))).toEqual(['1', '2', '3', '4', '5']);
  });

  it('keeps each set (its id, counts, and spots), only renaming it', () => {
    const s = ok(renameSet(three(), 1, '7'));
    const r = numberSetsInOrder(s);
    expect(r.sets.map((x) => [x.id, x.counts])).toEqual(s.sets.map((x) => [x.id, x.counts]));
  });

  it('returns the same show when the sets are already 1, 2, 3', () => {
    const s = three();
    expect(numberSetsInOrder(s)).toBe(s);
  });
});

describe('set naming in a file', () => {
  it("saves and opens a hand-named show, and refuses a setting it doesn't know", () => {
    const s = ok(renameSet(three(), 2, '12'));
    const file = { ...s };
    const back = parseShow(JSON.stringify(file));
    expect(back.setNaming).toBe('manual');
    expect(names(back)).toEqual(['1', '2', '12']);
    expect(() => parseShow(JSON.stringify({ ...file, setNaming: 'sometimes' }))).toThrow(/set naming/);
  });
});
