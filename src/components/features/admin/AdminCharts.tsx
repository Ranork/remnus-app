'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Interactive admin dashboard charts. Split into a client component so the bars
 * can show real hover tooltips (a server component can't hold hover state). Data
 * is computed server-side and passed in as plain props.
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

// ── Acquisition sources: horizontal bars ────────────────────────────────────
export function AcquisitionSourcesChart({
  data,
  directLabel,
  emptyLabel,
}: {
  data: { channel: string; count: number }[];
  directLabel: string;
  emptyLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (data.length === 0) {
    return <p className="text-xs text-neutral-500">{emptyLabel}</p>;
  }
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((s) => {
        const label = s.channel === 'direct' ? directLabel : s.channel;
        const pct = Math.round((s.count / total) * 100);
        const active = hover === s.channel;
        return (
          <div
            key={s.channel}
            className="group flex items-center gap-3"
            onMouseEnter={() => setHover(s.channel)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={`w-32 shrink-0 truncate text-xs transition-colors ${active ? 'text-neutral-100' : 'text-neutral-300'}`}
              title={s.channel}
            >
              {label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-neutral-850">
              <div
                className={`h-full rounded transition-colors duration-100 ${active ? 'bg-blue-400' : 'bg-blue-500/55'}`}
                style={{ width: `${Math.max(4, Math.round((s.count / max) * 100))}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-400">
              <span className="font-medium text-neutral-200">{s.count}</span>
              <span className="text-neutral-500"> · {pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Activation funnel: staged bars with conversion ──────────────────────────
export function ActivationFunnelChart({
  stages,
}: {
  stages: { label: string; count: number }[];
}) {
  const t = useTranslations('Admin');
  const [hover, setHover] = useState<number | null>(null);
  const base = Math.max(1, stages[0]?.count ?? 0);
  // Darkest → lightest blue as the funnel narrows, so the drop-off reads visually.
  const shades = ['bg-blue-600', 'bg-blue-500', 'bg-blue-400'];

  return (
    <div className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].count;
        const conv = prev == null ? null : prev === 0 ? 0 : Math.round((s.count / prev) * 100);
        const overall = Math.round((s.count / base) * 100);
        const widthPct = Math.max(4, overall);
        const active = hover === i;
        return (
          <div
            key={s.label}
            className="flex items-center gap-3"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-44 shrink-0 truncate text-xs text-neutral-300" title={s.label}>
              {s.label}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded bg-neutral-850">
              <div
                className={`flex h-full items-center rounded px-2 transition-opacity duration-100 ${shades[i] ?? 'bg-blue-500'} ${active ? 'opacity-100' : 'opacity-85'}`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-[11px] font-semibold tabular-nums text-white/90">{s.count}</span>
              </div>
              {active && (
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">
                  {overall}% {t('funnelOfSignups')}
                </div>
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums">
              {conv != null ? (
                <span className={conv >= 50 ? 'text-green-400' : conv >= 25 ? 'text-amber-400' : 'text-red-400'}>
                  {conv}%
                </span>
              ) : (
                <span className="text-neutral-600">—</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
