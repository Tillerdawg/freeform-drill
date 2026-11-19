import { describe, expect, it } from 'vitest';
import { newShow } from '../engine/show';
import { filesToSweep, filesUsed, phoneFiles, readAutosave, writeAutosave } from './showStore';

describe('filesUsed', () => {
  it('finds the recording and picture ids, even in a show that no longer opens', () => {
    expect(filesUsed(JSON.stringify({ format: 'freeform-show', music: { audioId: 'a1' }, trace: { id: 't1' } }))).toEqual(['a1', 't1']);
    expect(filesUsed(JSON.stringify({ format: 'something-old', music: { audioId: 'a2' } }))).toEqual(['a2']);
    expect(filesUsed(JSON.stringify({ format: 'freeform-show' }))).toEqual([]);
  });

  it('says it cannot tell (null) when the text is not JSON, so nothing gets deleted', () => {
    expect(filesUsed('{not json')).toBeNull();
  });
});

describe('the autosave in localStorage', () => {
  /** A localStorage stand-in that refuses anything bigger than `room` characters, like a full browser. */
  const fakeStore = (room: number) => {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { if (v.length > room) throw new Error('QuotaExceededError'); m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    };
  };
  const show = (id: string, title: string) => ({ ...newShow(), id, title });

  it('writes the show, and a reload opens it', () => {
    const st = fakeStore(1e6);
    expect(writeAutosave(show('s1', 'Opener'), st)).toBe(true);
    const r = readAutosave(st);
    expect(r && 'raw' in r && JSON.parse(r.raw).title).toBe('Opener');
  });

  it('when the show is too big, takes the old copy out so a reload opens the library copy, never a stale one', () => {
    const st = fakeStore(1e6);
    writeAutosave(show('s1', 'Small and old'), st);
    const big = { ...show('s1', 'Big and new'), sets: [{ ...newShow().sets[0], note: 'x'.repeat(2e6) }] };
    expect(writeAutosave(big, st)).toBe(false);
    expect(readAutosave(st)).toEqual({ id: 's1' });
  });

  it('goes back to the full copy once the show fits again', () => {
    const st = fakeStore(1e6);
    writeAutosave({ ...show('s1', 'Big'), sets: [{ ...newShow().sets[0], note: 'x'.repeat(2e6) }] }, st);
    writeAutosave(show('s1', 'Trimmed'), st);
    const r = readAutosave(st);
    expect(r && 'raw' in r && JSON.parse(r.raw).title).toBe('Trimmed');
  });

  it('opens nothing on a first visit', () => {
    expect(readAutosave(fakeStore(1e6))).toBeNull();
  });
});

describe('clearing away recordings and pictures nothing uses (removed music waits, so Undo can bring it back)', () => {
  it('keeps every file a show, a version, the open show, or the phone list uses', () => {
    expect(filesToSweep(['a1', 't1', 'p1'], [['a1'], ['t1'], ['p1']], ['a1', 't1', 'p1'])).toEqual({ drop: [], unused: [] });
  });

  it('deletes an unused file only when it was unused at the last sweep too', () => {
    const first = filesToSweep(['a1', 'old'], [['a1']], []);
    expect(first).toEqual({ drop: [], unused: ['old'] }); // just removed (or just stored by another tab): wait
    expect(filesToSweep(['a1', 'old'], [['a1']], first.unused)).toEqual({ drop: ['old'], unused: [] });
  });

  it('deletes nothing when a show or list cannot be read', () => {
    expect(filesToSweep(['a1', 'old'], [['a1'], null], ['old'])).toEqual({ drop: [], unused: [] });
  });

  it("finds the recordings in the phone's own list of shows", () => {
    expect(phoneFiles(JSON.stringify({ shows: [{ show: { music: { audioId: 'a9' } } }, { show: {} }], current: 0 }))).toEqual(['a9']);
    expect(phoneFiles(null)).toEqual([]);
    expect(phoneFiles('{broken')).toBeNull();
  });
});
