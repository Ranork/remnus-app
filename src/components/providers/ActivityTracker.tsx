'use client';

import { useEffect, useRef } from 'react';

const PING_INTERVAL_MS = 30_000; // engagement heartbeat while the tab is visible
const FAST_POLL_MS = 2_500;      // change-poll cadence while something is happening
const POLL_BACKOFF = 1.6;        // how fast a quiet tab drifts back to the heartbeat
const PING_URL = '/api/activity/ping';
const CHANGES_URL = '/api/activity/changes';

/**
 * Two jobs on one visibility-gated clock.
 *
 * **Heartbeat** — POST /api/activity/ping every 30s. The server extends the
 * user's session or opens a new one after an inactivity gap. Pinging pauses
 * when the tab is hidden and resumes on return, so we measure real presence
 * rather than wall-clock time with the tab buried.
 *
 * **Change signal** — both endpoints return the cheap change version (max
 * change timestamp across the caller's workspaces, see
 * services/changeVersion.ts). Every value is re-broadcast as a `remnus:change`
 * window event; `useWorkspaceEvents` and `TabHost` refresh server components
 * ONLY when it actually advances, instead of the unconditional 10s
 * `router.refresh()` poll this replaced — that one re-fetched the full RSC
 * payload (~100 KB) per tick and was the dominant Fast Origin Transfer cost.
 *
 * ### Adaptive cadence
 *
 * The heartbeat alone is too slow to watch an agent work: at 30s, plus the old
 * idle gate, a human could wait 40s+ to see a page appear. But a fast poll on
 * every open tab would put the cost back. So the fast poll only runs when
 * something is actually happening:
 *
 * - **Quiet normal tab:** no change poll at all. The 30s heartbeat carries the
 *   version, exactly as before — an idle tab's cost is unchanged.
 * - **Normal tab, change seen:** drop to 2.5s, then back off by 1.6× per quiet
 *   tick until the interval reaches the heartbeat's, at which point the poll
 *   stops again. A burst of agent writes therefore stays live for ~90s after
 *   the last one.
 * - **Project window:** a flat 2.5s while visible. This deviates from backing
 *   off, deliberately: the window exists for one purpose — a human watching an
 *   agent fill this workspace — and backing off would reintroduce the lag the
 *   window is meant not to have. It is affordable because the poll is a
 *   read-only GET whose body is about twenty bytes (~1 KB/min, against the 600
 *   KB/min of the poll that was removed for cost) and it stops dead when the
 *   window is hidden.
 *
 * The change poll is a separate endpoint from the heartbeat on purpose: every
 * ping writes a `user_sessions` row, which must not happen every 2.5s.
 *
 * Mounted only for authenticated users (see [locale]/(app)/layout.tsx).
 */
export const CHANGE_EVENT = 'remnus:change';

export default function ActivityTracker({ isProjectWindow = false }: { isProjectWindow?: boolean }) {
  // Read inside the effect's closures so toggling it can't leave a stale cadence behind.
  const projectWindowRef = useRef(isProjectWindow);
  projectWindowRef.current = isProjectWindow;

  useEffect(() => {
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollDelay = FAST_POLL_MS;
    let lastVersion: number | null = null;
    let stopped = true;

    /**
     * Re-broadcast a version and report whether it advanced. Every observed
     * value goes out, not just advances: consumers take their first value as a
     * baseline (the SSR render is already current), so swallowing it here would
     * cost them the first real change.
     *
     * Number.isFinite, not `typeof === 'number'`: NaN is a number, and a
     * non-finite version would compare false against every later value, wedging
     * the refresh loop shut instead of failing loudly.
     */
    const broadcast = (value: unknown): boolean => {
      if (!Number.isFinite(value)) return false;
      const v = value as number;
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: v }));
      const advanced = lastVersion !== null && v > lastVersion;
      if (lastVersion === null || v > lastVersion) lastVersion = v;
      return advanced;
    };

    const scheduleNextPoll = () => {
      if (stopped) return;
      if (projectWindowRef.current) {
        pollTimer = setTimeout(poll, FAST_POLL_MS);
        return;
      }
      // Back at heartbeat cadence: stand down entirely rather than duplicate the ping.
      if (pollDelay >= PING_INTERVAL_MS) {
        pollTimer = null;
        return;
      }
      pollTimer = setTimeout(poll, pollDelay);
    };

    /** Something changed — poll quickly, and start the poll if it had stood down. */
    const quicken = () => {
      pollDelay = FAST_POLL_MS;
      if (!pollTimer && !stopped) pollTimer = setTimeout(poll, FAST_POLL_MS);
    };

    async function poll() {
      pollTimer = null;
      try {
        const res = await fetch(CHANGES_URL, { cache: 'no-store' });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (data && broadcast(data.v)) pollDelay = FAST_POLL_MS;
        else pollDelay = Math.min(pollDelay * POLL_BACKOFF, PING_INTERVAL_MS);
      } catch {
        // best-effort — a failed tick just backs off like a quiet one
        pollDelay = Math.min(pollDelay * POLL_BACKOFF, PING_INTERVAL_MS);
      }
      scheduleNextPoll();
    }

    const ping = async () => {
      try {
        // keepalive lets the request survive a tab close / navigation
        const res = await fetch(PING_URL, { method: 'POST', keepalive: true });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data && broadcast(data.changeVersion)) quicken();
      } catch {
        // best-effort — ignore network/parse failures
      }
    };

    const start = () => {
      if (!stopped) return;
      stopped = false;
      pollDelay = FAST_POLL_MS;
      ping(); // immediate heartbeat + version on (re)gaining visibility
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
      // A project window is live from the first second; a normal tab waits for
      // the immediate ping above to tell it whether anything is happening.
      if (projectWindowRef.current) pollTimer = setTimeout(poll, FAST_POLL_MS);
    };

    const stop = () => {
      stopped = true;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
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
