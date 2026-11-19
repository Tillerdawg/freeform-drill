import { describe, expect, it } from 'vitest';
import { MAX_ATTACHED_AUDIO, MAX_ATTACHED_PICTURE, newShow, parseShowFile, planBackup, tooBigForBackup, type Show } from './show';

const withMedia = (): Show => ({
  ...newShow(),
  music: { name: 'Opener.wav', audioId: 'a1', taps: [] },
  trace: { id: 't1', x: 0, y: 26, w: 40, opacity: 0.5 },
});
/** A Full backup's text the way the editor writes it, with `bytes` of made-up audio. */
const backupText = (show: Show, audioBytes?: number) => JSON.stringify({
  ...show,
  attached: audioBytes === undefined ? {} : { audio: { type: 'audio/wav', data: btoa('x'.repeat(audioBytes)) } },
});

describe('Full backup: what it carries matches what Import opens', () => {
  it('carries a recording and picture that fit', () => {
    expect(planBackup(withMedia(), { audio: { size: 5_000_000 }, picture: { size: 1_000_000 } })).toEqual({ audio: true, picture: true, problems: [] });
  });

  it('leaves out a recording too big for Import, and says so by name, so the backup still opens', () => {
    const plan = planBackup(withMedia(), { audio: { size: MAX_ATTACHED_AUDIO + 1 }, picture: { size: 1 } });
    expect(plan.audio).toBe(false);
    expect(plan.picture).toBe(true);
    expect(plan.problems).toHaveLength(1);
    expect(plan.problems[0]).toContain('"Opener.wav"');
    expect(plan.problems[0]).toContain('25 MB');
  });

  it('names a picture too big, and a recording or picture missing from this browser', () => {
    expect(planBackup(withMedia(), { audio: undefined, picture: { size: MAX_ATTACHED_PICTURE + 1 } }).problems).toEqual([
      expect.stringContaining("isn't in this browser anymore"),
      expect.stringContaining('tracing picture is 10'),
    ]);
  });

  it('asks nothing of a show with no recording or picture', () => {
    expect(planBackup(newShow(), {})).toEqual({ audio: false, picture: false, problems: [] });
  });

  it('Import opens a recording right at the limit (the limit the plan uses is the one Import uses)', () => {
    const limit = MAX_ATTACHED_AUDIO - (MAX_ATTACHED_AUDIO % 3); // whole base64 groups
    expect(parseShowFile(backupText(withMedia(), limit)).audio).toBeDefined();
    expect(() => parseShowFile(backupText(withMedia(), MAX_ATTACHED_AUDIO + 3))).toThrow('attached recording');
  });

  it('warns when a recording or picture is added that is too big for a Full backup', () => {
    expect(tooBigForBackup('audio', MAX_ATTACHED_AUDIO)).toBeNull();
    expect(tooBigForBackup('audio', 100_000_000)).toContain('100 MB');
    expect(tooBigForBackup('picture', MAX_ATTACHED_PICTURE + 1)).toContain('Full backup');
  });
});
