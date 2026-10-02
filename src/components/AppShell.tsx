'use client';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import TauriTitlebar from './features/TauriTitlebar';
import DesktopOpenListener from './features/DesktopOpenListener';
import TabHost from './providers/TabHost';
import ZoomProvider from './providers/ZoomProvider';
import { TabsProvider } from './providers/TabsContext';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  getSidebarAnimationClasses,
  getMainContentClasses,
  getSidebarRestoreButtonClassName,
  getSheetClasses,
  getSidebarVisibleServerSnapshot,
  readSidebarVisible,
  subscribeSidebarVisibility,
  writeSidebarVisible,
} from '@/lib/sidebarVisibility';
import { SidebarPeekContext } from '@/lib/sidebarPeekContext';
import type { ShellItemRow } from '@/lib/actions/workspace';

export default function AppShell({
  sidebar,
  mobileNav,
  demoBanner,
  items,
  isAdmin = false,
  currentUserId,
  children,
}: {
  sidebar: ReactNode;
  mobileNav: ReactNode;
  demoBanner?: ReactNode;
  items: ShellItemRow[];
  activeWorkspaceId: string;
  isAdmin?: boolean;
  currentUserId?: string;
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

  // Hover-to-peek: when sidebar is hidden, hovering the left edge shows it as an
  // overlay. A short timeout prevents flicker when moving between the hover zone
  // and the sidebar itself.
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

  // Pin: makes the sidebar permanently visible and stops peeking.
  // The content area then smoothly shifts right via its padding-left transition.
  function pin() {
    clearTimeout(peekTimeoutRef.current);
    setSidebarPeeking(false);
    writeSidebarVisible(true);
  }

  const toggleSidebar = () => {
    writeSidebarVisible(!sidebarVisible);
  };

  // Only /db/* and /page/* routes get a keep-alive TabHost pane in Tauri — a tab
  // still exists for /admin (see TabsContext's isTabbable) so it doesn't leave a
  // stale tab looking "active" in the strip, but its content is NOT kept alive:
  // it keeps rendering through the normal server-rendered `{children}`.
  const isKeepAlivePath = /^\/(db|page)\//.test(pathname);
  const showTabHost = isTauri && isKeepAlivePath;
  // The project dashboard is a set of cards on the desk rather than one sheet.
  const onDesk = /^\/dashboard\//.test(pathname);

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
        {/* Always rendered (a no-op outside the desktop shell), so the tree never changes shape. */}
        <DesktopOpenListener />
        {/*
          `relative` is required so the absolute aside is positioned within this
          container. The aside never participates in flex layout (always absolute),
          and the main area uses padding-left to make room when the sidebar is pinned.
        */}
        <div className="relative flex h-full overflow-hidden">
          <SidebarPeekContext.Provider value={{ isPeeking: sidebarPeeking, pin }}>
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
          </SidebarPeekContext.Provider>
          {mobileNav}
          <main className={getMainContentClasses(sidebarVisible)}>
            {/* Hover zone on the left edge — triggers sidebar peek when hidden.
                w-12 (48px) is comfortably wide without being intrusive. */}
            {!sidebarVisible && (
              <div
                className="hidden lg:block absolute left-0 inset-y-0 w-12 z-10"
                onMouseEnter={startPeek}
                onMouseLeave={schedulePeekClose}
              />
            )}
            {/*
              Sidebar toggle for web (non-Tauri): shows Remnus logo when sidebar is
              hidden. In Tauri, TauriTitlebar renders the logo in the titlebar row
              instead (avoids a duplicate icon after the isTauri false→true flip).
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
            {/* TauriTitlebar renders the browser-style TabBar inline in its row (Tauri only).
                It and the banner sit on the desk, above the sheet. */}
            <TauriTitlebar key="tauri-titlebar" />
            {demoBanner}
            {/*
              The sheet — always rendered, only its classes change, so the tree keeps
              its shape across the isTauri flip (see above).

              Keep-alive content area. `{children}` (the server-rendered route)
              shows on web and on non-tabbable in-app routes (/admin) via
              `display:contents`. On a /db|/page route in Tauri it's hidden (those
              content routes also return null behind the `remnus_platform` cookie)
              and TabHost owns the content, keeping every tab's pane mounted. Both
              wrappers are always present and only toggle display — never
              mount/unmount — so the isTauri false→true flip can't remount the
              route subtree (the Router-crash hazard noted above).
            */}
            <div className={getSheetClasses({ onDesk, underChrome: isTauri || hasDemoBanner })}>
              <div className={showTabHost ? undefined : 'contents'} style={showTabHost ? { display: 'none' } : undefined}>
                {children}
              </div>
              <div className="flex-1 min-h-0 flex flex-col" style={showTabHost ? undefined : { display: 'none' }}>
                <TabHost isAdmin={isAdmin} currentUserId={currentUserId} />
              </div>
            </div>
          </main>
        </div>
      </TabsProvider>
    </ZoomProvider>
  );
}
