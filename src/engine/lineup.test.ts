import { describe, expect, it } from 'vitest';
import { attackStrength, barName, barTimes, firstFullBar, mergeDownbeats, scoreToRecording, snapToAttacks, warpTaps } from './lineup';
import type { Midi } from './midi';

// A 12-bar score in 4/4 at 120 (a beat every 0.5 s), as the score readers give it.
const PPQ = 480;
const score = (bars = 12, first?: { beats: number }): Midi => ({
  ppq: PPQ, tempos: [[0, 500_000]], end: bars * 4 * PPQ,
  measures: Array.from({ length: bars }, (_, k) => ({ start: k * 4 * PPQ - (first && k ? (4 - first.beats) * PPQ : 0), beats: k === 0 && first ? first.beats : 4, den: 4, sounding: true })),
});
const beatTimes = (m: Midi) => Array.from({ length: m.measures.length * 4 + 1 }, (_, k) => k * 0.5); // the score's counts, in seconds

describe('lining up a recording with its score', () => {
  it('names bars, and starts after a short pickup', () => {
    expect(barTimes(score(3))).toEqual([0, 2, 4]);
    expect(firstFullBar(score(4))).toBe(0);
    expect(firstFullBar(score(4, { beats: 1 }))).toBe(1);
    const m = score(3);
    m.measures[2].written = 1; // a repeat: the third bar heard is printed bar 1
    expect(barName(m, 0)).toBe('bar 1');
    expect(barName(m, 2)).toBe('bar 3 (printed bar 1)');
  });

  it('places counts between tapped bars by the score, and keeps the score tempo outside them', () => {
    const m = score();
    // Recording: bar 2 (index 1) at 3.0 s, bar 4 (index 3) at 7.4 s: those 2 bars take 4.4 s instead of 4.
    const to = scoreToRecording(m, [{ bar: 1, at: 3 }, { bar: 3, at: 7.4 }]);
    expect(to(2)).toBeCloseTo(3); // bar 2's beat 1
    expect(to(4)).toBeCloseTo(5.2); // bar 3: halfway between the taps
    expect(to(6)).toBeCloseTo(7.4);
    expect(to(0)).toBeCloseTo(0.8); // before the first tap: the tapped bars' pace (1.1× the score's), back from it
    expect(to(10)).toBeCloseTo(11.8); // after the last: the same pace on from it
    expect(scoreToRecording(m, [{ bar: 1, at: 3 }])(6)).toBeCloseTo(7); // one tap: the score's own tempo
    expect(scoreToRecording(m, [])(3)).toBe(3);
  });

  it('drops a slipped tap that goes backward', () => {
    const to = scoreToRecording(score(), [{ bar: 1, at: 3 }, { bar: 2, at: 2.5 }, { bar: 3, at: 7 }]);
    expect(to(4)).toBeCloseTo(5);
  });

  it('keeps the counts moving forward and never before the start of the recording', () => {
    const w = warpTaps([0, 0.5, 1], (s) => s - 0.7);
    expect(w[0]).toBe(0); expect(w[1]).toBe(0.001); expect(w[2]).toBeCloseTo(0.3);
  });

  it('joins a redo of some bars to the earlier taps', () => {
    const earlier = [0, 1, 2, 3, 4, 5].map((bar) => ({ bar, at: bar * 2 }));
    expect(mergeDownbeats(earlier, 2, [4.1, 6.2])).toEqual([{ bar: 0, at: 0 }, { bar: 1, at: 2 }, { bar: 2, at: 4.1 }, { bar: 3, at: 6.2 }, { bar: 4, at: 8 }, { bar: 5, at: 10 }]);
    expect(mergeDownbeats(earlier, 2, [])).toBe(earlier);
  });

  it('snaps a tap to the attack it was reaching for, and leaves a tap with nothing near it alone', () => {
    const hop = 256 / 22050, s = new Float32Array(1000);
    s[Math.round((2 - 0.75 * 1024 / 22050) / hop)] = 6; // an attack at 2 s (its strength peaks 3/4 of a window earlier)
    const r = snapToAttacks([2.05, 5], s);
    expect(r.times[0]).toBeCloseTo(2, 1);
    expect(r.times[1]).toBe(5);
    expect(r.snapped).toBe(1);
  });

  it('end to end: a band recording that slows down, tapped a little off, lands every count within 15 ms', () => {
    const m = score();
    // The "real" recording: starts 1.7 s in, bars 1–6 at 104 bpm, then it settles back to 96. Clicks on every beat.
    const rate = 22050, truth: number[] = [];
    let t = 1.7;
    for (let k = 0; k <= 48; k++) { truth.push(t); t += 60 / (k < 24 ? 104 : 96); }
    const audio = new Float32Array(Math.ceil((t + 1) * rate));
    let seed = 7;
    const noise = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 30 - 1; };
    truth.forEach((at, k) => { const i0 = Math.round(at * rate); for (let i = 0; i < 400; i++) audio[i0 + i] += noise() * (k % 4 === 0 ? 0.9 : 0.5) * Math.exp(-i / 80); });
    // Beat 1 of every bar, each tap 30–45 ms early or late, as people tap.
    const downbeats = truth.filter((_, k) => k % 4 === 0).slice(0, 12).map((at, bar) => at + (bar % 2 ? 0.045 : -0.03));
    const { times, snapped } = snapToAttacks(downbeats, attackStrength([audio], rate));
    expect(snapped).toBe(12);
    const to = scoreToRecording(m, mergeDownbeats([], 0, times));
    const counts = warpTaps(beatTimes(m), to);
    const worst = Math.max(...counts.slice(0, 49).map((c, k) => Math.abs(c - truth[k])));
    expect(worst).toBeLessThan(0.015);
    // Without the line-up, the score's own timing (even started at the right place) is off by seconds by the end.
    expect(Math.abs(beatTimes(m)[47] + 1.7 - truth[47])).toBeGreaterThan(3);
  });
});
