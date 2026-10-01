'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
import { getMyAgentMetrics, type AgentMetrics } from '@/lib/actions/agentMetrics';

/**
 * The one number that says what Remnus is for: tokens an agent did not have to
 * spend. Every figure here is measured against a real alternative the server
 * could compute at call time — see `src/lib/services/agentMetrics.ts`. Each one
 * carries its basis as text (or, in the tight sidebar, as a tooltip), because a
 * savings number nobody can check is a number nobody believes.
 *
 * One component, three surfaces:
 *  - `sidebar`   the figure at the top of the sidebar's agents card (one button with the
 *                AI Agents row). Hidden until something is measured — a card reading zero
 *                makes the product look smaller than it is.
 *  - `modal`     hero at the top of the AI Agents modal. Shown for anyone who has an
 *                agent connected, with an honest "after the first session" note until
 *                there is a number.
 *  - `dashboard` the same hero as a dashboard block (R6 mounts it there).
 *
 * The number is written out ("98,1 bin", "98.1 thousand", "9.8万") rather than the
 * "98.1K"/"98,1 B" shorthand: in Turkish "B" reads as billion-or-bytes, not "bin".
 */
export type AgentSavingsCardVariant = 'sidebar' | 'modal' | 'dashboard';

export default function AgentSavingsCard({
  variant = 'sidebar',
  workspaceId,
  onOpenDetail,
  metrics: provided,
}: {
  variant?: AgentSavingsCardVariant;
  /** Set in a project window — confines every figure to that one workspace. */
  workspaceId?: string;
  /** Sidebar only: click-through to the agents modal. Omitted in a project window. */
  onOpenDetail?: () => void;
  /** The caller already fetched them (the agents modal does); skips the second request. */
  metrics?: AgentMetrics | null;
}) {
  const t = useTranslations('Workspace');
  const format = useFormatter();
  const [fetched, setFetched] = useState<AgentMetrics | null>(null);

  useEffect(() => {
    if (provided !== undefined) return;
    getMyAgentMetrics(workspaceId).then(setFetched).catch(() => {});
  }, [workspaceId, provided]);

  const metrics = provided !== undefined ? provided : fetched;
  const hasNumber = !!metrics && metrics.savedBytes > 0;

  if (!hasNumber) {
    if (variant === 'sidebar' || (provided === undefined && !metrics)) return null;
    return (
      <div className={variant === 'modal' ? heroClass : dashboardClass}>
        <Caption>{t('savingsDetailTitle')}</Caption>
        <p className="mt-2 text-ui leading-relaxed text-fg-3">{t('savingsEmpty')}</p>
      </div>
    );
  }

  // The wire carries bytes; what the model pays for is tokens. ~4 bytes/token is
  // the same conversion the usage meters have always used.
  const tokens = Math.round(metrics.savedBytes / 4);
  const value = format.number(tokens, { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 1 });
  const hint = t('savingsHint', { calls: metrics.savedCalls });

  const stats = [
    metrics.recalledItems > 0 && {
      key: 'recalled',
      value: format.number(metrics.recalledItems),
      label: t('savingsRecalledLabel'),
      short: t('savingsRecalled', { count: metrics.recalledItems }),
      hint: t('savingsRecalledHint'),
    },
    metrics.agentWrites > 0 && {
      key: 'written',
      value: format.number(metrics.agentWrites),
      label: t('savingsWrittenLabel'),
      short: t('savingsWritten', { count: metrics.agentWrites }),
      hint: t('savingsWrittenHint'),
    },
    metrics.p50Ms != null && {
      key: 'speed',
      value: t('savingsSpeed', { ms: metrics.p50Ms }),
      label: t('savingsSpeedLabel'),
      short: t('savingsSpeed', { ms: metrics.p50Ms }),
      hint: t('savingsSpeedHint'),
    },
  ].filter(Boolean) as { key: string; value: string; label: string; short: string; hint: string }[];

  if (variant === 'sidebar') {
    // The sidebar's one warm spot (Hakan: this number is what the product is for, it
    // must not read as a footnote). It carries the signal colour as a FILL — a lit
    // panel and a solid disc — never as small yellow text on the desk, and nothing
    // moves: the figure only changes when agents save more.
    const body = (
      <>
        <span className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-signal-fg">
            <Zap size={16} fill="currentColor" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl leading-tight font-semibold tracking-tight text-fg">{value}</span>
            <span className="block truncate text-xs font-medium text-signal-text">{t('savingsLabel')}</span>
          </span>
        </span>
        {stats.length > 0 && (
          <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-12 text-xs text-fg-3">
            {stats.map((s) => (
              <span key={s.key} className="whitespace-nowrap" title={s.hint}>
                {s.short}
              </span>
            ))}
          </span>
        )}
      </>
    );
    const panel = 'block w-full rounded-control bg-signal-soft px-3 py-3 text-left';
    // Without its own click target it is a span, so the sidebar can put it inside the
    // one button that makes up the agents card (a div inside a button is invalid).
    return onOpenDetail ? (
      <button onClick={onOpenDetail} title={hint} className={`${panel} cursor-pointer`}>
        {body}
      </button>
    ) : (
      <span title={hint} className={panel}>{body}</span>
    );
  }

  return (
    <div className={variant === 'modal' ? heroClass : dashboardClass}>
      <Caption>{t('savingsDetailTitle')}</Caption>
      <div className="mt-3 flex items-end gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-surface bg-signal-soft text-signal-text">
          <Zap size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-3xl leading-none font-semibold tracking-tight text-fg">{value}</span>
          <span className="mt-1 block text-ui text-fg-2">{t('savingsLabel')}</span>
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-3">{hint}</p>

      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
          {stats.map((s) => (
            <div key={s.key} title={s.hint} className="rounded-control bg-hover/50 px-3 py-2">
              <div className="text-sm font-semibold text-fg">{s.value}</div>
              <div className="text-xs text-fg-3">{s.label}</div>
              <p className="mt-1 text-2xs leading-snug text-fg-4">{s.hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const heroClass = 'rounded-surface bg-raised p-5 shadow-[inset_0_0_0_1px_var(--color-line)]';
// Same surface as a dashboard tile (DashboardView).
const dashboardClass = 'h-full rounded-surface bg-raised p-5 shadow-sheet lg:bg-sheet';

/** The block's label — sentence case like every other card title (no uppercase eyebrow). */
function Caption({ children }: { children: React.ReactNode }) {
  return <span className="text-ui font-medium text-fg-3">{children}</span>;
}
