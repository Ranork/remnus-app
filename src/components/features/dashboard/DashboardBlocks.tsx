import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bot, ChevronRight, CircleAlert, Info, Minus, TriangleAlert, Unplug } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import { EmptyState } from '@/components/ui/empty-state';
import { MarkIcon } from '@/components/features/agents/AgentMark';
import { markForId, resolveAgentMark } from '@/components/features/agents/agentMarks';
import { WRITE_TOOL, type ActivitySession, type ChartPoint, type ResolvedBlock } from '@/lib/dashboard/data';

/**
 * The non-interactive dashboard blocks, rendered on the server.
 *
 * Charts are hand-drawn SVG on purpose: this repo has no charting dependency
 * (the admin panel's trend charts are inline SVG too) and installing one for
 * seven tiles is not a trade worth making.
 *
 * Colours are the `--chart-1…8` tokens (globals.css): the dataviz reference eight in
 * their validated order, with light steps under the light theme. A category's slot
 * comes from the data layer (`ChartPoint.colorIndex`: an option keeps its slot), so a
 * colour follows the entity, never its rank. Past eight there is no ninth hue — those
 * marks go muted and lean on their labels.
 */

const MUTED = 'var(--chart-muted)';

function colorOf(point: ChartPoint, index: number): string {
  if (point.isOther || point.isEmpty) return MUTED;
  const slot = point.colorIndex ?? index;
  return slot < 8 ? `var(--chart-${slot + 1})` : MUTED;
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
// Tile-local empty and error states: an icon, one line that says what happened, and —
// for a block this build cannot read — the reason in small mono so an agent can fix it.

export async function BlockUnavailable({ reason }: { reason: 'database_missing' | 'view_missing' | 'column_missing' }) {
  const t = await getTranslations('Dashboard');
  const text =
    reason === 'database_missing' ? t('sourceRemoved') : reason === 'view_missing' ? t('viewRemoved') : t('columnRemoved');
  return <EmptyState size="sm" icon={<Unplug />} title={text} className="my-auto" />;
}

export async function BlockInvalid({ id, error }: { id: string | null; error: string }) {
  const t = await getTranslations('Dashboard');
  return (
    <EmptyState
      size="sm"
      icon={<CircleAlert className="text-signal-text" />}
      title={id ? t('blockUnreadableWithId', { id }) : t('blockUnreadable')}
      description={<span className="font-mono text-2xs text-fg-4 break-words">{error}</span>}
      className="my-auto"
    />
  );
}

async function NoData() {
  const t = await getTranslations('Dashboard');
  return <EmptyState size="sm" icon={<BarChart3 />} title={t('noData')} className="my-auto" />;
}

// -- metric -------------------------------------------------------------------

export async function MetricBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'metric' }> }) {
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  const { value, trend, block } = data;

  if (value == null) return <NoData />;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  // The change is told in ink, not green/red: whether "up" is good depends on what is
  // counted (open bugs vs shipped features), which the tile cannot know.
  const delta = trend
    ? trend.percent == null
      ? `${trend.current - trend.previous > 0 ? '+' : ''}${formatNumber(trend.current - trend.previous, locale)}`
      : `${trend.direction === 'down' ? '−' : trend.direction === 'up' ? '+' : ''}${formatNumber(Math.abs(trend.percent), locale)}%`
    : null;

  // Pinned to the foot of the tile: in a row stretched by a taller neighbour the number
  // sits on the baseline the eye expects, not floating under the title.
  return (
    <div className="mt-auto">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-fg">{formatNumber(value, locale)}</span>
        {block.unit && <span className="text-sm font-medium text-fg-3">{block.unit}</span>}
      </div>
      {trend && (
        <p className="mt-2.5 flex items-center gap-1 text-xs text-fg-3">
          <TrendIcon size={14} className="shrink-0 text-fg-2" aria-hidden />
          <span className="font-semibold tabular-nums text-fg-2">{delta}</span>
          <span>{t('trendVsPrevious', { days: block.trend?.days ?? 0 })}</span>
        </p>
      )}
    </div>
  );
}

