'use client';

import { useEffect, useRef } from 'react';

const PING_INTERVAL_MS = 30_000; // heartbeat cadence while the tab is visible
const PING_URL = '/api/activity/ping';

/**
 * Heartbeat-based engagement tracker. While the tab is visible it POSTs to
 * /api/activity/ping every 30s; the server extends the user's current session
 * or opens a new one after an inactivity gap. Pinging pauses when the tab is
 * hidden and resumes on return, so we measure real time-in-app (presence)
 * rather than wall-clock time with the tab buried.
 *
 * The ping response carries a cheap `changeVersion` (max updatedAt across the
 * user's workspaces). We re-broadcast it as a `remnus:change` window event so
 * useWorkspaceEvents can refresh server components ONLY when something actually
 * changed — instead of an unconditional 10s router.refresh() poll.
 *
 * Mounted only for authenticated users (see [locale]/layout.tsx).
 */
export const CHANGE_EVENT = 'remnus:change';

export default function ActivityTracker() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        // keepalive lets the request survive a tab close / navigation
        const res = await fetch(PING_URL, { method: 'POST', keepalive: true });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        // Number.isFinite, not `typeof === 'number'`: NaN is a number, and a
        // non-finite version would compare false against every later value,
        // wedging the refresh loop shut instead of failing loudly.
        if (data && Number.isFinite(data.changeVersion)) {
          window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: data.changeVersion }));
        }
      } catch {
        // best-effort — ignore network/parse failures
      }
    };

    const start = () => {
      if (intervalRef.current) return;
      ping(); // immediate ping on (re)gaining visibility
      intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, []);

  return null;
}
