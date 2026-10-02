'use client';

import { startTransition, useEffect, useState } from 'react';

/**
 * How many items of a long list to render right now (V2 R9.2). The server and the first
 * client render draw only the first `first` rows — the page arrives and hydrates without
 * carrying hundreds of rows of markup — then the rest is added `step` at a time in
 * interruptible transitions, so typing or clicking during the fill is never blocked.
 * Once the fill completes it returns `Infinity`: rows added later (a new row, an agent's
 * write) render at once. Every row is in the DOM a moment after load, so the browser's
 * own find (Ctrl+F) still sees the whole list — which a windowed list would not.
 */
export function useProgressiveLimit(total: number, first = 60, step = 100): number {
  const [limit, setLimit] = useState(first);
  const done = limit === Infinity;
  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(() => {
      startTransition(() => setLimit((current) => (current + step >= total ? Infinity : current + step)));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [done, limit, total, step]);
  return limit;
}

/** Estimated height of rows not drawn yet, so the scrollbar does not jump while the list fills. */
export const PENDING_ROW_HEIGHT = 33;