// -- chart --------------------------------------------------------------------

export async function ChartBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'chart' }> }) {
  const locale = await getLocale();
  const t = (await getTranslations('Dashboard')) as unknown as Translate;
  if (!data.points.length || data.total === 0) return <NoData />;
  if (data.block.variant === 'stack') return <StackedBar points={data.points} locale={locale} total={data.total} t={t} />;
  if (data.block.variant === 'donut') return <DonutChart points={data.points} locale={locale} total={data.total} t={t} />;
  if (data.block.variant === 'line') return <LineChart points={data.points} locale={locale} t={t} />;
  return <BarChart points={data.points} locale={locale} t={t} />;
}

/**
 * Part-to-whole as one horizontal bar split into its categories (2px surface gaps, a
 * pill end), with a two-column legend carrying the counts — the values are always
 * printed, so no light-theme slot under 3:1 carries meaning by colour alone.
 */
function StackedBar({ points, locale, total, t }: { points: ChartPoint[]; locale: string; total: number; t: Translate }) {
  const labels = points.map((p) => pointLabel(p, locale, t));
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value / total);

  return (
    <div className="mt-auto">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={points.map((p, i) => `${labels[i]} ${p.value}`).join(', ')}>
        {points.map((point, i) => (
          <span
            key={`${point.label}-${i}`}
            className="h-full min-w-1"
            style={{ width: `${(point.value / total) * 100}%`, backgroundColor: colorOf(point, i) }}
            // A plain title attribute: React 19 hoists a <title> element out of HTML into <head>.
            title={`${labels[i]}: ${formatNumber(point.value, locale)} (${percent(point.value)})`}
          />
        ))}
      </div>
      <ul className="mt-3.5 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {points.map((point, i) => (
          <li key={`${point.label}-${i}`} className="flex min-w-0 items-center gap-2 text-xs">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(point, i) }} />
            <span className="min-w-0 flex-1 truncate text-fg-2" title={labels[i]}>
              {labels[i]}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-fg">{formatNumber(point.value, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
          <span className="w-24 shrink-0 truncate text-xs text-fg-3" title={labels[i]}>
            {labels[i]}
          </span>
          <span className="h-2.5 flex-1">
            {/* Anchored at the baseline (left), round only at the data end. */}
            <span
              className="block h-full rounded-r-sm"
              style={{ width: `${Math.max((point.value / max) * 100, 2)}%`, backgroundColor: colorOf(point, i) }}
              title={`${labels[i]}: ${formatNumber(point.value, locale)}`}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-2">
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
        <polygon points={area} style={{ fill: 'var(--chart-1)' }} fillOpacity={0.14} />
        <polyline points={line} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The middle figure is the series peak. It carries a label because a bare
          number sitting between two date labels reads as a third category. */}
      <div className="mt-1.5 flex justify-between text-2xs text-fg-3">
        <span>{first}</span>
        <span className="text-fg-2">{t('chartPeak', { value: formatNumber(max, locale) })}</span>
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
  // A 2-unit gap between slices (the surface showing through) keeps neighbours apart.
  const GAP = points.length > 1 ? 2 : 0;
  const arcs: { dash: number; offset: number; color: string; label: string }[] = [];
  let start = 0;
  for (const [i, point] of points.entries()) {
    const full = (point.value / total) * circumference;
    arcs.push({ dash: Math.max(full - GAP, 0.5), offset: start, color: colorOf(point, i), label: `${labels[i]}: ${formatNumber(point.value, locale)}` });
    start += full;
  }

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 110 110" className="h-24 w-24 shrink-0 -rotate-90" role="img">
        <circle cx={55} cy={55} r={R} fill="none" style={{ stroke: 'var(--color-hover)' }} strokeWidth={STROKE} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={55}
            cy={55}
            r={R}
            fill="none"
            style={{ stroke: arc.color }}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
          >
            <title>{arc.label}</title>
          </circle>
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {points.slice(0, 6).map((point, i) => (
          <li key={`${point.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(point, i) }} />
            <span className="min-w-0 flex-1 truncate text-fg-2" title={labels[i]}>
              {labels[i]}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-fg">{formatNumber(point.value, locale)}</span>
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
          <li key={row.id} className="border-b border-line last:border-b-0">
            <Link
              href={`/db/${row.databaseId}/${row.id}`}
              className="-mx-1.5 flex items-center gap-2 rounded-sm px-1.5 py-2 text-ui text-fg-2 transition-colors hover:bg-hover/60 hover:text-fg"
            >
              <PageIcon icon={row.icon} iconColor={row.iconColor} size={14} />
              <span className="min-w-0 flex-1 truncate">{row.title || t('untitled')}</span>
              {data.columns.map((col) => {
                const value = row.properties[col.id];
                if (value == null || value === '' || value === false) return null;
                // A ticked checkbox reads as its column's name ("Breaking"), not "true".
                if (value === true) {
                  return (
                    <span key={col.id} className="shrink-0 truncate text-2xs text-fg-3">{col.name}</span>
                  );
                }
                return (
                  <span key={col.id} className="shrink-0 truncate text-2xs text-fg-3" title={col.name}>
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                );
              })}
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="pt-2 text-xs text-fg-3">{t('andMore', { count: hidden })}</p>}
    </div>
  );
}

// -- text ---------------------------------------------------------------------

// Tone changes the leading icon, not the text colour: body copy stays readable in every
// tone, and "info" is marked the way the rest of the app marks attention (the signal).
const TONE_ICON = {
  default: null,
  info: <Info size={16} className="mt-px shrink-0 text-signal-text" aria-hidden />,
  warning: <TriangleAlert size={16} className="mt-px shrink-0 text-signal-text" aria-hidden />,
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
    if (token.startsWith('**')) nodes.push(<strong key={key} className="font-semibold text-fg">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) nodes.push(<code key={key} className="rounded-sm bg-hover px-1 py-0.5 font-mono text-2xs text-fg">{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const [, label, href] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token) ?? [];
      const safe = href && (href.startsWith('/') || href.startsWith('https://') || href.startsWith('http://'));
      nodes.push(
        safe ? (
          <Link key={key} href={href} className="text-fg underline decoration-signal decoration-[1.5px] underline-offset-[3px] hover:decoration-2">{label}</Link>
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
  const icon = TONE_ICON[data.block.tone];
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
        <p key={index} className="mb-1 mt-2 text-ui font-semibold text-fg first:mt-0">
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

  const body = <div className="min-w-0 flex-1 text-ui text-fg-2">{nodes}</div>;
  return icon ? (
    <div className="flex gap-2.5">
      {icon}
      {body}
    </div>
  ) : (
    body
  );
}

// -- links --------------------------------------------------------------------

export async function LinksBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'links' }> }) {
  const t = await getTranslations('Dashboard');
  return (
    <ul>
      {data.links.map((link) => (
        <li key={link.itemId} className="border-b border-line last:border-b-0">
          {link.href ? (
            <Link
              href={link.href}
              className="group -mx-1.5 flex items-center gap-2 rounded-sm px-1.5 py-2 text-ui text-fg-2 transition-colors hover:bg-hover/60 hover:text-fg"
            >
              <PageIcon
                icon={link.icon}
                iconColor={link.iconColor}
                size={14}
                fallbackType={link.type === 'database' ? 'database' : link.type === 'dashboard' ? 'dashboard' : 'page'}
              />
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              <ArrowRight size={14} className="shrink-0 text-fg-4 transition-colors group-hover:text-fg-2" />
            </Link>
          ) : (
            <span className="flex items-center gap-2 py-2 text-ui text-fg-4">
              <CircleAlert size={14} className="shrink-0 text-fg-4" aria-hidden />
              <span className="min-w-0 flex-1 truncate line-through">{link.label}</span>
              <span className="shrink-0 text-xs">{t('linkRemoved')}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// -- activity -----------------------------------------------------------------

function relativeTime(date: Date, locale: string): string {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

/**
 * Agent activity as sessions (V2 R8.3): each run of one agent's calls is a row — its
 * mark, its name, how many calls and writes, when it last acted — and opens to the calls
 * themselves (tool, what it touched, time). The newest session starts open; older ones
 * are native <details>, so this stays a server component.
 */
export async function ActivityBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'activity' }> }) {
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  if (!data.sessions.length) return <NoData />;

  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="-mt-1">
      {data.sessions.map((session, index) => (
        <details key={session.key} open={index === 0} className="group/session border-b border-line last:border-b-0">
          <summary className="-mx-1.5 flex cursor-pointer list-none items-center gap-2 rounded-sm px-1.5 py-2 text-ui transition-colors hover:bg-hover/60 [&::-webkit-details-marker]:hidden">
            <SessionMark session={session} />
            {/* Name and numbers share a row where there is room; on a phone the numbers drop under the name. */}
            <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate font-medium text-fg">{session.actor ?? t('unknownAgent')}</span>
                {/* Live: a steady signal dot, never a pulse (R8). */}
                {session.live && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />}
              </span>
              <span className="text-xs text-fg-3 sm:ml-auto sm:shrink-0">
                {t('sessionMeta', {
                  calls: session.callCount,
                  writes: session.writeCount,
                  more: session.countsCapped ? 'yes' : 'no',
                })}
                {', '}
                {relativeTime(session.lastAt, locale)}
              </span>
            </span>
            <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4 transition-transform group-open/session:rotate-90" />
          </summary>
          <ol className="mb-2 ml-1 space-y-0.5 border-l border-line pl-3">
            {session.calls.map((call) => {
              const write = WRITE_TOOL.test(call.tool);
              return (
                <li key={call.id} className="flex min-w-0 items-center gap-2 py-0.5 text-xs">
                  {/* Writes carry the accent: what an agent CHANGED is what a human scans for. */}
                  <span className={`shrink-0 font-mono text-2xs ${write ? 'font-semibold text-signal-text' : 'text-fg-3'}`}>{call.tool}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-2">{call.target ?? ''}</span>
                  {call.status === 'error' && (
                    <span className="shrink-0 text-2xs font-medium text-red-400">{t('callFailed')}</span>
                  )}
                  <time className="shrink-0 tabular-nums text-fg-4" dateTime={call.createdAt.toISOString()}>
                    {clock.format(call.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        </details>
      ))}
    </div>
  );
}

function SessionMark({ session }: { session: ActivitySession }) {
  const mark = markForId(session.agentName) ?? resolveAgentMark(session.agentName) ?? resolveAgentMark(session.actor);
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sheet shadow-[inset_0_0_0_1px_var(--color-line)]">
      {mark ? <MarkIcon mark={mark} size={12} /> : <Bot size={12} className="text-fg-3" aria-hidden />}
    </span>
  );
}

// -- project ------------------------------------------------------------------

/**
 * The head of a home dashboard, and the one loud thing on it: the workspace's name
 * set large, the agent's summary of the project under it, the stack as chips. The
 * last line is live — when an agent last called Remnus here — so the header says
 * whether this workspace is being worked in, not just what it is about.
 */
export async function ProjectBlockView({ data }: { data: Extract<ResolvedBlock, { kind: 'project' }> }) {
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  const { block, workspaceName, lastAgentAt, agentRecent: recent } = data;
  const when = lastAgentAt
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(lastAgentAt)
    : null;

  return (
    <div className="max-w-3xl">
      <p className="text-[28px] font-semibold leading-tight tracking-tight text-fg sm:text-[32px]">
        {block.title || workspaceName}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{block.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {block.stack?.map((chip) => (
          <span key={chip} className="inline-flex h-6 items-center rounded-full px-2.5 text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
            {chip}
          </span>
        ))}
        {/* Live: when an agent last worked here. A steady dot, never a pulse. */}
        <span className={`inline-flex items-center gap-2 text-xs text-fg-3 ${block.stack?.length ? 'ml-2' : ''}`}>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${recent ? 'bg-signal' : lastAgentAt ? 'bg-fg-4' : 'bg-line-strong'}`}
          />
          {when ? t('project.lastAgent', { when }) : t('project.noAgent')}
        </span>
      </div>
    </div>
  );
}
