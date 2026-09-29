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
 *  - `sidebar`   compact card under the tree. Hidden until something is measured — a
 *                card reading zero makes the product look smaller than it is.
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
        <Eyebrow>{t('savingsDetailTitle')}</Eyebrow>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">{t('savingsEmpty')}</p>
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
    const body = (
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
          <Zap size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg leading-tight font-semibold text-neutral-50 tabular-nums">{value}</span>
          <span className="block truncate text-[11px] text-neutral-400">{t('savingsLabel')}</span>
          {stats.length > 0 && (
            <span className="mt-1.5 flex items-center gap-1.5 truncate text-[10px] text-neutral-500">
              {stats.map((s, i) => (
                <span key={s.key} className="truncate" title={s.hint}>
                  {i > 0 && <span className="mr-1.5 text-neutral-700">·</span>}
                  {s.short}
                </span>
              ))}
            </span>
          )}
        </span>
      </div>
    );
    return (
      <div className="shrink-0 px-2 pb-1">
        {onOpenDetail ? (
          <button
            onClick={onOpenDetail}
            title={hint}
            className="w-full cursor-pointer rounded-lg bg-neutral-850 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-neutral-800"
          >
            {body}
          </button>
        ) : (
          <div title={hint} className="rounded-lg bg-neutral-850 px-3 py-2.5">{body}</div>
        )}
      </div>
    );
  }

  return (
    <div className={variant === 'modal' ? heroClass : dashboardClass}>
      <Eyebrow>{t('savingsDetailTitle')}</Eyebrow>
      <div className="mt-2 flex items-end gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <Zap size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-3xl leading-none font-semibold text-neutral-50 tabular-nums">{value}</span>
          <span className="mt-1 block text-xs text-neutral-300">{t('savingsLabel')}</span>
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">{hint}</p>

      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
          {stats.map((s) => (
            <div key={s.key} title={s.hint} className="rounded-md bg-neutral-900/60 px-3 py-2">
              <div className="text-sm font-semibold text-neutral-100 tabular-nums">{s.value}</div>
              <div className="text-[11px] text-neutral-400">{s.label}</div>
              <p className="mt-1 text-[10px] leading-snug text-neutral-600">{s.hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const heroClass = 'rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-neutral-900/40 to-transparent p-5';
const dashboardClass = 'rounded-lg bg-neutral-900/40 p-5';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">{children}</span>;
}
