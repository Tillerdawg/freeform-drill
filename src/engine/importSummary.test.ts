import { describe, expect, it } from 'vitest';
import { importSummary } from './importSummary';
import { practiceShow, sampleShow } from './sample';

describe('the summary after an import', () => {
  it('says what came in: performers, sets, measures, routes, and the recording', () => {
    const show = sampleShow();
    const s = importSummary({ ...show, music: { name: 'Opener.mp3', audioId: 'a1', taps: [] } }, { audio: true, notes: [] });
    expect(s.came[0]).toMatch(/^47 performers in \d+ sections/);
    expect(s.came[1]).toMatch(new RegExp(`^${show.sets.length} sets \\(1 to ${show.sets.at(-1)!.name}\\), \\d+ counts\\.$`));
    expect(s.came).toContain('The recording ("Opener.mp3"), timed to the counts.');
  });

  it('says when only the timing came, not the recording', () => {
    const s = importSummary({ ...sampleShow(), music: { name: 'Opener.mp3', audioId: 'a1', taps: [] } }, { audio: false, notes: [] });
    expect(s.came.some((l) => l.includes('but not the recording itself'))).toBe(true);
  });

  it("lists the importer's notes first, then what Review finds, with the problems to go to", () => {
    const s = importSummary(practiceShow(), { audio: false, notes: ['Not brought in: midsets.'] });
    expect(s.check[0]).toBe('Not brought in: midsets.');
    expect(s.check.slice(1).every((l) => l.startsWith('Review finds '))).toBe(true);
    expect(s.check.length).toBeGreaterThan(1);
    expect(s.issues.length).toBeGreaterThan(0);
  });

  it('has nothing to check for a clean show', () => {
    expect(importSummary(sampleShow(), { audio: false, notes: [] }).check).toEqual([]);
  });
});
