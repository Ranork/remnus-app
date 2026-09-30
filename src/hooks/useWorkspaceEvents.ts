'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANGE_EVENT, mayPredateRender } from '@/components/providers/ActivityTracker';
import { createInteractionGate } from '@/lib/interactionGate';

/**
 * Refreshes server components when something changes in the user's workspaces
 * (an edit by another user or an MCP/AI agent), so the UI reflects it.
 *
 * Detection is piggy-backed on the activity heartbeat and its faster sibling:
 * ActivityTracker polls the change version, and re-broadcasts it as a
 * `CHANGE_EVENT` window event. This hook listens for it and calls
 * router.refresh() ONLY when the version actually advances — so a quiet tab
 * transfers a few bytes per tick instead of re-fetching the full RSC payload
 * (~100 KB) every 10s. That blind poll was the main driver of Vercel Fast
 * Origin Transfer.
 *
 * A detected change is deferred only while applying it would disturb the user:
 * a modal/picker is open (`paused`), or they are mid-edit (see
 * `createInteractionGate` — which, unlike the idle timer it replaced, does not
 * treat moving the mouse as a reason to wait). Everything is ref-based so
 * detection never causes a React re-render of its own.
 *
 * `renderedAt` is the server clock of the layout render the current props came
 * from. The version is in whole seconds, so a write in the same second as the
 * last one can leave it unchanged; while the newest version may postdate the
 * render (`mayPredateRender`), an unchanged version on a later tick still
 * refreshes — once, since that refresh's own `renderedAt` is late enough to
 * settle it. The first value is treated the same way, which covers a write
 * landing between the server render and the first ping.
 *
 * Only the caller that passes `renderedAt` drives refreshes: the always-mounted
 * desktop sidebar. The mobile drawer mounts a second, hidden copy of the sidebar
 * at the same time, and two drivers meant every refresh was fetched twice.
 */
const AWAIT_RENDER_MS = 10_000;

export function useWorkspaceEvents(_currentUserId: string, paused: boolean = false, renderedAt: number = 0) {
  const router = useRouter();
  const pausedRef = useRef(paused);
  const pendingRef = useRef(false);
  const lastVersionRef = useRef<number | null>(null);
  const gateRef = useRef<{ isBlocked(): boolean } | null>(null);
  // When a refresh was asked for whose render has not arrived yet (0 = none): an
  // unchanged version is no evidence of anything until it does. Bounded, so a
  // refresh that never lands can't switch the check off for good.
  const awaitingRenderRef = useRef(0);
  const renderedAtRef = useRef(renderedAt);

  useEffect(() => {
    renderedAtRef.current = renderedAt;
    awaitingRenderRef.current = 0;
  }, [renderedAt]);

  // Apply a deferred refresh if (and only if) nothing is in the way and a
  // change is pending. Reads only refs + the stable router, so the instance
  // captured at mount stays valid for every later call.
  function flush() {
    if (pausedRef.current || !pendingRef.current) return;
    if (gateRef.current?.isBlocked()) return;
    pendingRef.current = false;
    awaitingRenderRef.current = Date.now();
    router.refresh();
  }

  // Mirror `paused` into a ref; flush any deferred refresh once unpaused.
  useEffect(() => {
    pausedRef.current = paused;
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // The editing gate: blocks only while a drag, a keystroke or an active
  // editor would be disturbed, and calls back the moment that lapses.
  useEffect(() => {
    const gate = createInteractionGate(() => flush());
    gateRef.current = gate;
    return () => {
      gateRef.current = null;
      gate.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for change-version broadcasts from the activity poll. The first
  // value seen is a baseline (the SSR render is current up to it — unless it may
  // postdate that render); an increase flags a pending refresh, and so does an
  // unchanged version the current render may not contain yet.
  useEffect(() => {
    const onChange = (e: Event) => {
      if (!renderedAtRef.current) return; // not the driving copy (see above)
      const v = (e as CustomEvent<number>).detail;
      if (!Number.isFinite(v)) return;
      const previous = lastVersionRef.current;
      if (previous === null || v > previous) lastVersionRef.current = v;
      const advanced = previous !== null && v > previous;
      const awaiting = Date.now() - awaitingRenderRef.current < AWAIT_RENDER_MS;
      const unsettled = !awaiting && mayPredateRender(v, renderedAtRef.current);
      if (advanced || unsettled) {
        pendingRef.current = true;
        flush();
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
