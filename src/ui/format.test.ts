import { expect, it } from 'vitest';
import { fmtStep, halfTime } from './format';
import { stepSize } from '../engine/coords';

it('writes step sizes the way band directors say them', () => {
  expect(fmtStep(8)).toBe('8-to-5');
  expect(fmtStep(16 / 3)).toBe('5.3-to-5');
  expect(fmtStep(Infinity)).toBe('hold');
  expect(fmtStep(8, 'es')).toBe('8 a 5');
});

it('gives the half-time step for any move, with the same warning tiers', () => {
  expect(halfTime(16)).toEqual({ per5: 8, tier: 'ok' });
  expect(halfTime(8)).toEqual({ per5: 4, tier: 'yellow' }); // a 4-to-5 is at the default limit, not past it
  expect(halfTime(6)).toEqual({ per5: 3, tier: 'red' });
  expect(halfTime(8, 3)).toEqual({ per5: 4, tier: 'yellow' }); // a corps show's smaller limit
  expect(halfTime(Infinity)).toBeNull(); // a hold isn't a step
  // Half time is the same move over half as many steps: the same as the step size over half the counts.
  expect(halfTime(stepSize(10, 16).per5)!.per5).toBeCloseTo(stepSize(10, 8).per5);
});
