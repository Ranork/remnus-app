import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, Minus } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import type { ChartPoint, ResolvedBlock } from '@/lib/dashboard/data';

/**
 * The non-interactive dashboard blocks, rendered on the server.
 *
 * Charts are hand-drawn SVG on purpose: this repo has no charting dependency
 * (the admin panel's trend charts are inline SVG too) and installing one for
 * seven tiles is not a trade worth making. The categorical palette below is
 * the same validated 8-hue dark set `TrafficTrendChart` uses, so every colored
 * thing in the product comes from one ramp instead of each surface inventing
 * its own.
 */

// Validated against the neutral-900/850 surfaces — see TrafficTrendChart's note.
const PALETTE = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];
// The "Other" / "no value" slot: a neutral, never one of the eight hues, so a
// bucket that isn't a real category never reads as one.
const MUTED = '#5a5f69';

function colorAt(index: number, point?: ChartPoint): string {
  if (point?.isOther || point?.isEmpty) return MUTED;
  return PALETTE[index % PALETTE.length];
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** A date-bucket label ("2026-09" / "2026-09-22") shown in the reader's locale. */
function formatAxisLabel(label: string, locale: string): string {
  if (/^\d{4}-\d{2}$/.test(label)) {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(`${label}-01T00:00:00Z`));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${label}T00:00:00Z`));
  }
  return label;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

function pointLabel(point: ChartPoint, locale: string, t: Translate): string {
  if (point.isOther) return t('chartOther');
  if (point.isEmpty) return t('chartEmpty');
  return formatAxisLabel(point.label, locale);
}

// -- shared states ------------------------------------------------------------

export async function BlockUnavailable({ reason }: { reason: 'database_missing' | 'view_missing' | 'column_missing' }) {
  const t = await getTranslations('Dashboard');
  const text =
    reason === 'database_missing' ? t('sourceRemoved') : reason === 'view_missing' ? t('viewRemoved') : t('columnRemoved');
  return (
    <div className="flex items-center gap-2 py-4 text-xs text-neutral-500">
      <CircleAlert size={13} className="shrink-0 text-amber-500/70" />
      <span>{text}</span>
    </div>
  );
}

export async function BlockInvalid({ id, error }: { id: string | null; error: string }) {
  const t = await getTranslations('Dashboard');
  return (
    <div className="py-4">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <CircleAlert size={13} className="shrink-0 text-amber-500/70" />
        <span>{id ? t('blockUnreadableWithId', { id }) : t('blockUnreadable')}</span>
      </div>
      <p className="mt-1.5 pl-[21px] font-mono text-[10px] leading-relaxed text-neutral-600 break-words">{error}</p>
    </div>
  );
}

async function NoData() {
  const t = await getTranslations('Dashboard');
  return <p className="py-4 text-xs text-neutral-500">{t('noData')}</p>;
}

// -- metric -------------------------------------------------------------------

export async function MetricBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'metric' }> }) {
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  const { value, trend, block } = data;

  if (value == null) return <NoData />;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const trendClass =
    trend?.direction === 'up' ? 'text-green-400' : trend?.direction === 'down' ? 'text-red-400' : 'text-neutral-500';

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums text-neutral-100">{formatNumber(value, locale)}</span>
        {block.unit && <span className="text-xs text-neutral-500">{block.unit}</span>}
      </div>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-[11px] ${trendClass}`}>
          <TrendIcon size={12} className="shrink-0" />
          <span className="tabular-nums">
            {trend.percent == null ? formatNumber(trend.current - trend.previous, locale) : `${formatNumber(Math.abs(trend.percent), locale)}%`}
          </span>
          <span className="text-neutral-500">{t('trendVsPrevious', { days: block.trend?.days ?? 0 })}</span>
        </div>
      )}
    </div>
  );
}

// -- chart --------------------------------------------------------------------

