'use client';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PanelLeftOpen } from 'lucide-react';
import TauriTitlebar from './features/TauriTitlebar';
import ZoomProvider from './providers/ZoomProvider';
import { TabsProvider } from './providers/TabsContext';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  getSidebarAnimationClasses,
  getSidebarRestoreButtonClassName,
  getSidebarVisibleServerSnapshot,
  getSidebarVisibilityToggleHost,
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
  children,
}: {
  sidebar: ReactNode;
  mobileNav: ReactNode;
  demoBanner?: ReactNode;
  items: WorkspaceItemRow[];
  activeWorkspaceId: string;
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
  const sidebarToggleHost = getSidebarVisibilityToggleHost(sidebarVisible);
  const hasDemoBanner = Boolean(demoBanner);

  const toggleSidebar = () => {
    writeSidebarVisible(!sidebarVisible);
  };

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
        <div className="flex h-full overflow-hidden">
          <aside className={getSidebarAnimationClasses(sidebarVisible)} aria-hidden={!sidebarVisible}>
            <div className="w-72 h-full flex flex-col shrink-0 transition-transform duration-200 ease-out">
              {sidebar}
            </div>
          </aside>
          {mobileNav}
          <main className="relative flex-1 flex flex-col h-full overflow-hidden bg-neutral-850 pb-14 lg:pb-0">
            {sidebarToggleHost === 'main' && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={t('showSidebar')}
                title={t('showSidebar')}
                className={getSidebarRestoreButtonClassName(hasDemoBanner)}
              >
                <PanelLeftOpen size={15} />
              </button>
            )}
            {/* TauriTitlebar renders the browser-style TabBar inline in its row (Tauri only). */}
            <TauriTitlebar key="tauri-titlebar" />
            {demoBanner}
            {children}
          </main>
        </div>
      </TabsProvider>
    </ZoomProvider>
  );
}
