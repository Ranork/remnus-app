'use client';

import { useEffect, useRef } from 'react';

const PING_INTERVAL_MS = 30_000; // engagement heartbeat while the tab is visible
const FAST_POLL_MS = 2_500;      // change-poll cadence while something is happening
const POLL_BACKOFF = 1.6;        // how fast a quiet tab drifts back to the heartbeat
const PING_URL = '/api/activity/ping';
const CHANGES_URL = '/api/activity/changes';
const FOCUS_CHECK_GAP_MS = 2_000; // a refocus re-checks at most this often
const UNSETTLED_WATCH_MS = 60_000; // how long an unsettled version keeps the fast cadence

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
 * - **Normal tab, agent at work:** the heartbeat also says whether an agent has
 *   called Remnus in one of the user's workspaces in the last three minutes
 *   (`agent: true`). While it does, the tab polls at a flat 2.5s like a project
 *   window; when the flag drops it backs off as above. Agents read before they
 *   write, so the tab is usually already fast when the first write lands.
 * - **Refocus:** switching back to the window (from the terminal the agent runs
 *   in, typically) checks at once, instead of waiting for the next tick.
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
 * ### The version is in whole seconds
 *
 * Timestamps are epoch seconds, so a second write inside the same second as the
 * one a refresh was made for does not advance the version — and without more,
 * never shows. `renderedAt` (the server's clock when the layout last rendered) is
 * what settles it: while the newest version is not safely older than that render
 * (`mayPredateRender`), the tab keeps polling fast and `useWorkspaceEvents`
 * refreshes once more on a later tick. The same rule covers a write landing
 * between the server render and the first ping.
 *
 * Mounted only for authenticated users (see [locale]/(app)/layout.tsx).
 */
export const CHANGE_EVENT = 'remnus:change';

/** Allowance for clock skew between the function that wrote and the one that rendered. */
const CLOCK_SKEW_MS = 250;

/**
 * Could a write stamped with version `v` (epoch seconds) have landed after the
 * render made at `renderedAt` (server epoch milliseconds)? Writes stamped `v` go on
 * until the second ends, so only a render that started after `v + 1` (plus the skew
 * allowance) is known to contain all of them. Kept that tight on purpose: every
 * `true` costs a second refresh.
 */
export function mayPredateRender(v: number, renderedAt: number): boolean {
  return renderedAt < (v + 1) * 1000 + CLOCK_SKEW_MS;
}

// Whether the version just broadcast was still "hot" on the server — its second
// could still receive writes (`signalExtras`). Set right before each dispatch, so a
// `CHANGE_EVENT` listener reads it synchronously with `changeIsHot()`.
let lastBroadcastHot = false;
export function changeIsHot(): boolean {
  return lastBroadcastHot;
}

export default function ActivityTracker({
  isProjectWindow = false,
  renderedAt,
}: {
  isProjectWindow?: boolean;
  /** Server clock (epoch ms) of the layout render these props came from. */
  renderedAt: number;
}) {
  // Read inside the effect's closures so toggling it can't leave a stale cadence behind.
  const projectWindowRef = useRef(isProjectWindow);
  projectWindowRef.current = isProjectWindow;
  const renderedAtRef = useRef(renderedAt);
  renderedAtRef.current = renderedAt;

  useEffect(() => {
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollDelay = FAST_POLL_MS;
    let lastVersion: number | null = null;
    let stopped = true;
    let agentActive = false; // from the heartbeat: an agent called Remnus lately
    let lastCheckAt = 0;
    let lastCount: number | null = null; // visible workspaces, from `n`

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
    const broadcast = (value: unknown, count?: unknown, hot?: unknown): boolean => {
      if (!Number.isFinite(value)) return false;
      let v = value as number;
      // Membership changed (someone removed us, or let us in): that is a change even
      // when no timestamp moved — a removal only ever LOSES a branch. Nudge the version
      // a hair past what we have, so every consumer sees an advance; a real write in a
      // later second still compares above it.
      if (Number.isFinite(count)) {
        if (lastCount !== null && count !== lastCount && lastVersion !== null) v = Math.max(v, lastVersion) + 0.001;
        lastCount = count as number;
      }
      lastBroadcastHot = hot === 1;
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: v }));
      const advanced = lastVersion !== null && v > lastVersion;
      if (lastVersion === null || v > lastVersion) lastVersion = v;
      return advanced;
    };

    /**
     * The newest version may not be in the page yet — keep watching closely. Only
     * for a minute: a refresh held back by an open modal must not keep a tab on the
     * fast cadence for as long as the modal stays open.
     */
    const unsettled = () =>
      lastVersion !== null &&
      Date.now() - lastVersion * 1000 < UNSETTLED_WATCH_MS &&
      mayPredateRender(lastVersion, renderedAtRef.current);

    const scheduleNextPoll = () => {
      if (stopped) return;
      if (projectWindowRef.current || agentActive) {
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
      lastCheckAt = Date.now();
      try {
        const res = await fetch(CHANGES_URL, { cache: 'no-store' });
        const data = res.ok ? await res.json().catch(() => null) : null;
        const advanced = data ? broadcast(data.v, data.n, data.h) : false;
        if (advanced || unsettled()) pollDelay = FAST_POLL_MS;
        else pollDelay = Math.min(pollDelay * POLL_BACKOFF, PING_INTERVAL_MS);
      } catch {
        // best-effort — a failed tick just backs off like a quiet one
        pollDelay = Math.min(pollDelay * POLL_BACKOFF, PING_INTERVAL_MS);
      }
      scheduleNextPoll();
    }

    const ping = async () => {
      lastCheckAt = Date.now();
      try {
        // keepalive lets the request survive a tab close / navigation
        const res = await fetch(PING_URL, { method: 'POST', keepalive: true });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        agentActive = data.agent === true;
        const advanced = broadcast(data.changeVersion, data.n, data.h);
        if (advanced || agentActive || unsettled()) quicken();
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

    // A window beside the agent's terminal stays "visible" while the human reads
    // the terminal, so visibility alone never re-checks when they look back.
    const handleFocus = () => {
      if (stopped || Date.now() - lastCheckAt < FOCUS_CHECK_GAP_MS) return;
      // A quiet tab checks once and stands straight back down (a quiet tick backs off
      // to the heartbeat's interval); one already polling just ticks early.
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
      else pollDelay = PING_INTERVAL_MS;
      void poll();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      stop();
    };
  }, []);

  return null;
}
