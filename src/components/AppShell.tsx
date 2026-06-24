'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import TauriTitlebar from './features/TauriTitlebar';
import ZoomProvider from './providers/ZoomProvider';
import { TabsProvider } from './providers/TabsContext';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';

export default function AppShell({
  sidebar,
  mobileNav,
  demoBanner,
  items,
  activeWorkspaceId,
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
  const MARKETING_PATHS = new Set(['/', '/pricing', '/contact', '/download', '/privacy', '/security']);
  const isMarketing = MARKETING_PATHS.has(pathname) || pathname.startsWith('/oauth/');

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
          <aside className="hidden lg:flex w-72 bg-neutral-900 border-r border-neutral-800 flex-col">
            {sidebar}
          </aside>
          {mobileNav}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-850 pb-14 lg:pb-0">
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
