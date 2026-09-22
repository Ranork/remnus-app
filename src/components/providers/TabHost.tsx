'use client';
import { memo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTabs, isKeepAlivePane } from './TabsContext';
import { CHANGE_EVENT } from './ActivityTracker';
import TabPane from '@/components/features/tabs/TabPane';
import { invalidateTabHref } from '@/components/features/tabs/keys';
import { createInteractionGate } from '@/lib/interactionGate';

// Memoized so the once-a-minute `now` tick (which changes the suspendedIds Set
// identity and re-renders TabHost) doesn't re-render every pane's editor — only
// panes whose own isActive/suspended/href actually changed re-render.
const Pane = memo(function Pane({
  href,
  isAdmin,
  currentUserId,
  isActive,
  suspended,
}: {
  href: string;
  isAdmin: boolean;
  currentUserId?: string;
  isActive: boolean;
  suspended: boolean;
}) {
  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ display: isActive ? 'flex' : 'none' }}
      aria-hidden={!isActive}
    >
      {suspended ? null : <TabPane href={href} isAdmin={isAdmin} currentUserId={currentUserId} />}
    </div>
  );
});

/**
 * Keep-alive content host for the Tauri browser-style tabs. Renders ONE
 * `<TabPane>` per open tab and keeps every pane mounted — only the active one is
 * shown (`display:flex`), the rest are `display:none` but stay in the DOM, so
 * switching tabs preserves each tab's full in-memory state (open modals, scroll,
 * unsaved edits) exactly like real browser tabs. Replaces the App-Router
 * `{children}` content in the Tauri shell.
 *
 * Inert on web: `useTabs()` returns null (provider disabled), so this renders
 * nothing and the normal server-rendered route is shown instead.
 */
export default function TabHost({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId?: string }) {
  const tabs = useTabs();
  const activeHref = tabs ? (tabs.tabs.find((t) => t.id === tabs.activeId)?.href ?? null) : null;
  useActivePaneAutoRefresh(activeHref, !!tabs);

  if (!tabs) return null;

  const { tabs: list, activeId, suspendedIds } = tabs;
  // Only /db|/page tabs need a keep-alive pane here — other tabbable routes
  // (e.g. /admin) render through the normal server route (AppShell's
  // `{children}`, shown whenever they're active) and have no in-memory state
  // worth keeping hidden while inactive, so TabPane never sees their href.
  const paneTabs = list.filter((tab) => isKeepAlivePane(tab.href));

  if (paneTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-850">
        <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {paneTabs.map((tab) => (
        // Lazy on load + suspended after the keep-alive window: the pane isn't
        // mounted at all (frees memory; a later activation re-mounts it fresh).
        // The active tab is never suspended.
        <Pane
          key={tab.id}
          href={tab.href}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          isActive={tab.id === activeId}
          suspended={suspendedIds.has(tab.id)}
        />
      ))}
    </>
  );
}

/**
 * Keeps the ACTIVE pane's data fresh when another user/agent edits the workspace.
 * In Tauri the content is client-fetched, so the sidebar's `router.refresh()`
 * (which re-fetches the now-null server route) doesn't update the panes. This
 * mirrors `useWorkspaceEvents`: it listens to the activity poll's
 * `CHANGE_EVENT` and, unless the user is mid-edit (the shared
 * `createInteractionGate` — moving the mouse is not a reason to wait),
 * invalidates the active pane's queries. Hidden panes are never touched, so a
 * background refresh can't wipe a kept-alive tab's in-memory state.
 */
function useActivePaneAutoRefresh(activeHref: string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const activeHrefRef = useRef(activeHref);
  useEffect(() => {
    activeHrefRef.current = activeHref;
  }, [activeHref]);

  useEffect(() => {
    if (!enabled) return; // web build: no in-app tabs, nothing to refresh
    const pendingRef = { current: false };
    let lastVersion: number | null = null;

    const flush = () => {
      if (!pendingRef.current || gate.isBlocked()) return;
      pendingRef.current = false;
      if (activeHrefRef.current) invalidateTabHref(queryClient, activeHrefRef.current);
    };
    const gate = createInteractionGate(() => flush());

    const onChange = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (!Number.isFinite(v)) return;
      if (lastVersion === null) { lastVersion = v; return; } // baseline
      if (v > lastVersion) { lastVersion = v; pendingRef.current = true; flush(); }
    };

    window.addEventListener(CHANGE_EVENT, onChange);

    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      gate.dispose();
    };
  }, [queryClient, enabled]);
}
