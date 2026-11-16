// Lining up a real recording with its score. A band's or a studio's recording doesn't keep the score's tempo exactly,
// so the score's timing alone drifts. The drill writer taps beat 1 of some bars (all of them, or just where the
// recording pulls away from the score); each tap is nudged onto the attack it was reaching for in the recording; and
// every count is then placed by the score between the nearest taps. Before the first tap and after the last, counts
// keep the pace of the nearest tapped bars, following the score's own tempo changes.
import { onsetStrength } from './beats';
import { secondsAt, type Midi } from './midi';

/** A tapped bar: its index in the order heard (0 = the first bar) and where its beat 1 is in the recording (seconds). */
export interface Downbeat { bar: number; at: number }

/** Each bar's start in the score's own timing (seconds), in the order heard. */
export const barTimes = (m: Midi): number[] => m.measures.map((x) => secondsAt(m, x.start));

/** A bar's name for the tap screen: its number in the order heard, and its printed number when repeats moved it. */
export function barName(m: Midi, bar: number): string {
  const x = m.measures[bar], heard = bar + 1;
  return x?.written !== undefined && x.written !== heard ? `bar ${heard} (printed bar ${x.written})` : `bar ${heard}`;
}

/** The first bar to tap: bar 1, or bar 2 when bar 1 is a short pickup (its beat 1 is silent). */
export function firstFullBar(m: Midi): number {
  const [a, b] = m.measures;
  return a && b && a.beats / a.den < b.beats / b.den ? 1 : 0;
}

/**
 * Score time (seconds) → recording time, through the tapped bars: straight lines between taps, and the pace of the
 * nearest few tapped bars (against the score's own timing) before the first and after the last. One tap: the score's tempo. Taps that don't move forward in both are dropped (a slip).
 */
export function scoreToRecording(m: Midi, downbeats: Downbeat[]): (s: number) => number {
  const bars = barTimes(m), pts: [number, number][] = [];
  for (const d of [...downbeats].sort((a, b) => a.bar - b.bar)) {
    const s = bars[d.bar];
    if (s === undefined || !Number.isFinite(d.at)) continue;
    const last = pts[pts.length - 1];
    if (!last || (s > last[0] && d.at > last[1])) pts.push([s, d.at]);
  }
  if (!pts.length) return (s) => s;
  // Past the ends, the pace of the nearest few tapped bars (one long fermata bar doesn't set it), as tapping counts keeps its last pace.
  const n = pts.length, k = Math.min(n - 1, 4);
  const head = k ? (pts[k][1] - pts[0][1]) / (pts[k][0] - pts[0][0]) : 1, tail = k ? (pts[n - 1][1] - pts[n - 1 - k][1]) / (pts[n - 1][0] - pts[n - 1 - k][0]) : 1;
  return (s) => {
    if (s <= pts[0][0]) return pts[0][1] + (s - pts[0][0]) * head;
    const z = pts[n - 1];
    if (s >= z[0]) return z[1] + (s - z[0]) * tail;
    let k = 1;
    while (pts[k][0] < s) k++;
    const [s0, r0] = pts[k - 1], [s1, r1] = pts[k];
    return r0 + ((s - s0) * (r1 - r0)) / (s1 - s0);
  };
}

/** The taps for every count: the score's count times carried into the recording, kept strictly increasing and at 0 or later. */
export function warpTaps(scoreTaps: number[], toRecording: (s: number) => number): number[] {
  const out: number[] = [];
  for (const s of scoreTaps) {
    const t = Math.max(0, toRecording(s));
    out.push(out.length && t <= out[out.length - 1] ? out[out.length - 1] + 0.001 : t);
  }
  return out;
}

const HOP = 256 / 22050; // onsetStrength's frame length (seconds)
// onsetStrength frame f looks at 1024 samples from f * HOP, and a sharp attack raises it most when it's three-quarters of
// the way into that window (where the Hann window rises fastest), so the attack itself is this much after the frame's start.
const LAG = (0.75 * 1024) / 22050;

/**
 * Nudge each tap onto the strongest attack within `reach` seconds of it, when that attack is clearly there (`strong`
 * times the recording's typical level). People tap a little early or late; the recording's attack is where beat 1 is.
 * Returns the nudged times and how many found an attack.
 */
export function snapToAttacks(times: number[], strength: Float32Array, reach = 0.08, strong = 1.5): { times: number[]; snapped: number } {
  const r = Math.round(reach / HOP);
  let snapped = 0;
  const out = times.map((t) => {
    const c = Math.round((t - LAG) / HOP);
    let best = -1, arg = -1;
    for (let f = Math.max(0, c - r); f <= Math.min(strength.length - 1, c + r); f++) if (strength[f] > best) { best = strength[f]; arg = f; }
    if (arg < 0 || best < strong) return t;
    snapped++;
    return arg * HOP + LAG;
  });
  return { times: out, snapped };
}

/** How strongly sound starts, frame by frame, for snapToAttacks: from the recording's channels (mixed to one). */
export function attackStrength(channels: Float32Array[], rate: number): Float32Array {
  const n = channels[0]?.length ?? 0, mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  return onsetStrength(mono, rate);
}

/**
 * This pass's taps, bar after bar from `from`, joined to the earlier ones: bars this pass covered take the new times,
 * and earlier taps outside them stay (if they still fit in order).
 */
export function mergeDownbeats(earlier: Downbeat[], from: number, times: number[]): Downbeat[] {
  const fresh = times.map((at, k) => ({ bar: from + k, at }));
  if (!fresh.length) return earlier;
  const lo = from, hi = from + times.length - 1, first = fresh[0].at, last = fresh[fresh.length - 1].at;
  const keep = earlier.filter((d) => (d.bar < lo && d.at < first) || (d.bar > hi && d.at > last));
  return [...keep, ...fresh].sort((a, b) => a.bar - b.bar);
}
