import { STEP_LIMIT, type StepTier } from '../engine/coords';

/** "8-to-5", "5.3-to-5", or "hold". */
export const fmtStep = (per5: number, lang: 'en' | 'es' = 'en') => {
  const n = Math.round(per5 * 10) / 10;
  if (lang === 'es') return per5 === Infinity ? 'mantener' : `${n} a 5`; // "8 a 5": a first draft, for a Spanish-speaking director to check
  return per5 === Infinity ? 'hold' : `${n}-to-5`;
};

/**
 * The same move marched half time (a step on every other count, so each step is twice as long): half the steps per 5
 * yards, with the same tiers as `stepSize` (red past the show's limit, yellow past a 6-to-5). Shubreet Kaur asked to see
 * it beside every step size, to judge whether a move will look as big as she wants (2026-11-21). Null for a hold.
 */
export function halfTime(per5: number, limit = STEP_LIMIT): { per5: number; tier: StepTier } | null {
  if (!Number.isFinite(per5) || !(per5 > 0)) return null;
  const h = per5 / 2, EPS = 1e-9;
  return { per5: h, tier: h < limit - EPS ? 'red' : h < 6 - EPS ? 'yellow' : 'ok' };
}
