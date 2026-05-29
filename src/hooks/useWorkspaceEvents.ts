'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 10_000;
const IDLE_TIMEOUT_MS = 10_000;

/**
 * Polls for workspace changes every 10 seconds ONLY when the user is inactive (idle)
 * and calls router.refresh() so server components pick up mutations made by other users or MCP agents.
 *
 * It monitors mouse events, keyboard events, and touches to determine if the user is active.
 * When active, it stops polling to avoid jarring re-renders/layout resets during interaction.
 */
export function useWorkspaceEvents(_currentUserId: string, paused: boolean = false) {
  const router = useRouter();
  const [isIdle, setIsIdle] = useState(true);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paused) {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      return;
    }

    const resetIdleTimeout = () => {
      setIsIdle(false);

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      idleTimeoutRef.current = setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT_MS);
    };

    // Events to monitor for user activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'mousedown'];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetIdleTimeout, { passive: true });
    });

    // Initialize the idle timer
    idleTimeoutRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetIdleTimeout);
      });
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [paused]);

  useEffect(() => {
    if (paused || !isIdle) return;

    const id = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [router, paused, isIdle]);
}
