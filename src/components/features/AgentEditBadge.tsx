'use client';
import { useState } from 'react';
import { Bot } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { MarkIcon, markForId, resolveAgentMark, AGENT_MARKS, type AgentMarkName } from '@/components/features/agents/AgentMark';
import { AGENT_RECENT_MS } from '@/lib/agentPresence';

// Same resolution order as AgentMark/AgentsModal: explicit canonical id →
// inferred from the stored agent_name → inferred from the token/client name.
export function resolveAgent(agentName: string | null, tokenName: string | null): { mark: AgentMarkName; label: string } | null {
  const mark = markForId(agentName) ?? resolveAgentMark(agentName) ?? resolveAgentMark(tokenName);
  if (!mark) return null;
  return { mark, label: AGENT_MARKS.find(a => a.mark === mark)?.label ?? mark };
}

/**
 * "An agent last edited this row": the agent's own mark on a small neutral disc, with
 * who/when in a tooltip. One look everywhere (table title cell, kanban and calendar
 * cards, the row page). The yellow signal dot appears only while the edit is recent
 * (the last 10 minutes) — an old edit is a fact, not activity.
 */
export default function AgentEditBadge({
  agentName,
  tokenName,
  editedAt,
  className = '',
}: {
  agentName: string | null;
  tokenName?: string | null;
  editedAt: Date | string | null;
  className?: string;
}) {
  const t = useTranslations('Database');
  const locale = useLocale();
  // Read once per mount: "recent" only needs to be true when the row is loaded.
  const [now] = useState(() => Date.now());

  if (!editedAt) return null;

  const date = editedAt instanceof Date ? editedAt : new Date(editedAt);
  const timeStr = date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const isRecent = now - date.getTime() < AGENT_RECENT_MS;

  const agent = resolveAgent(agentName, tokenName ?? null);
  const who = agent?.label ?? agentName ?? t('agentEditedLabel');
  const label = t('agentEditedTooltip', {
    agent: tokenName && tokenName !== who ? `${who} (${tokenName})` : who,
    time: timeStr,
  });

  return (
    <Tooltip content={label}>
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        className={cn(
          'relative inline-flex size-5 shrink-0 cursor-default select-none items-center justify-center rounded-full bg-sheet shadow-[inset_0_0_0_1px_var(--color-line)]',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {agent ? <MarkIcon mark={agent.mark} size={12} /> : <Bot size={12} className="text-fg-3" aria-hidden />}
        {isRecent && (
          <span aria-hidden className="absolute -top-px -right-px size-1.5 rounded-full bg-signal ring-2 ring-sheet" />
        )}
      </span>
    </Tooltip>
  );
}
