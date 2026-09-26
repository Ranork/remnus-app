'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTabs } from '@/components/providers/TabsContext';

/** Same shape rule as the CLI and the desktop shell: never build a path from anything else. */
const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function activeWorkspaceCookie(): string | null {
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('remnus_workspace_id='));
  return match ? decodeURIComponent(match.slice('remnus_workspace_id='.length)) : null;
}

/**
 * Desktop only. `npx remnus open` (and the Claude Code session hook that runs it) sends
 * `remnus://open?workspace=<id>` to the desktop app, which hands the id to this page as a
 * `desktop-open-workspace` event (src-tauri/src/lib.rs). The workspace opens in a new tab
 * of this window — unless it is already the one showing, which is the common case: the
 * hook fires on every new agent session of the same project.
 *
 * The shell holds a link that arrives before this page is listening (the app was closed,
 * or still loading) and sends it once it hears `desktop-open-ready`, so the listener is
 * registered first and the ready signal sent after.
 */
export default function DesktopOpenListener() {
  const tabs = useTabs();
  const router = useRouter();
  const tabsRef = useRef(tabs);
  const routerRef = useRef(router);

  useEffect(() => {
    tabsRef.current = tabs;
    routerRef.current = router;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { listen, emit } = await import('@tauri-apps/api/event');
        const off = await listen<{ workspaceId?: unknown }>('desktop-open-workspace', (event) => {
          const id = event.payload?.workspaceId;
          if (typeof id !== 'string' || !WORKSPACE_ID_RE.test(id)) return;
          if (activeWorkspaceCookie() === id) return;
          const href = `/w/${id}`;
          if (tabsRef.current) tabsRef.current.openInNewTab(href);
          else routerRef.current.push(href);
        });
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;
        await emit('desktop-open-ready');
      } catch {
        // An older desktop shell without the event bridge: nothing to listen to.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return null;
}
