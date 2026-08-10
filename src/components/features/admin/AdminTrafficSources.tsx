'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getTrafficSources, getTrafficTrend } from '@/lib/actions/analytics';
import type { TrafficSourcesData, TrafficChannel, TrafficTrendData } from '@/lib/actions/analytics';
import { TrafficTrendChart } from './TrafficTrendChart';

type Tab = 'daily' | 'weekly' | 'monthly' | 'sources';
type TrendViewMode = 'bar' | 'line' | 'stacked';
type TrendSource = 'total' | 'channel:all' | `channel:${TrafficChannel}` | 'campaign:all' | `campaign:${string}`;
type TrendGranularity = 'day' | 'week' | 'month';
type SourcesRange = 1 | 7 | 30 | 'all';

const RANGE_OPTIONS: Record<TrendGranularity, number[]> = {
  day: [30, 90, 365],
  week: [12, 26, 52],
  month: [12, 24, 36],
};

const SOURCES_RANGE_OPTIONS: SourcesRange[] = [1, 7, 30, 'all'];

/**
 * Landing-traffic card. Self-fetches from PostHog (via the `getTrafficSources`
 * + `getTrafficTrend` server actions) on mount so a slow/failed PostHog Query
 * API call never blocks the admin page's server render. Tabbed: "Daily"/
 * "Weekly"/"Monthly" visitor trends first (the default view on page load),
 * then "Sources" (channel-type summary, per-referring-domain breakdown,
 * campaign tags) last — its own time-range picker (today/7d/30d/all time),
 * independent of the trend tabs' day/week/month range pickers.
 */
export default function AdminTrafficSources() {
  const t = useTranslations('Admin');
  const [tab, setTab] = useState<Tab>('daily');
  const [data, setData] = useState<TrafficSourcesData | null>(null);
  const [trend, setTrend] = useState<TrafficTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesRange, setSourcesRange] = useState<SourcesRange>(30);
  // Lifted up (rather than local to TrafficTrendChart) so the chosen view/source
  // survives switching away to the Sources tab and back within the same session.
  const [trendView, setTrendView] = useState<TrendViewMode>('line');
  const [trendSource, setTrendSource] = useState<TrendSource>('total');
  const [trendRanges, setTrendRanges] = useState<Record<TrendGranularity, number>>({ day: 30, week: 12, month: 12 });

  // Trend (daily/weekly/monthly) fetches once on mount — its own 365-day/
  // 52-week/36-month windows are computed server-side in one shot, independent
  // of the Sources tab's range.
  useEffect(() => {
    let alive = true;
    getTrafficTrend()
      .then((tr) => {
        if (alive) setTrend(tr);
      })
      .catch(() => {
        if (alive) setTrend(null);
      })
      .finally(() => alive && setTrendLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Sources tab re-fetches whenever its own range picker changes.
  useEffect(() => {
    let alive = true;
    setSourcesLoading(true);
    getTrafficSources(sourcesRange)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => alive && setSourcesLoading(false));
    return () => {
      alive = false;
    };
  }, [sourcesRange]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daily', label: t('trafficTabDaily') },
    { id: 'weekly', label: t('trafficTabWeekly') },
    { id: 'monthly', label: t('trafficTabMonthly') },
    { id: 'sources', label: t('trafficTabSources') },
  ];

  const tabStrip = (
    <div className="mb-3 flex gap-1 border-b border-neutral-800">
      {tabs.map((tb) => (
        <button
          key={tb.id}
          type="button"
          onClick={() => setTab(tb.id)}
          className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            tab === tb.id
              ? 'border-blue-500 text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {tb.label}
        </button>
      ))}
    </div>
  );

  const sourcesRangeLabel = (range: SourcesRange) =>
    range === 'all'
      ? t('trafficRangeAllTime')
      : range === 1
        ? t('trafficRangeToday')
        : range === 7
          ? t('trafficRangeLast7Days')
          : t('trafficRangeLast30Days');

  const sourcesRangeStrip = (
    <div className="mb-3 flex items-center gap-0.5 self-start rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
      {SOURCES_RANGE_OPTIONS.map((option) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => setSourcesRange(option)}
          aria-pressed={sourcesRange === option}
          className={`rounded px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
            sourcesRange === option
              ? 'bg-neutral-800 text-neutral-100'
              : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
          }`}
        >
          {sourcesRangeLabel(option)}
        </button>
      ))}
    </div>
  );

  if (tab === 'daily' || tab === 'weekly' || tab === 'monthly') {
    if (trendLoading)
      return (
        <div>
          {tabStrip}
          <p className="text-xs text-neutral-500">{t('trafficLoading')}</p>
        </div>
      );

    const granularity: TrendGranularity = tab === 'daily' ? 'day' : tab === 'weekly' ? 'week' : 'month';
    const range = trendRanges[granularity];
    const allPoints = tab === 'daily' ? trend?.daily : tab === 'weekly' ? trend?.weekly : trend?.monthly;
    const points = allPoints?.slice(-range);
    return (
      <div>
        {tabStrip}
        {!trend || !trend.available ? (
          <p className="text-xs text-neutral-500">{t('trafficUnavailable')}</p>
        ) : (
          <TrafficTrendChart
            data={points ?? []}
            granularity={granularity}
            range={range}
            rangeOptions={RANGE_OPTIONS[granularity]}
            onRangeChangeAction={(nextRange) =>
              setTrendRanges((current) => ({ ...current, [granularity]: nextRange }))
            }
            campaignTags={trend.campaignTags}
            viewMode={trendView}
            onViewModeChangeAction={setTrendView}
            source={trendSource}
            onSourceChangeAction={(nextSource) => {
              setTrendSource(nextSource);
              // The "stacked" variation only makes sense against Total Traffic
              // (see AdminTrafficSources.tsx) — fall back to the line view if
              // the admin picks a different source while it's active.
              setTrendView((view) => (nextSource !== 'total' && view === 'stacked' ? 'line' : view));
            }}
          />
        )}
      </div>
    );
  }

  // tab === 'sources'
  if (sourcesLoading)
    return (
      <div>
        {tabStrip}
        {sourcesRangeStrip}
        <p className="text-xs text-neutral-500">{t('trafficLoading')}</p>
      </div>
    );

  if (!data || !data.available)
    return (
      <div>
        {tabStrip}
        {sourcesRangeStrip}
        <p className="text-xs text-neutral-500">{t('trafficUnavailable')}</p>
      </div>
    );
  if (data.domains.length === 0)
    return (
      <div>
        {tabStrip}
        {sourcesRangeStrip}
        <p className="text-xs text-neutral-500">{t('trafficEmpty')}</p>
      </div>
    );

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
      {tabStrip}
      {sourcesRangeStrip}
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
