'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
