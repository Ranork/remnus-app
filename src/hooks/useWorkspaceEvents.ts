'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANGE_EVENT } from '@/components/providers/ActivityTracker';

const IDLE_TIMEOUT_MS = 10_000;

/**
 * Refreshes server components when something changes in the user's workspaces
 * (an edit by another user or an MCP/AI agent), so the UI reflects it.
 *
 * Detection is piggy-backed on the activity heartbeat: ActivityTracker pings
 * /api/activity/ping (~30s while the tab is visible), the response carries a
 * cheap `changeVersion` (max updatedAt across the user's workspaces), and the
 * tracker re-broadcasts it as a `CHANGE_EVENT` window event. This hook listens
 * for it and calls router.refresh() ONLY when the version actually advances —
 * so an idle tab transfers a few bytes per ping instead of re-fetching the full
 * RSC payload (~100 KB) every 10s. That blind poll was the main driver of
 * Vercel Fast Origin Transfer.
 *
 * To avoid jarring re-renders, a detected change is deferred while the user is
 * actively interacting (or while a modal/picker is open via `paused`) and
 * applied once they go idle. Everything is ref-based so detection never causes
 * a React re-render of its own.
 */
export function useWorkspaceEvents(_currentUserId: string, paused: boolean = false) {
  const router = useRouter();
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(true);
  const pausedRef = useRef(paused);
  const pendingRef = useRef(false);
  const lastVersionRef = useRef<number | null>(null);

  // Apply a deferred refresh if (and only if) we're idle, not paused, and a
  // change is pending. Reads only refs + the stable router, so the instance
  // captured at mount stays valid for every later call.
  function flush() {
    if (pausedRef.current || !isIdleRef.current || !pendingRef.current) return;
    pendingRef.current = false;
    router.refresh();
  }

  // Mirror `paused` into a ref; flush any deferred refresh once unpaused.
  useEffect(() => {
    pausedRef.current = paused;
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Track user activity → idle. We avoid refreshing while the user is
  // interacting to prevent jarring layout/focus resets during data entry.
  useEffect(() => {
    const goIdle = () => {
      isIdleRef.current = true;
      flush();
    };
    const resetIdleTimeout = () => {
      isIdleRef.current = false;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'mousedown'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetIdleTimeout, { passive: true });
    });

    idleTimeoutRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetIdleTimeout);
      });
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for change-version broadcasts from the activity heartbeat. The first
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
