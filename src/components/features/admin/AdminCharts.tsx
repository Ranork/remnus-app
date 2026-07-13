'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { TrafficChannel } from '@/lib/actions/analytics';

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

// ── Traffic trend: weekly/monthly visitor stacked bar chart, by channel ─────
// Categorical palette (4 slots, dark-surface variant), fixed order — validated
// against the admin card's bg-neutral-900 (#21252b) surface with the dataviz
// skill's validator: lightness band + chroma floor PASS, CVD separation is in
// the 8-12 "floor band" WARN (legal only with direct labels/legend, never
// color alone) — hence the always-visible legend below AND the per-channel
// tooltip breakdown, never just the stacked color.
const CHANNEL_ORDER: TrafficChannel[] = ['direct', 'organic', 'social', 'referral'];
const CHANNEL_COLOR: Record<TrafficChannel, string> = {
  direct: '#3987e5',
  organic: '#199e70',
  social: '#c98500',
  referral: '#008300',
};
// Render order bottom→top of the stack is the reverse of the legend order
// (direct nearest the baseline), achieved by DOM order top→bottom inside a
// `flex-col justify-end` column.
const STACK_RENDER_ORDER = [...CHANNEL_ORDER].reverse();

export function TrafficTrendChart({
  data,
  granularity,
}: {
  data: { date: string; visitors: number; channels: Record<TrafficChannel, number> }[];
  granularity: 'week' | 'month';
}) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.visitors));
  const total = data.reduce((s, d) => s + d.visitors, 0);
  const channelTotals = CHANNEL_ORDER.reduce(
    (acc, ch) => {
      acc[ch] = data.reduce((s, d) => s + d.channels[ch], 0);
      return acc;
    },
    { direct: 0, organic: 0, social: 0, referral: 0 } as Record<TrafficChannel, number>,
  );
  const fmt = new Intl.DateTimeFormat(
    locale,
    granularity === 'week' ? { month: 'short', day: 'numeric' } : { month: 'short', year: 'numeric' },
  );
  const channelLabel: Record<TrafficChannel, string> = {
    direct: t('channelDirect'),
    organic: t('channelOrganicSearch'),
    social: t('channelSocial'),
    referral: t('channelReferral'),
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-neutral-100 tabular-nums">{total}</span>
        <span className="text-xs text-neutral-500">
          {granularity === 'week' ? t('trafficTrendWeeklyTotalLabel') : t('trafficTrendMonthlyTotalLabel')}
        </span>
      </div>

      {/* Legend — always present for 4 series, and the direct-label carrier
          the CVD floor at 4 series requires (never color alone). */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {CHANNEL_ORDER.map((ch) => (
          <span key={ch} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CHANNEL_COLOR[ch] }}
            />
            <span className="text-neutral-400">{channelLabel[ch]}</span>
            <span className="font-medium tabular-nums text-neutral-200">{channelTotals[ch]}</span>
          </span>
        ))}
      </div>

      <div className="relative flex h-28 items-end gap-1">
        {data.map((d, i) => {
          const active = hover === i;
          const visible = STACK_RENDER_ORDER.filter((ch) => d.channels[ch] > 0);
          const barH = d.visitors === 0 ? 3 : Math.round((d.visitors / max) * 92) + 8;
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {visible.length === 0 ? (
                <div className="w-full rounded-sm bg-neutral-800" style={{ height: barH }} />
              ) : (
                <div
                  className="flex w-full flex-col justify-end transition-opacity duration-100"
                  style={{ opacity: active ? 1 : 0.82 }}
                >
                  {visible.map((ch, idx) => {
                    const segH = Math.max(2, Math.round((d.channels[ch] / d.visitors) * barH));
                    const isTop = idx === 0;
                    const isBottom = idx === visible.length - 1;
                    return (
                      <div
                        key={ch}
                        className="w-full"
                        style={{
                          height: segH,
                          backgroundColor: CHANNEL_COLOR[ch],
                          marginBottom: isBottom ? 0 : 2,
                          borderTopLeftRadius: isTop ? 2 : 0,
                          borderTopRightRadius: isTop ? 2 : 0,
                        }}
                      />
                    );
                  })}
                </div>
              )}
              {active && (
                <Tooltip>
                  <div className="mb-1 text-[10px] text-neutral-400">{fmt.format(new Date(d.date))}</div>
                  <div className="mb-1.5 text-[11px] font-semibold text-neutral-100 tabular-nums">
                    {d.visitors} {t('trendTooltipVisitors')}
                  </div>
                  {d.visitors > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {CHANNEL_ORDER.filter((ch) => d.channels[ch] > 0).map((ch) => (
                        <div key={ch} className="flex items-center gap-1.5 text-[10px]">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CHANNEL_COLOR[ch] }}
                          />
                          <span className="text-neutral-400">{channelLabel[ch]}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums text-neutral-200">
                            {d.channels[ch]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
