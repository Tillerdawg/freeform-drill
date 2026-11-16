import { expect, it } from 'vitest';
import { settleDelay, SETTLE_MS } from './useSettled';

it('lets a single edit through at once and holds a burst until it settles', () => {
  expect(settleDelay(1000, -Infinity)).toBe(0); // the very first value
  expect(settleDelay(5000, 1000)).toBe(0); // a click after a quiet spell
  expect(settleDelay(1016, 1000)).toBe(SETTLE_MS); // a drag's next step, 16 ms later: wait for the end
  expect(settleDelay(1000 + SETTLE_MS, 1000)).toBe(0); // exactly the wait apart counts as quiet
  expect(settleDelay(1010, 1000, 5)).toBe(0);
});
