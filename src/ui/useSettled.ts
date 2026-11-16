import { useLayoutEffect, useRef, useState } from 'react';

/** How long the slow checks wait after the last change of a burst (a drag, a held arrow key) before they run. */
export const SETTLE_MS = 250;

/**
 * When a value that changed at `now` should reach the slow checks: right away (0) when it's the first change after a
 * quiet spell (a click, a typed number, Undo), or `wait` ms later when changes are coming fast (a drag's every step).
 */
export const settleDelay = (now: number, lastChange: number, wait = SETTLE_MS) => (now - lastChange >= wait ? 0 : wait);

/**
 * `value`, held back while it changes in quick bursts: the first change after a quiet spell comes through at once, and
 * in a burst only the last one does, once things settle. Review and the close-call checks run on this, so a drag of a
 * big band doesn't redo them on every step (they caught up when the drag ends).
 */
export function useSettled<T>(value: T, wait = SETTLE_MS): T {
  const [settled, setSettled] = useState(value);
  const last = useRef(-Infinity);
  useLayoutEffect(() => { // before paint, so a single edit never shows a stale warning
    const now = performance.now(), delay = settleDelay(now, last.current, wait);
    last.current = now;
    if (!delay) { setSettled(value); return; }
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, wait]);
  return settled;
}
