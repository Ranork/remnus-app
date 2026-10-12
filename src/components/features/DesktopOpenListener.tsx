'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTabs } from '@/components/providers/TabsContext';
import type { ShellItemRow } from '@/lib/actions/workspace';
import { DESKTOP_OPEN_EVENT, setShellListening, takeHeldOpenLink, workspaceIdOf } from '@/lib/desktop/openLink';

/** A settled content page, where a soft navigation into a new tab is safe. */
const CONTENT_PATH_RE = /^\/(page|db|dashboard|graph)\//;

function activeWorkspaceCookie(): string | null {
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('remnus_workspace_id='));
  return match ? decodeURIComponent(match.slice('remnus_workspace_id='.length)) : null;
}

/** The top of a workspace's hierarchy — where the sidebar's workspace switch goes too. */
function entryPath(items: ShellItemRow[], workspaceId: string): string | null {
  const inWorkspace = items.filter((i) => i.workspaceId === workspaceId);
  const first = inWorkspace.find((i) => i.parentId === null) ?? inWorkspace[0];
  if (!first) return null;
  if (first.type === 'database' && first.databaseId) return `/db/${first.databaseId}`;
  if (first.type === 'dashboard') return `/dashboard/${first.id}`;
  return `/page/${first.id}`;
}

/**
 * Desktop only. `npx remnus open` (and the Claude Code session hook that runs it) sends
 * `remnus://open?workspace=<id>` to the desktop app, which hands the id to this page as a
 * `desktop-open-workspace` event (src-tauri/src/lib.rs). The workspace opens in a new tab
 * of this window — unless it is already the one showing, which is the common case: the
 * hook fires on every new agent session of the same project.
 *
 * The tab opens the workspace's top page, found in the shell's own item list, like the
 * sidebar's workspace switch; arriving there switches the workspace cookie (the sidebar
 * syncs it from the path). Never `/w/<id>` in a tab: that is a route handler, which only a
 * hard navigation runs — a tab pushed to it stayed blank (R11). A workspace this window
 * holds no page of (empty, or joined since it loaded), or a link that arrives while the
 * window is not on a content page (a cold start lands on the redirecting `/app`), gets that
 * hard navigation instead.
 *
 * The shell holds a link that arrives before this page is listening (the app was closed,
 * or still loading) and sends it once it hears `desktop-open-ready`, so the listener is
 * registered first and the ready signal sent after. After that first signal it sends every
 * link at once, also to pages without this listener: a link that reaches the sign-in screen
 * after signing out is kept by `DesktopOpenCatcher` and opened here on mount, by the hard
 * route — the window has only just arrived (lib/desktop/openLink).
 */
export default function DesktopOpenListener({ items }: { items: ShellItemRow[] }) {
  const tabs = useTabs();
  const router = useRouter();
  const tabsRef = useRef(tabs);
  const routerRef = useRef(router);
  const itemsRef = useRef(items);

  useEffect(() => {
    tabsRef.current = tabs;
    routerRef.current = router;
    itemsRef.current = items;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { listen, emit } = await import('@tauri-apps/api/event');
        const openWorkspace = (id: string, justArrived: boolean) => {
          if (activeWorkspaceCookie() === id) return;
          // Off a content page — above all a cold start, where the link arrives while `/app`
          // is still redirecting and a push would collide with that redirect (both were lost:
          // a blank tab on `/app`) — the hard route does the whole job.
          const settled = !justArrived && CONTENT_PATH_RE.test(window.location.pathname);
          const href = settled ? entryPath(itemsRef.current, id) : null;
          if (!href) {
            window.location.assign(`/w/${id}`);
            return;
          }
          const tabs = tabsRef.current;
          if (!tabs) {
            routerRef.current.push(href);
            return;
          }
          // A tab already showing that page is brought forward rather than duplicated.
          const open = tabs.tabs.find((t) => t.href === href);
          if (open) tabs.activateTab(open.id);
          else tabs.openInNewTab(href);
        };
        const off = await listen(DESKTOP_OPEN_EVENT, (event) => {
          const id = workspaceIdOf(event.payload);
          if (id) openWorkspace(id, false);
        });
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;
        setShellListening(true);
        const held = takeHeldOpenLink();
        if (held) openWorkspace(held, true);
        await emit('desktop-open-ready');
      } catch {
        // An older desktop shell without the event bridge: nothing to listen to.
      }
    })();

    return () => {
      cancelled = true;
      setShellListening(false);
      unlisten?.();
    };
  }, []);

  return null;
}
