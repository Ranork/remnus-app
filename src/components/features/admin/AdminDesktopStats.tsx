'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getDesktopDownloadStats } from '@/lib/actions/analytics';
import type { DesktopDownloadStats } from '@/lib/actions/analytics';

/**
 * Desktop (Tauri) download-click breakdown by OS. Self-fetches from PostHog
 * (via the `getDesktopDownloadStats` server action) on mount, mirroring
 * {@link AdminTrafficSources}'s loading/unavailable/empty pattern exactly —
 * a slow/failed PostHog Query API call never blocks the admin page's render.
 */
export default function AdminDesktopStats() {
  const t = useTranslations('Admin');
  const [data, setData] = useState<DesktopDownloadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getDesktopDownloadStats()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p className="text-xs text-neutral-500">{t('desktopLoading')}</p>;
  if (!data || !data.available)
    return <p className="text-xs text-neutral-500">{t('desktopUnavailable')}</p>;
  if (data.byOs.length === 0)
    return <p className="text-xs text-neutral-500">{t('desktopEmpty')}</p>;

  const max = Math.max(1, ...data.byOs.map((r) => r.clicks));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-neutral-850 px-3 py-1 text-xs">
          <span className="font-medium tabular-nums text-neutral-100">{data.totalClicks}</span>
          <span className="text-neutral-400">{t('desktopClicksLabel')}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-neutral-850 px-3 py-1 text-xs">
          <span className="font-medium tabular-nums text-neutral-100">{data.totalVisitors}</span>
          <span className="text-neutral-400">{t('desktopVisitorsLabel')}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {data.byOs.map((r) => (
          <div key={r.os} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-neutral-300 capitalize" title={r.os}>
              {r.os}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-850">
              <div
                className="h-full rounded bg-emerald-500/55"
                style={{ width: `${Math.max(4, Math.round((r.clicks / max) * 100))}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-neutral-400">
              <span className="font-medium text-neutral-200">{r.clicks}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
