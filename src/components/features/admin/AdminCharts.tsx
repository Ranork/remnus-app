'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DemoUsageOverview, DemoDurationBucket } from '@/lib/actions/analytics';
import { formatDuration } from './format';

/**
 * Interactive admin dashboard charts. Split into a client component so the bars
 * can show real hover tooltips (a server component can't hold hover state). Data
 * is computed server-side and passed in as plain props.
 *
 * The weekly/monthly traffic trend chart lives in `TrafficTrendChart.tsx`
 * (its own file — SVG axes, bar/line toggle, source selector — big enough to
 * warrant separating from this file).
 */

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 shadow-xl">
      {children}
      <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 h-2 w-2 rotate-45 border-b border-r border-neutral-700 bg-neutral-800" />
    </div>
  );
}

// ── Signup trend: 30-day bar chart ──────────────────────────────────────────
export function SignupTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-neutral-100 tabular-nums">{total}</span>
        <span className="text-xs text-neutral-500">{t('trendTotalLabel')}</span>
      </div>
      <div className="relative flex h-28 items-end gap-0.5">
        {data.map((d, i) => {
          const h = d.count === 0 ? 3 : Math.round((d.count / max) * 92) + 8;
          const active = hover === i;
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-sm transition-colors duration-100 ${
                  d.count === 0
                    ? 'bg-neutral-800'
                    : active
                      ? 'bg-blue-400'
                      : 'bg-blue-500/45'
                }`}
                style={{ height: `${h}px` }}
              />
              {active && (
                <Tooltip>
                  <div className="text-[11px] font-semibold text-neutral-100 tabular-nums">
                    {d.count} {t('trendTooltipSignups')}
                  </div>
                  <div className="text-[10px] text-neutral-400">{fmt.format(new Date(d.date))}</div>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Demo usage: 30-day starts + time spent ──────────────────────────────────
// Backed by `demo_sessions` (migration 0044), the only demo record that outlives
// the 6-hourly demo-account purge. Bars are demo COUNT per day (directly
// comparable to the signup trend above it); the time-spent side of the question
// is answered by the avg/median/longest chips, the per-day average in each
// tooltip, and the distribution strip — a duration bar chart would hide the
// spread behind a daily mean computed from a handful of demos.

// Untranslated on purpose — same convention as formatDuration's "3h 5m" output,
// which every locale already renders as-is across the admin panel.
const BUCKET_LABELS: Record<DemoDurationBucket, string> = {
  under1m: '< 1m',
  from1to5m: '1–5m',
  from5to15m: '5–15m',
  over15m: '15m+',
};

const BUCKET_COLORS: Record<DemoDurationBucket, string> = {
  under1m: 'bg-blue-500/20',
  from1to5m: 'bg-blue-500/40',
  from5to15m: 'bg-blue-500/65',
  over15m: 'bg-blue-400',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-neutral-200">{value}</span>
    </div>
  );
}

export function DemoUsageChart({ data }: { data: DemoUsageOverview }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.trend.map((d) => d.count));
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  if (data.totalAllTime === 0) {
    return <p className="text-xs text-neutral-500">{t('demoUsageEmpty')}</p>;
  }

  const bucketTotal = data.buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-neutral-100">{data.total30d}</span>
          <span className="text-xs text-neutral-500">{t('demoUsageTotalLabel')}</span>
        </div>
        <div className="flex items-end gap-5">
          <Stat label={t('demoUsageAvgLabel')} value={formatDuration(data.avgSeconds30d)} />
          <Stat label={t('demoUsageMedianLabel')} value={formatDuration(data.medianSeconds30d)} />
          <Stat label={t('demoUsageLongestLabel')} value={formatDuration(data.longestSeconds30d)} />
        </div>
      </div>

      <div className="relative flex h-28 items-end gap-0.5">
        {data.trend.map((d, i) => {
          const h = d.count === 0 ? 3 : Math.round((d.count / max) * 92) + 8;
          const active = hover === i;
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-sm transition-colors duration-100 ${
                  d.count === 0 ? 'bg-neutral-800' : active ? 'bg-blue-400' : 'bg-blue-500/45'
                }`}
                style={{ height: `${h}px` }}
              />
              {active && (
                <Tooltip>
                  <div className="text-[11px] font-semibold tabular-nums text-neutral-100">
                    {d.count} {t('demoUsageTooltipDemos')}
                  </div>
                  {d.count > 0 && (
                    <div className="text-[10px] tabular-nums text-neutral-400">
                      {t('demoUsageTooltipAvg', { duration: formatDuration(d.avgSeconds) })}
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500">{fmt.format(new Date(d.date))}</div>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>

      {bucketTotal > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
            {t('demoUsageDistributionLabel')}
          </span>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-neutral-850">
            {data.buckets.map((b) =>
              b.count === 0 ? null : (
                <div
                  key={b.key}
                  className={BUCKET_COLORS[b.key]}
                  style={{ width: `${(b.count / bucketTotal) * 100}%` }}
                />
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.buckets.map((b) => (
              <span key={b.key} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span className={`h-2 w-2 rounded-sm ${BUCKET_COLORS[b.key]}`} />
                {BUCKET_LABELS[b.key]}
                <span className="font-semibold tabular-nums text-neutral-300">{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
