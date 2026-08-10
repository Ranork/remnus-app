'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BarChart3, LineChart as LineChartIcon, Layers, ChevronDown } from 'lucide-react';
import type { TrafficChannel, TrafficTrendPoint } from '@/lib/actions/analytics';

/**
 * Weekly/monthly traffic trend — a proper axis'd chart (not the old fixed-div
 * bars) with a bar/line/stacked view toggle and a source selector (all
 * channels, one channel, all campaign tags, or one `?ref=`/`?utm_source=`
 * tag). Rendered in SVG, measured against the card's actual width via
 * ResizeObserver so bars and gridlines stay crisp at any admin-panel width.
 *
 * The "stacked" view is a variation on Total Traffic only (see
 * AdminTrafficSources.tsx, which hides its toggle button once a different
 * source is picked): instead of the flat neutral total line/bars, it renders
 * the SAME total broken down into its 4 channels as a stacked area chart
 * (cumulative baseline-anchored layers, each channel's own validated color),
 * so an admin can see composition-over-time without leaving the default tab.
 *
 * Categorical palette (channels: 4 slots; campaigns: the next 4 slots of the
 * same 8-hue reference set) — validated against the admin card's bg-neutral-900
 * (#21252b) surface with the dataviz skill's validator: lightness band +
 * chroma floor + contrast all PASS; CVD separation for the channel set lands
 * in the 8–12 "floor band" (legal only with direct labels/legend, never color
 * alone — hence the always-visible legend for multi-series views AND the
 * per-series tooltip breakdown); the campaign set clears CVD cleanly (ΔE ≥ 23).
 */

const CHANNEL_ORDER: TrafficChannel[] = ['direct', 'organic', 'social', 'referral'];
const CHANNEL_COLOR: Record<TrafficChannel, string> = {
  direct: '#3987e5',
  organic: '#199e70',
  social: '#c98500',
  referral: '#008300',
};
// Slots 5-8 of the same validated 8-hue dark set (see palette.md), reused for
// campaign-tag series — never shown alongside the channel palette, so reusing
// hue *identity* isn't a concern, only reusing the validated ramp is the point.
const CAMPAIGN_PALETTE = ['#9085e9', '#e66767', '#d55181', '#d95926'];
// Neutral (not one of the 4 channel hues) — signals "combined, unbroken-down
// total" rather than any specific channel, echoing the grand-total number's
// text-neutral-100 styling above the chart.
const TOTAL_COLOR = '#e4e4e7';

type SourceValue = 'total' | 'channel:all' | `channel:${TrafficChannel}` | 'campaign:all' | `campaign:${string}`;

type Series = {
  key: string;
  type: 'channel' | 'campaign' | 'total';
  channel?: TrafficChannel;
  tag?: string;
};

function seriesDefsFor(source: SourceValue, campaignTags: string[]): Series[] {
  if (source === 'total') return [{ key: 'total', type: 'total' }];
  if (source === 'channel:all') return CHANNEL_ORDER.map((ch) => ({ key: ch, type: 'channel', channel: ch }));
  if (source.startsWith('channel:')) {
    const ch = source.slice('channel:'.length) as TrafficChannel;
    return [{ key: ch, type: 'channel', channel: ch }];
  }
  if (source === 'campaign:all') return campaignTags.map((tag) => ({ key: tag, type: 'campaign', tag }));
  const tag = source.slice('campaign:'.length);
  return [{ key: tag, type: 'campaign', tag }];
}

function niceCeil(value: number): number {
  if (value <= 0) return 4;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpointX = (previous[0] + point[0]) / 2;
    return `${path} C${midpointX},${previous[1]} ${midpointX},${point[1]} ${point[0]},${point[1]}`;
  }, `M${points[0][0]},${points[0][1]}`);
}

/** Rounded-top, square-bottom rect path — the mark spec's "4px rounded data-end, square at the baseline," sized down to 2px for this chart's scale. */
function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  if (rr === 0) return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const CONTAINER_HEIGHT = 230;
const PAD = { left: 40, right: 10, top: 14, bottom: 26 };

