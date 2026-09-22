'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
import { getMyAgentMetrics, type AgentMetrics } from '@/lib/actions/agentMetrics';

/**
 * The one number that says what Remnus is for: tokens an agent did not have to
 * spend. Every figure here is measured against a real alternative the server
 * could compute at call time — see `src/lib/services/agentMetrics.ts`. Each one
 * carries a tooltip stating its basis, because a savings number nobody can check
 * is a number nobody believes.
 *
 * Hidden entirely until there is something to show: a card reading zero makes the
 * product look smaller than it is.
 */
export default function AgentSavingsCard({
  workspaceId,
  onOpenDetail,
}: {
  /** Set in a project window — confines every figure to that one workspace. */
  workspaceId?: string;
  /** Omitted in a project window, where the agents modal isn't reachable. */
  onOpenDetail?: () => void;
}) {
  const t = useTranslations('Workspace');
  const format = useFormatter();
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);

  useEffect(() => {
    getMyAgentMetrics(workspaceId).then(setMetrics).catch(() => {});
  }, [workspaceId]);

  if (!metrics || metrics.savedBytes <= 0) return null;

  // The wire carries bytes; what the model pays for is tokens. ~4 bytes/token is
  // the same conversion the usage meters have always used.
  const tokens = Math.round(metrics.savedBytes / 4);
  const compact = format.number(tokens, { notation: 'compact', maximumFractionDigits: 1 });

  const stats = [
    metrics.recalledItems > 0 && {
      key: 'recalled',
      label: t('savingsRecalled', { count: metrics.recalledItems }),
      hint: t('savingsRecalledHint'),
    },
    metrics.agentWrites > 0 && {
      key: 'written',
      label: t('savingsWritten', { count: metrics.agentWrites }),
      hint: t('savingsWrittenHint'),
    },
    metrics.p50Ms != null && {
      key: 'speed',
      label: t('savingsSpeed', { ms: metrics.p50Ms }),
      hint: t('savingsSpeedHint'),
    },
  ].filter(Boolean) as { key: string; label: string; hint: string }[];

  const body = (
    <>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <Zap size={13} className="shrink-0 self-center text-neutral-500" />
        <span className="text-sm font-semibold text-neutral-100 tabular-nums">{compact}</span>
        <span className="text-[11px] text-neutral-500 truncate">{t('savingsLabel')}</span>
      </div>
      {stats.length > 0 && (
        <div className="flex items-center gap-1.5 pl-5 text-[10px] text-neutral-600">
          {stats.map((s, i) => (
            <span key={s.key} className="truncate" title={s.hint}>
              {i > 0 && <span className="mr-1.5 text-neutral-700">·</span>}
              {s.label}
            </span>
          ))}
        </div>
      )}
    </>
  );

  const hint = t('savingsHint', { calls: metrics.savedCalls });

  return (
    <div className="shrink-0 px-2 pb-1">
      {onOpenDetail ? (
        <button
          onClick={onOpenDetail}
          title={hint}
          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-neutral-800 transition-colors duration-200"
        >
          {body}
        </button>
      ) : (
        <div title={hint} className="px-2 py-1.5">{body}</div>
      )}
    </div>
  );
}
