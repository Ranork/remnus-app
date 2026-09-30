'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Loader2, Waypoints } from 'lucide-react';
import { openOrCreateHomeDashboard } from '@/lib/actions/dashboard';

/**
 * The two pinned entries at the top of a project in the sidebar: its Pano (dashboard)
 * and its knowledge map. They are buttons that open pages, not tree rows — the
 * dashboard is left out of the tree below (see `homeDashboardItemId`), and the map has
 * no row of its own.
 *
 * Pano is the workspace's home dashboard. Until one exists the button creates an empty
 * one and points the workspace at it, so it is always one click from a usable screen.
 * Both are workspace content, so a project window keeps them (AGENTS.md → Project
 * Install §4).
 */
export default function WorkspaceQuickLinks({
  workspaceId,
  homeDashboardId,
  onHomeCreated,
}: {
  workspaceId: string;
  homeDashboardId: string | null;
  /** Called with the new dashboard's id so the sidebar can show it before its props refresh. */
  onHomeCreated: (itemId: string) => void;
}) {
  const t = useTranslations('Workspace');
  const tGraph = useTranslations('Graph');
  const pathname = usePathname();
  const router = useRouter();
  const [creating, startCreate] = useTransition();
  const [failed, setFailed] = useState(false);

  const dashboardActive = !!homeDashboardId && pathname.startsWith(`/dashboard/${homeDashboardId}`);
  const mapActive = pathname.startsWith(`/graph/${workspaceId}`);

  // The project's two fixed entrances, drawn as a pair of soft buttons rather than two
  // more tree rows. Monochrome like the rest of the chrome (V2 R8): the open one is
  // lifted onto the sheet, exactly like a selected tree row.
  const cls = (active: boolean) =>
    `flex min-w-0 flex-1 items-center justify-center gap-1.5 h-7 rounded-control px-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ${
      active ? 'bg-sheet text-fg shadow-lift' : 'bg-sheet/35 text-fg-2 hover:bg-sheet/70 hover:text-fg'
    }`;
  const iconCls = (active: boolean) => `shrink-0 ${active ? 'text-fg' : 'text-fg-3'}`;

  const createHome = () => {
    if (creating) return;
    setFailed(false);
    startCreate(async () => {
      try {
        const { itemId } = await openOrCreateHomeDashboard(workspaceId, t('dashboardShort'));
        onHomeCreated(itemId);
        router.push(`/dashboard/${itemId}`);
      } catch (err) {
        console.error('[Remnus] could not open the workspace dashboard:', err);
        setFailed(true);
      }
    });
  };

  return (
    <div className="pb-1.5 pt-0.5">
      <div className="flex gap-1">
        {homeDashboardId ? (
          <Link href={`/dashboard/${homeDashboardId}`} className={cls(dashboardActive)} aria-current={dashboardActive ? 'page' : undefined}>
            <LayoutDashboard size={14} className={iconCls(dashboardActive)} />
            <span className="truncate">{t('dashboardShort')}</span>
          </Link>
        ) : (
          <button type="button" onClick={createHome} disabled={creating} aria-busy={creating} className={`${cls(false)} cursor-pointer disabled:opacity-60`}>
            {creating ? (
              <Loader2 size={14} className={`animate-spin ${iconCls(false)}`} />
            ) : (
              <LayoutDashboard size={14} className={iconCls(false)} />
            )}
            <span className="truncate">{t('dashboardShort')}</span>
          </button>
        )}

        <Link
          href={`/graph/${workspaceId}`}
          title={tGraph('title')}
          className={cls(mapActive)}
          aria-current={mapActive ? 'page' : undefined}
        >
          <Waypoints size={14} className={iconCls(mapActive)} />
          <span className="truncate">{t('mapShort')}</span>
        </Link>
      </div>
      {failed && <p role="alert" className="px-2 pt-1 text-2xs text-red-400">{t('dashboardOpenFailed')}</p>}
    </div>
  );
}
