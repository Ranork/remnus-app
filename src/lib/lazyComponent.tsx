'use client';

import { useEffect, useState, type ComponentType } from 'react';

export type LazyComponent<P extends object> = ComponentType<P> & {
  /** Fetch the code now (idempotent); resolves when the component can render. */
  preload: () => Promise<ComponentType<P>>;
};

/**
 * A component whose code loads on first use, WITHOUT Suspense (V2 R9).
 *
 * `next/dynamic` and `React.lazy` suspend on the first render, and React holds back
 * the reveal of a Suspense boundary that just showed its fallback for ~300 ms (the
 * fallback throttle, applied to retries) — even when the code was already fetched. For
 * a dialog or an editor that opens on a click that is 300 ms of nothing. Here the
 * component renders straight away once its code is loaded (`preload()` on approach
 * makes that the usual case), and otherwise renders nothing until it arrives, then
 * appears with a plain state update. Only for client-side, conditionally rendered UI.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>): LazyComponent<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  const preload = () => {
    pending ??= load()
      .then((component) => (loaded = component))
      .catch((err) => {
        pending = null;
        throw err;
      });
    return pending;
  };

  function Lazy(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => loaded);
    useEffect(() => {
      if (Component) return;
      let alive = true;
      preload().then((C) => { if (alive) setComponent(() => C); }).catch(() => {});
      return () => { alive = false; };
    }, [Component]);
    return Component ? <Component {...props} /> : null;
  }

  return Object.assign(Lazy, { preload });
}
