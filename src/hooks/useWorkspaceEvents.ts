'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANGE_EVENT } from '@/components/providers/ActivityTracker';
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
 */
export function useWorkspaceEvents(_currentUserId: string, paused: boolean = false) {
  const router = useRouter();
  const pausedRef = useRef(paused);
  const pendingRef = useRef(false);
  const lastVersionRef = useRef<number | null>(null);
  const gateRef = useRef<{ isBlocked(): boolean } | null>(null);

  // Apply a deferred refresh if (and only if) nothing is in the way and a
  // change is pending. Reads only refs + the stable router, so the instance
  // captured at mount stays valid for every later call.
  function flush() {
    if (pausedRef.current || !pendingRef.current) return;
    if (gateRef.current?.isBlocked()) return;
    pendingRef.current = false;
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
  // value seen is just a baseline (the SSR render is already current); only a
  // subsequent increase flags a pending refresh.
  useEffect(() => {
    const onChange = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (!Number.isFinite(v)) return;
      if (lastVersionRef.current === null) {
        lastVersionRef.current = v;
        return;
      }
      if (v > lastVersionRef.current) {
        lastVersionRef.current = v;
        pendingRef.current = true;
        flush();
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
