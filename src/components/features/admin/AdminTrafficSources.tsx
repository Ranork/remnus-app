'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getTrafficSources } from '@/lib/actions/analytics';
import type { TrafficSourcesData, TrafficChannel } from '@/lib/actions/analytics';

/**
 * Landing-traffic card. Self-fetches from PostHog (via the `getTrafficSources`
 * server action) on mount so a slow/failed PostHog Query API call never blocks
 * the admin page's server render. Shows a channel-type summary (chips), a
 * per-referring-domain breakdown (bars), and — when present — a `?ref=`/
 * `utm_source` campaign-tag breakdown (bars, hidden when empty).
 */
export default function AdminTrafficSources() {
  const t = useTranslations('Admin');
  const [data, setData] = useState<TrafficSourcesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getTrafficSources()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p className="text-xs text-neutral-500">{t('trafficLoading')}</p>;
  if (!data || !data.available)
    return <p className="text-xs text-neutral-500">{t('trafficUnavailable')}</p>;
  if (data.domains.length === 0)
    return <p className="text-xs text-neutral-500">{t('trafficEmpty')}</p>;

  const channelLabel: Record<TrafficChannel, string> = {
    direct: t('channelDirect'),
    organic: t('channelOrganicSearch'),
    social: t('channelSocial'),
    referral: t('channelReferral'),
  };

  const chTotal = data.channels.reduce((s, c) => s + c.visitors, 0) || 1;
  const topDomains = data.domains.slice(0, 8);
  const domTotal = data.domains.reduce((s, d) => s + d.visitors, 0) || 1;
  const domMax = Math.max(1, ...topDomains.map((d) => d.visitors));
  const topCampaigns = data.campaigns.slice(0, 8);
  const campMax = Math.max(1, ...topCampaigns.map((c) => c.visitors));

  return (
    <div className="flex flex-col gap-4">
      {/* Channel-type summary */}
      <div className="flex flex-wrap gap-2">
        {data.channels.map((c) => {
          const pct = Math.round((c.visitors / chTotal) * 100);
          return (
            <span
              key={c.channel}
              className="flex items-center gap-1.5 rounded-full bg-neutral-850 px-3 py-1 text-xs"
            >
              <span className="text-neutral-300">{channelLabel[c.channel]}</span>
              <span className="font-medium tabular-nums text-neutral-100">{c.visitors}</span>
              <span className="text-neutral-500">· {pct}%</span>
            </span>
          );
        })}
      </div>

      {/* Per-domain detail */}
      <div className="flex flex-col gap-2">
        {topDomains.map((d) => {
          const label = d.source === '$direct' ? channelLabel.direct : d.source;
          const pct = Math.round((d.visitors / domTotal) * 100);
          return (
            <div key={d.source} className="flex items-center gap-3">
              <span
                className="w-36 shrink-0 truncate text-xs text-neutral-300"
                title={d.source === '$direct' ? channelLabel.direct : d.source}
              >
                {label}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-850">
                <div
                  className="h-full rounded bg-blue-500/55"
                  style={{ width: `${Math.max(4, Math.round((d.visitors / domMax) * 100))}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                <span className="font-medium text-neutral-200">{d.visitors}</span>
                <span className="text-neutral-500"> · {pct}%</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Campaign / ref tag detail (?ref=<tag> or ?utm_source=<tag>) */}
      {topCampaigns.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-neutral-800 pt-3">
          <span className="text-xs font-medium text-neutral-400">{t('trafficCampaignsTitle')}</span>
          {topCampaigns.map((c) => (
            <div key={c.tag} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-xs text-neutral-300" title={c.tag}>
                {c.tag}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-850">
                <div
                  className="h-full rounded bg-green-400/55"
                  style={{ width: `${Math.max(4, Math.round((c.visitors / campMax) * 100))}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                <span className="font-medium text-neutral-200">{c.visitors}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-neutral-600">{t('trafficVisitors')}</p>
    </div>
  );
}