export function TrafficTrendChart({
  data,
  granularity,
  range,
  rangeOptions,
  onRangeChangeAction,
  campaignTags,
  viewMode,
  onViewModeChangeAction,
  source,
  onSourceChangeAction,
}: {
  data: TrafficTrendPoint[];
  granularity: 'day' | 'week' | 'month';
  range: number;
  rangeOptions: number[];
  onRangeChangeAction: (range: number) => void;
  campaignTags: string[];
  viewMode: 'bar' | 'line' | 'stacked';
  onViewModeChangeAction: (v: 'bar' | 'line' | 'stacked') => void;
  source: SourceValue;
  onSourceChangeAction: (v: SourceValue) => void;
}) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [containerRef, width] = useMeasuredWidth();
  const [hover, setHover] = useState<number | null>(null);
  const hoveredIndex = hover !== null && hover < data.length ? hover : null;

  const channelLabel: Record<TrafficChannel, string> = useMemo(
    () => ({
      direct: t('channelDirect'),
      organic: t('channelOrganicSearch'),
      social: t('channelSocial'),
      referral: t('channelReferral'),
    }),
    [t],
  );

  const isCampaignFamily = source.startsWith('campaign:');
  const isStacked = viewMode === 'stacked';
  // The stacked view always breaks the total down by channel — it's only
  // ever shown while `source === 'total'` (the toggle button is hidden
  // otherwise), so this substitution never conflicts with an explicit
  // channel/campaign pick.
  const seriesSource: SourceValue = isStacked ? 'channel:all' : source;
  const isMulti = seriesSource === 'channel:all' || seriesSource === 'campaign:all';

  const series = useMemo(() => {
    return seriesDefsFor(seriesSource, campaignTags).map((s) => ({
      ...s,
      label: s.type === 'total' ? t('trafficSourceTotal') : s.type === 'channel' ? channelLabel[s.channel!] : s.tag!,
      color:
        s.type === 'total'
          ? TOTAL_COLOR
          : s.type === 'channel'
            ? CHANNEL_COLOR[s.channel!]
            : CAMPAIGN_PALETTE[Math.max(0, campaignTags.indexOf(s.tag!)) % CAMPAIGN_PALETTE.length],
      values: data.map((d) =>
        s.type === 'total' ? d.visitors : s.type === 'channel' ? d.channels[s.channel!] : (d.campaigns[s.tag!] ?? 0),
      ),
    }));
  }, [seriesSource, campaignTags, data, channelLabel, t]);

  const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const perBucketSum = data.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0));
  const perBucketMax = data.map((_, i) => Math.max(0, ...series.map((ser) => ser.values[i])));
  const scaleBasis = viewMode === 'bar' || isStacked ? perBucketSum : perBucketMax;
  const niceMax = niceCeil(Math.max(1, ...scaleBasis));

  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    ...(granularity === 'month' ? { year: 'numeric' } : { day: 'numeric' }),
  });

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = CONTAINER_HEIGHT - PAD.top - PAD.bottom;
  const baselineY = PAD.top + plotHeight;
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const xCenter = (i: number) => PAD.left + slot * (i + 0.5);
  const yFor = (v: number) => baselineY - (v / niceMax) * plotHeight;
  const yTicks = [0, niceMax / 2, niceMax];
  const maxXLabels = Math.max(2, Math.floor(plotWidth / 68));
  const xLabelStep = Math.max(1, Math.ceil((data.length - 1) / Math.max(1, maxXLabels - 1)));
  const showXLabel = (i: number) => {
    if (i === 0 || i === data.length - 1) return true;
    return i % xLabelStep === 0;
  };

  const barSegments = useMemo(() => {
    if (viewMode !== 'bar' || width === 0) return [];
    const out: { i: number; key: string; path: string; color: string }[] = [];
    const barW = Math.min(24, slot * 0.6);
    for (let i = 0; i < data.length; i++) {
      const x = xCenter(i) - barW / 2;
      const visible = series.map((s) => ({ s, v: s.values[i] })).filter((e) => e.v > 0);
      let cursorY = baselineY;
      visible.forEach((e, idx) => {
        const h = Math.max(2, (e.v / niceMax) * plotHeight);
        const y = cursorY - h;
        const isTop = idx === visible.length - 1;
        out.push({
          i,
          key: e.s.key,
          path: isTop ? roundedTopRectPath(x, y, barW, h, 2) : `M${x},${y} H${x + barW} V${y + h} H${x} Z`,
          color: e.s.color,
        });
        cursorY = y - (isMulti && idx < visible.length - 1 ? 2 : 0);
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, series, data, niceMax, plotHeight, baselineY, slot, width, isMulti]);

  const linePaths = useMemo(() => {
    if (viewMode !== 'line' || width === 0) return [];
    return series.map((s) => {
      const pts = data.map((_, i) => [xCenter(i), yFor(s.values[i])] as const);
      const d = smoothPath(pts);
      const area = !isMulti ? `${d} L${xCenter(data.length - 1)},${baselineY} L${xCenter(0)},${baselineY} Z` : null;
      return { key: s.key, color: s.color, d, area, pts };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, series, data, niceMax, plotHeight, baselineY, slot, width, isMulti]);

  // Baseline-anchored stacked areas — each channel's cumulative slice on top
  // of the last, so the outer envelope always traces the same grand total the
  // flat "line"/"bar" total views show. A 2px surface-colored seam is drawn
  // along each internal boundary (mark spec: "surface gap between fills"),
  // matching the 2px gap barSegments already uses between stacked bar segments.
  const stacked = useMemo(() => {
    if (!isStacked || width === 0) return { layers: [] as { key: string; color: string; path: string }[], seams: [] as string[] };
    const cum = new Array(data.length).fill(0);
    const layers: { key: string; color: string; path: string }[] = [];
    const seams: string[] = [];
    series.forEach((s, idx) => {
      const topPts: (readonly [number, number])[] = [];
      const bottomPts: (readonly [number, number])[] = [];
      for (let i = 0; i < data.length; i++) {
        const bottom = cum[i];
        const top = bottom + s.values[i];
        topPts.push([xCenter(i), yFor(top)]);
        bottomPts.push([xCenter(i), yFor(bottom)]);
        cum[i] = top;
      }
      const topPath = smoothPath(topPts);
      const lastBottom = bottomPts[bottomPts.length - 1];
      const bottomReturn = smoothPath([...bottomPts].reverse()).replace(/^M/, 'L');
      layers.push({ key: s.key, color: s.color, path: `${topPath} L${lastBottom[0]},${lastBottom[1]} ${bottomReturn} Z` });
      if (idx < series.length - 1) seams.push(topPath);
    });
    return { layers, seams };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStacked, series, data, niceMax, plotHeight, baselineY, slot, width]);

  if (data.length === 0) return null;

  const tooltipLeft =
    hoveredIndex === null ? 0 : Math.min(Math.max(xCenter(hoveredIndex), 56), Math.max(56, width - 56));
  const totalLabel = isCampaignFamily
    ? granularity === 'day'
      ? t('trafficTrendCampaignDailyTotalLabel', { count: range })
      : granularity === 'week'
        ? t('trafficTrendCampaignWeeklyTotalLabel', { count: range })
        : t('trafficTrendCampaignMonthlyTotalLabel', { count: range })
    : granularity === 'day'
      ? t('trafficTrendDailyTotalLabel', { count: range })
      : granularity === 'week'
        ? t('trafficTrendWeeklyTotalLabel', { count: range })
        : t('trafficTrendMonthlyTotalLabel', { count: range });
  const rangeLabel = (value: number) =>
    granularity === 'day'
      ? t('trafficRangeDaysShort', { count: value })
      : granularity === 'week'
        ? t('trafficRangeWeeksShort', { count: value })
        : t('trafficRangeMonthsShort', { count: value });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-100 tabular-nums">{grandTotal}</span>
          <span className="text-xs text-neutral-500">{totalLabel}</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
          {rangeOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRangeChangeAction(option)}
              aria-pressed={range === option}
              className={`rounded px-2 py-1 text-[10px] font-medium tabular-nums transition-colors cursor-pointer ${
                range === option
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
              }`}
            >
              {rangeLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SourceSelect
          value={source}
          onChange={onSourceChangeAction}
          campaignTags={campaignTags}
          channelLabel={channelLabel}
          t={t}
        />
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-800 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChangeAction('bar')}
            title={t('trafficViewBar')}
            aria-pressed={viewMode === 'bar'}
            className={`rounded p-1 transition-colors cursor-pointer ${
              viewMode === 'bar' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <BarChart3 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChangeAction('line')}
            title={t('trafficViewLine')}
            aria-pressed={viewMode === 'line'}
            className={`rounded p-1 transition-colors cursor-pointer ${
              viewMode === 'line' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <LineChartIcon size={13} />
          </button>
          {source === 'total' && (
            <button
              type="button"
              onClick={() => onViewModeChangeAction('stacked')}
              title={t('trafficViewStacked')}
              aria-pressed={viewMode === 'stacked'}
              className={`rounded p-1 transition-colors cursor-pointer ${
                viewMode === 'stacked' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Layers size={13} />
            </button>
          )}
        </div>
      </div>

      {isMulti && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-neutral-400">{s.label}</span>
              <span className="font-medium tabular-nums text-neutral-200">{totals[i]}</span>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative w-full" style={{ height: CONTAINER_HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={CONTAINER_HEIGHT} className="overflow-visible" role="img">
            <title>{totalLabel}</title>
            <defs>
              {linePaths.map((lp, index) => (
                <linearGradient key={lp.key} id={`traffic-area-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lp.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={lp.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {yTicks.map((v, idx) => {
              const y = yFor(v);
              return (
                <g key={idx}>
                  {idx > 0 && (
                    <line x1={PAD.left} x2={PAD.left + plotWidth} y1={y} y2={y} stroke="#383b41" strokeWidth={1} />
                  )}
                  <text x={PAD.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#6b7280">
                    {Math.round(v).toLocaleString(locale)}
                  </text>
                </g>
              );
            })}

            {data.map(
              (d, i) =>
                showXLabel(i) && (
                  <text key={d.date} x={xCenter(i)} y={CONTAINER_HEIGHT - 6} textAnchor="middle" fontSize={9} fill="#6b7280">
                    {fmt.format(new Date(d.date))}
                  </text>
                ),
            )}

            {/* Y axis (left) + X axis (bottom) — hairline, recessive */}
            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={baselineY} stroke="#52525b" strokeWidth={1} />
            <line x1={PAD.left} x2={PAD.left + plotWidth} y1={baselineY} y2={baselineY} stroke="#52525b" strokeWidth={1} />

            {hoveredIndex !== null && (
              <line
                x1={xCenter(hoveredIndex)}
                x2={xCenter(hoveredIndex)}
                y1={PAD.top}
                y2={baselineY}
                stroke="#52525b"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}

            {viewMode === 'bar'
              ? barSegments.map((seg) => (
                  <path
                    key={`${seg.i}-${seg.key}`}
                    d={seg.path}
                    fill={seg.color}
                    opacity={hoveredIndex === null || hoveredIndex === seg.i ? 1 : 0.55}
                    style={{ transition: 'opacity 100ms' }}
                  />
                ))
              : isStacked
                ? (
                    <>
                      {stacked.layers.map((layer) => (
                        <path key={layer.key} d={layer.path} fill={layer.color} fillOpacity={0.62} stroke="none" />
                      ))}
                      {stacked.seams.map((seam, i) => (
                        <path key={i} d={seam} fill="none" stroke="#21252b" strokeWidth={2} />
                      ))}
                    </>
                  )
                : linePaths.map((lp, lineIndex) => (
                  <g key={lp.key}>
                    {lp.area && <path d={lp.area} fill={`url(#traffic-area-${lineIndex})`} stroke="none" />}
                    <path d={lp.d} fill="none" stroke={lp.color} strokeWidth={7} strokeOpacity={0.08} strokeLinecap="round" />
                    <path d={lp.d} fill="none" stroke={lp.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                    {lp.pts.map(([x, y], i) =>
                      hoveredIndex === i || i === lp.pts.length - 1 ? (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={hoveredIndex === i ? 4.5 : 3}
                          fill={lp.color}
                          stroke="#21252b"
                          strokeWidth={2}
                        />
                      ) : null,
                    )}
                  </g>
                ))}

            {/* Per-bucket transparent hit zones (on top, capture hover regardless of marks) */}
            {data.map((_, i) => (
              <rect
                key={i}
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
        )}

        {hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 shadow-xl"
            style={{ left: tooltipLeft, top: 2 }}
          >
            <div className="mb-1 text-[10px] text-neutral-400">
              {fmt.format(new Date(data[hoveredIndex].date))}
            </div>
            <div className="flex flex-col gap-0.5">
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-neutral-400">{s.label}</span>
                  <span className="ml-auto pl-3 font-medium tabular-nums text-neutral-200">
                    {s.values[hoveredIndex]}
                  </span>
                </div>
              ))}
            </div>
            {isMulti && (
              <div className="mt-1 flex items-center gap-1.5 border-t border-neutral-700 pt-1 text-[10px] font-semibold text-neutral-100 tabular-nums">
                {perBucketSum[hoveredIndex]} {t('trendTooltipVisitors')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceSelect({
  value,
  onChange,
  campaignTags,
  channelLabel,
  t,
}: {
  value: SourceValue;
  onChange: (v: SourceValue) => void;
  campaignTags: string[];
  channelLabel: Record<TrafficChannel, string>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = (() => {
    if (value === 'total') return t('trafficSourceTotal');
    if (value === 'channel:all') return t('trafficSourceAllChannels');
    if (value === 'campaign:all') return t('trafficSourceAllCampaigns');
    if (value.startsWith('channel:')) return channelLabel[value.slice('channel:'.length) as TrafficChannel];
    return value.slice('campaign:'.length);
  })();
  const currentColor =
    value === 'total'
      ? TOTAL_COLOR
      : value === 'channel:all' || value === 'campaign:all'
        ? null
        : value.startsWith('channel:')
          ? CHANNEL_COLOR[value.slice('channel:'.length) as TrafficChannel]
          : CAMPAIGN_PALETTE[
              Math.max(0, campaignTags.indexOf(value.slice('campaign:'.length))) % CAMPAIGN_PALETTE.length
            ];

  const pick = (v: SourceValue) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-neutral-800 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800/40 cursor-pointer"
      >
        {currentColor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: currentColor }} />}
        <span className="truncate max-w-[140px]">{currentLabel}</span>
        <ChevronDown size={11} className="shrink-0 text-neutral-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-850 py-1 shadow-xl">
          <SourceOption
            active={value === 'total'}
            label={t('trafficSourceTotal')}
            color={TOTAL_COLOR}
            onClick={() => pick('total')}
          />
          <div className="my-1 border-t border-neutral-800" />
          <SourceOption active={value === 'channel:all'} label={t('trafficSourceAllChannels')} onClick={() => pick('channel:all')} />
          {CHANNEL_ORDER.map((ch) => (
            <SourceOption
              key={ch}
              active={value === `channel:${ch}`}
              label={channelLabel[ch]}
              color={CHANNEL_COLOR[ch]}
              onClick={() => pick(`channel:${ch}`)}
            />
          ))}
          {campaignTags.length > 0 && (
            <>
              <div className="my-1 border-t border-neutral-800" />
              <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                {t('trafficSourceCampaignsGroup')}
              </div>
              <SourceOption
                active={value === 'campaign:all'}
                label={t('trafficSourceAllCampaigns')}
                onClick={() => pick('campaign:all')}
              />
              {campaignTags.map((tag, idx) => (
                <SourceOption
                  key={tag}
                  active={value === `campaign:${tag}`}
                  label={tag}
                  color={CAMPAIGN_PALETTE[idx % CAMPAIGN_PALETTE.length]}
                  onClick={() => pick(`campaign:${tag}`)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SourceOption({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
        active ? 'bg-blue-500/8 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {color ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0" />
      )}
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto shrink-0 text-[9px] text-blue-400">✓</span>}
    </button>
  );
}