export async function ChartBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'chart' }> }) {
  const locale = await getLocale();
  const t = (await getTranslations('Dashboard')) as unknown as Translate;
  if (!data.points.length || data.total === 0) return <NoData />;
  if (data.block.variant === 'donut') return <DonutChart points={data.points} locale={locale} total={data.total} t={t} />;
  if (data.block.variant === 'line') return <LineChart points={data.points} locale={locale} t={t} />;
  return <BarChart points={data.points} locale={locale} t={t} />;
}

/** Horizontal bars: category names stay readable at half-tile width, which a
 *  vertical bar chart's rotated labels never manage. */
function BarChart({ points, locale, t }: { points: ChartPoint[]; locale: string; t: Translate }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const labels = points.map((p) => pointLabel(p, locale, t));

  return (
    <ul className="space-y-2">
      {points.map((point, i) => (
        <li key={`${point.label}-${i}`} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 truncate text-[11px] text-neutral-400" title={labels[i]}>
            {labels[i]}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-neutral-800/60">
            <span
              className="block h-full rounded-sm"
              style={{ width: `${Math.max((point.value / max) * 100, 2)}%`, backgroundColor: colorAt(i, point) }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-neutral-300">
            {formatNumber(point.value, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LineChart({ points, locale, t }: { points: ChartPoint[]; locale: string; t: Translate }) {
  const W = 300;
  const H = 96;
  const PAD = 4;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = PAD + i * step;
    const y = H - PAD - (p.value / max) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = coords.join(' ');
  const area = `${PAD},${H - PAD} ${line} ${(PAD + (points.length - 1) * step).toFixed(1)},${H - PAD}`;

  const first = pointLabel(points[0], locale, t);
  const last = pointLabel(points[points.length - 1], locale, t);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" role="img">
        <polygon points={area} fill={PALETTE[0]} fillOpacity={0.14} />
        <polyline points={line} fill="none" stroke={PALETTE[0]} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {/* The middle figure is the series peak. It carries a label because a bare
          number sitting between two date labels reads as a third category. */}
      <div className="mt-1.5 flex justify-between text-[10px] text-neutral-500">
        <span>{first}</span>
        <span className="tabular-nums text-neutral-400">{t('chartPeak', { value: formatNumber(max, locale) })}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

function DonutChart({ points, locale, total, t }: { points: ChartPoint[]; locale: string; total: number; t: Translate }) {
  const R = 42;
  const STROKE = 14;
  const circumference = 2 * Math.PI * R;
  const labels = points.map((p) => pointLabel(p, locale, t));

  // Each slice starts where the previous one ended, so the offsets are a
  // running sum rather than a per-point value.
  const arcs: { dash: number; offset: number; color: string }[] = [];
  for (const [i, point] of points.entries()) {
    const dash = (point.value / total) * circumference;
    const offset = arcs.length ? arcs[arcs.length - 1].offset + arcs[arcs.length - 1].dash : 0;
    arcs.push({ dash, offset, color: colorAt(i, point) });
  }

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 110 110" className="h-24 w-24 shrink-0 -rotate-90" role="img">
        <circle cx={55} cy={55} r={R} fill="none" stroke="#2f333a" strokeWidth={STROKE} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={55}
            cy={55}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {points.slice(0, 6).map((point, i) => (
          <li key={`${point.label}-${i}`} className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: colorAt(i, point) }} />
            <span className="min-w-0 flex-1 truncate text-neutral-400" title={labels[i]}>
              {labels[i]}
            </span>
            <span className="shrink-0 tabular-nums text-neutral-300">{formatNumber(point.value, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -- list ---------------------------------------------------------------------

export async function ListBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'list' }> }) {
  const t = await getTranslations('Dashboard');
  if (!data.rows.length) return <NoData />;

  const hidden = data.total - data.rows.length;

  return (
    <div>
      <ul>
        {data.rows.map((row) => (
          <li key={row.id} className="border-b border-neutral-850 last:border-b-0">
            <Link
              href={`/db/${row.databaseId}/${row.id}`}
              className="flex items-center gap-2 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800/10 hover:text-neutral-100"
            >
              <PageIcon icon={row.icon} iconColor={row.iconColor} size={13} />
              <span className="min-w-0 flex-1 truncate">{row.title || t('untitled')}</span>
              {data.columns.map((col) => {
                const value = row.properties[col.id];
                if (value == null || value === '') return null;
                return (
                  <span key={col.id} className="shrink-0 truncate text-[10px] text-neutral-500" title={col.name}>
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                );
              })}
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="pt-2 text-[10px] text-neutral-600">{t('andMore', { count: hidden })}</p>}
    </div>
  );
}

// -- text ---------------------------------------------------------------------

const TONE_CLASS = {
  default: 'text-neutral-300',
  info: 'text-blue-400/90',
  warning: 'text-amber-400/90',
} as const;

/**
 * A deliberately tiny markdown subset — headings, bold, italic, inline code,
 * links and bullets. Enough for a dashboard annotation and nothing more: the
 * block caps at 2,000 characters precisely because long-form content belongs
 * on a page, where the real editor lives.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('**')) nodes.push(<strong key={key} className="font-semibold text-neutral-100">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) nodes.push(<code key={key} className="rounded bg-neutral-800/70 px-1 py-0.5 font-mono text-[11px]">{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const [, label, href] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token) ?? [];
      const safe = href && (href.startsWith('/') || href.startsWith('https://') || href.startsWith('http://'));
      nodes.push(
        safe ? (
          <Link key={key} href={href} className="text-blue-400 hover:underline">{label}</Link>
        ) : (
          <span key={key}>{label ?? token}</span>
        ),
      );
    } else nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function TextBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'text' }> }) {
  const lines = data.block.markdown.split('\n');
  const tone = TONE_CLASS[data.block.tone];
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={key} className="my-1.5 list-disc space-y-0.5 pl-4">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bullets.push(trimmed.slice(2));
      return;
    }
    flushBullets(`ul-${index}`);
    if (!trimmed) return;
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      nodes.push(
        <p key={index} className="mb-1 mt-2 text-xs font-semibold text-neutral-100 first:mt-0">
          {renderInline(heading[2], `h-${index}`)}
        </p>,
      );
      return;
    }
    nodes.push(
      <p key={index} className="my-1 leading-relaxed">
        {renderInline(trimmed, `p-${index}`)}
      </p>,
    );
  });
  flushBullets('ul-end');

  return <div className={`text-xs ${tone}`}>{nodes}</div>;
}

// -- links --------------------------------------------------------------------

export async function LinksBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'links' }> }) {
  const t = await getTranslations('Dashboard');
  return (
    <ul>
      {data.links.map((link) => (
        <li key={link.itemId} className="border-b border-neutral-850 last:border-b-0">
          {link.href ? (
            <Link
              href={link.href}
              className="group flex items-center gap-2 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800/10 hover:text-neutral-100"
            >
              <PageIcon
                icon={link.icon}
                iconColor={link.iconColor}
                size={13}
                fallbackType={link.type === 'database' ? 'database' : link.type === 'dashboard' ? 'dashboard' : 'page'}
              />
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              <ArrowRight size={12} className="shrink-0 text-neutral-700 transition-colors group-hover:text-neutral-400" />
            </Link>
          ) : (
            <span className="flex items-center gap-2 py-1.5 text-xs text-neutral-600">
              <CircleAlert size={13} className="shrink-0 text-amber-500/50" />
              <span className="min-w-0 flex-1 truncate line-through">{link.label}</span>
              <span className="shrink-0 text-[10px]">{t('linkRemoved')}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// -- activity -----------------------------------------------------------------

export async function ActivityBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'activity' }> }) {
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  if (!data.entries.length) return <NoData />;

  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <ul>
      {data.entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-2 border-b border-neutral-850 py-1.5 text-xs last:border-b-0">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.status === 'error' ? 'bg-red-400' : 'bg-green-400/70'}`}
            aria-hidden
          />
          <span className="shrink-0 font-mono text-[11px] text-neutral-300">{entry.tool}</span>
          <span className="min-w-0 flex-1 truncate text-neutral-500">{entry.actor ?? t('unknownAgent')}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{fmt.format(entry.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
