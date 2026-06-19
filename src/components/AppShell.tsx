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

  // Browser-like tabs only in the Tauri desktop shell; the web stays unchanged.
  if (isTauri) {
    return (
      <ZoomProvider>
        {/* Tabs are a GLOBAL, browser-style strip — never per-workspace. The
            server-side layout flips `remnus_workspace_id` whenever the user
            navigates to a page in a different workspace, so keying the provider
            on `activeWorkspaceId` would unmount/remount it mid-session and load
            a different localStorage bucket — that's how 12 user-opened tabs were
            replaced by another workspace's 6 saved tabs. */}
        <TabsProvider items={items}>
          <div className="flex h-full overflow-hidden">
            <aside className="hidden lg:flex w-72 bg-neutral-900 border-r border-neutral-800 flex-col">
              {sidebar}
            </aside>
            {mobileNav}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-850 pb-14 lg:pb-0">
              {/* TauriTitlebar renders the browser-style TabBar inline in its row. */}
              <TauriTitlebar key="tauri-titlebar" />
              {demoBanner}
              {children}
            </main>
          </div>
        </TabsProvider>
      </ZoomProvider>
    );
  }

  return (
    <ZoomProvider>
      <div className="flex h-full overflow-hidden">
        <aside className="hidden lg:flex w-72 bg-neutral-900 border-r border-neutral-800 flex-col">
          {sidebar}
        </aside>
        {mobileNav}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-850 pb-14 lg:pb-0">
          <TauriTitlebar key="tauri-titlebar" />
          {demoBanner}
          {children}
        </main>
      </div>
    </ZoomProvider>
  );
}
