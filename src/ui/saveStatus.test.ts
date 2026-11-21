import { describe, expect, it } from 'vitest';
import { saveStatus, type SaveState } from './saveStatus';

const base: SaveState = { browserOk: true, unexported: null, fileSavedAt: null, changedSincePublish: false, when: () => '2:14 PM' };

describe('the save status chip', () => {
  it('a new show: saved in the browser, nothing else yet', () => {
    const s = saveStatus(base);
    expect(s.label).toBe('Browser ✓ · File: no changes · Phones: not published');
    expect(s.attention).toBe(false);
  });
  it('all three layers up to date', () => {
    const s = saveStatus({ ...base, fileSavedAt: 1, revision: 6 });
    expect(s.label).toBe('Browser ✓ · File: 2:14 PM · Phones: rev 6');
    expect(s.attention).toBe(false);
    expect(s.phones).toMatch(/Revision 6 is the last one you sent out .*the drill as it is now/);
    expect(s.phones).toMatch(/may still have an older one/); // the editor can't know what an offline phone has
  });
  it('says what needs saving, in words', () => {
    const s = saveStatus({ ...base, unexported: 1, fileSavedAt: 1, revision: 6, changedSincePublish: true });
    expect(s.label).toBe('Browser ✓ · File: unsaved changes · Phones: rev 6 + changes');
    expect(s.attention).toBe(true);
    expect(s.file).toMatch(/^Changes since you last saved a file/);
    expect(s.phones).toMatch(/Publish again/);
  });
  it('says so when the browser can\'t save', () => {
    const s = saveStatus({ ...base, browserOk: false });
    expect(s.label).toMatch(/^Browser: not saved/);
    expect(s.attention).toBe(true);
    expect(s.browser).toMatch(/Save a file now/);
  });
  it('gives the top bar a word or two: the most urgent thing first', () => {
    expect(saveStatus(base).short).toBe('✓ Saved');
    expect(saveStatus({ ...base, revision: 3, changedSincePublish: true }).short).toBe('Phones behind');
    expect(saveStatus({ ...base, unexported: 5, revision: 3, changedSincePublish: true }).short).toBe('Unsaved changes');
    expect(saveStatus({ ...base, browserOk: false, unexported: 5 }).short).toBe('⚠ Not saved');
  });
});
