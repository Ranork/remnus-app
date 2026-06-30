'use client';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import TauriTitlebar from './features/TauriTitlebar';
import TabHost from './providers/TabHost';
import ZoomProvider from './providers/ZoomProvider';
import { TabsProvider } from './providers/TabsContext';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  getSidebarAnimationClasses,
  getSidebarRestoreButtonClassName,
  getSidebarVisibleServerSnapshot,
  readSidebarVisible,
  subscribeSidebarVisibility,
  writeSidebarVisible,
} from '@/lib/sidebarVisibility';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';

export default function AppShell({
  sidebar,
  mobileNav,
  demoBanner,
  items,
  isAdmin = false,
  children,
}: {
  sidebar: ReactNode;
  mobileNav: ReactNode;
  demoBanner?: ReactNode;
  items: WorkspaceItemRow[];
  activeWorkspaceId: string;
  isAdmin?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isTauri = useIsTauri();
  const t = useTranslations('Layout');
  const sidebarVisible = useSyncExternalStore(
    subscribeSidebarVisibility,
    readSidebarVisible,
    getSidebarVisibleServerSnapshot,
  );
  const MARKETING_PATHS = new Set(['/', '/pricing', '/contact', '/download', '/privacy', '/security']);
  const isMarketing = MARKETING_PATHS.has(pathname) || pathname.startsWith('/oauth/');
  const hasDemoBanner = Boolean(demoBanner);

  const toggleSidebar = () => {
    writeSidebarVisible(!sidebarVisible);
  };

  // Hover-to-peek: when sidebar is hidden, hovering the left edge shows it as an
  // overlay without pushing the main content. A short timeout prevents flicker
  // when the pointer moves from the hover zone into the sidebar.
  const [sidebarPeeking, setSidebarPeeking] = useState(false);
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function startPeek() {
    clearTimeout(peekTimeoutRef.current);
    setSidebarPeeking(true);
  }

  function schedulePeekClose() {
    clearTimeout(peekTimeoutRef.current);
    peekTimeoutRef.current = setTimeout(() => setSidebarPeeking(false), 150);
  }

  // Only /db/* and /page/* routes live in tabs. The keep-alive TabHost owns the
  // content for those in Tauri; other in-app routes (e.g. /admin) keep their
  // normal server-rendered `{children}`.
  const isTabbablePath = /^\/(db|page)\//.test(pathname);
  const showTabHost = isTauri && isTabbablePath;

  if (isMarketing) {
    return <>{children}</>;
  }

  // ONE stable tree regardless of platform. `useIsTauri()` resolves false→true
  // only AFTER mount (it can't run synchronously without an SSR hydration
  // mismatch), so the tree shape must NOT depend on `isTauri` — otherwise the
  // flip adds/removes the TabsProvider wrapper and remounts the whole
  // authenticated subtree. That remount, racing the initial navigation, crashed
  // Next's client Router with "Rendered more hooks than during the previous
  // render" on Tauri's first open (reload "fixed" it only because there was no
  // second navigation to race). So TabsProvider is ALWAYS mounted and merely
  // toggles `enabled` — inert (web) vs the browser-style tab strip (Tauri).
  //
  // Tabs are a GLOBAL, browser-style strip — never per-workspace. The server
  // layout flips `remnus_workspace_id` on cross-workspace navigation, so keying
  // the provider on `activeWorkspaceId` would unmount/remount it mid-session and
  // load a different localStorage bucket (the old "tabs replaced by another
  // workspace's tabs" bug). TauriTitlebar/TabBar self-detect Tauri for display.
  return (
    <ZoomProvider>
      <TabsProvider items={items} enabled={isTauri}>
        {/*
          `relative` is required so the overlay aside is positioned within this
          container. The aside is ALWAYS absolute — it never participates in the
          flex layout — so the main content always takes full width and doesn't
          jump when the sidebar opens or closes.
        */}
        <div className="relative flex h-full overflow-hidden">
          <aside
            className={getSidebarAnimationClasses(sidebarVisible, sidebarPeeking)}
            onMouseEnter={!sidebarVisible ? startPeek : undefined}
            onMouseLeave={!sidebarVisible ? schedulePeekClose : undefined}
            aria-hidden={!sidebarVisible && !sidebarPeeking}
          >
            <div className="w-72 h-full flex flex-col shrink-0">
              {sidebar}
            </div>
          </aside>
          {mobileNav}
          <main className="relative flex-1 flex flex-col h-full overflow-hidden bg-neutral-850 pb-14 lg:pb-0">
            {/* Hover zone on the left edge — triggers sidebar peek when hidden.
                w-12 (48px) is wide enough to hit comfortably without being intrusive. */}
            {!sidebarVisible && (
              <div
                className="hidden lg:block absolute left-0 inset-y-0 w-12 z-10"
                onMouseEnter={startPeek}
                onMouseLeave={schedulePeekClose}
              />
            )}
            {/*
              Sidebar toggle: Remnus logo button shown in web when sidebar is hidden.
              In Tauri, TauriTitlebar renders the logo instead so we skip it here to
              avoid a double icon (TauriTitlebar is invisible before mount → isTauri
              flips false→true, so we conditionally hide this when running in Tauri).
            */}
            {!sidebarVisible && !isTauri && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={t('showSidebar')}
                title={t('showSidebar')}
                className={getSidebarRestoreButtonClassName(hasDemoBanner)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-square-dark.png" alt="Remnus" className="w-5 h-5 opacity-70" />
              </button>
            )}
            {/* TauriTitlebar renders the browser-style TabBar inline in its row (Tauri only). */}
            <TauriTitlebar key="tauri-titlebar" />
            {demoBanner}
            {/*
              Keep-alive content area. `{children}` (the server-rendered route)
              shows on web and on non-tabbable in-app routes (/admin) via
              `display:contents`. On a /db|/page route in Tauri it's hidden (those
              content routes also return null behind the `remnus_platform` cookie)
              and TabHost owns the content, keeping every tab's pane mounted. Both
              wrappers are always present and only toggle display — never
              mount/unmount — so the isTauri false→true flip can't remount the
              route subtree (the Router-crash hazard noted above).
            */}
            <div className={showTabHost ? undefined : 'contents'} style={showTabHost ? { display: 'none' } : undefined}>
              {children}
            </div>
            <div className="flex-1 min-h-0 flex flex-col" style={showTabHost ? undefined : { display: 'none' }}>
              <TabHost isAdmin={isAdmin} />
            </div>
          </main>
        </div>
      </TabsProvider>
    </ZoomProvider>
  );
}
