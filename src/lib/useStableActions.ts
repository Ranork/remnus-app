'use client';

import { useMemo, useRef } from 'react';

type Handlers = Record<string, (...args: never[]) => unknown>;

/**
 * Callbacks with a fixed identity that always run the latest handlers (V2 R9.2). Pass
 * them to memoized list rows: a parent re-render (a hover, a drag-over) then no longer
 * re-renders every row just because its inline handlers were re-created. The set of keys
 * must not change between renders.
 */
export function useStableActions<T extends Handlers>(handlers: T): T {
  const latest = useRef(handlers);
  latest.current = handlers;
  return useMemo(() => {
    const stable = {} as Record<string, unknown>;
    for (const key of Object.keys(latest.current)) {
      stable[key] = (...args: never[]) => latest.current[key](...args);
    }
    return stable as T;
  }, []);
}
