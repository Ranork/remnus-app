'use client';
import { useEffect, useState } from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { markPageKnowledgeReviewed } from '@/lib/actions/knowledge';
import { AGENT_RECENT_MS, type PageProvenance } from '@/lib/agentPresence';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { AgentDisc, agentLabel, formatAgo, useServerNow } from './AgentPresence';

/**
 * The provenance line under a page's title (V2 R8.8): which agent last edited it,
 * the newest human edit we know of, and whether a person has reviewed this exact
 * text. Separate items, newest first — no "A · B" joins. Only a page an agent has
 * written gets the line (`services/pageProvenance.ts` returns null otherwise).
 *
 * "Review" records a knowledge review of the current title + body — the same action
 * as the knowledge panel's "Review this revision"; any later edit clears it on the
 * next read.
 */
export default function PageProvenanceLine({
  provenance,
  workspaceId,
  itemId,
  reviewSignal = 0,
  onReviewed,
  className,
}: {
  provenance: PageProvenance;
  workspaceId: string;
  /** Workspace item id (standalone page) or row id — what the review is recorded for. */
  itemId: string;
  /** Bumped by the page whenever a review was recorded (here or in the knowledge panel). */
  reviewSignal?: number;
  /** After a review here, so the knowledge panel can show it too. */
  onReviewed?: () => void;
  className?: string;
}) {
  const t = useTranslations('Page');
  const tWs = useTranslations('Workspace');
  const locale = useLocale();
  const now = useServerNow(provenance.at);
  const [reviewed, setReviewed] = useState(provenance.reviewed);
  const [busy, setBusy] = useState(false);

  // Each read brings the server's verdict: a new edit clears a review.
  useEffect(() => {
    setReviewed(provenance.reviewed);
  }, [provenance]);
  // A review recorded in the knowledge panel lands here without a reload.
  useEffect(() => {
    if (reviewSignal > 0) setReviewed((current) => current ?? { at: Date.now(), you: true });
  }, [reviewSignal]);

  const fullTime = (at: number) => new Date(at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const { agent, human } = provenance;
  const live = now - agent.at < AGENT_RECENT_MS;

  const entries = [
    {
      key: 'agent',
      at: agent.at,
      node: (
        <Tooltip content={fullTime(agent.at)}>
          <span className={cn('inline-flex min-w-0 items-center gap-1.5', live ? 'font-medium text-signal-text' : 'text-fg-2')}>
            <AgentDisc agent={agent} live={live} size={18} />
            <span className="truncate">
              {t('provenanceAgent', { agent: agentLabel(agent, tWs('presenceUnknownAgent')), time: formatAgo(now - agent.at, locale) })}
            </span>
          </span>
        </Tooltip>
      ),
    },
    ...(human
      ? [{
          key: 'human',
          at: human.at,
          node: (
            <Tooltip content={fullTime(human.at)}>
              <span className="truncate">
                {human.you
                  ? t('provenanceYou', { time: formatAgo(now - human.at, locale) })
                  : t('provenanceMember', { name: human.name, time: formatAgo(now - human.at, locale) })}
              </span>
            </Tooltip>
          ),
        }]
      : []),
  ].sort((a, b) => b.at - a.at);

  async function review() {
    setBusy(true);
    try {
      const item = await markPageKnowledgeReviewed(workspaceId, itemId);
      if (item.metadata.trust === 'human-reviewed') {
        setReviewed({ at: item.metadata.reviewedAt ? Date.parse(item.metadata.reviewedAt) : Date.now(), you: true });
        onReviewed?.();
      }
    } catch {
      toast({ title: t('provenanceReviewFailed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-3', className)}>
      {entries.map((entry) => (
        <span key={entry.key} className="flex min-w-0 max-w-full">{entry.node}</span>
      ))}
      <span className="flex items-center gap-2 sm:ml-auto">
        {reviewed ? (
          <Tooltip content={fullTime(reviewed.at)}>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} aria-hidden />
              {reviewed.you ? t('provenanceReviewedYou') : t('provenanceReviewed')}
            </span>
          </Tooltip>
        ) : (
          <>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-signal-soft px-2 font-medium text-signal-text">
              <Shield size={13} aria-hidden />
              {t('provenanceUnreviewed')}
            </span>
            <Tooltip content={t('provenanceReviewHint')}>
              <Button variant="outline" size="xs" loading={busy} onClick={review}>
                {t('provenanceReview')}
              </Button>
            </Tooltip>
          </>
        )}
      </span>
    </div>
  );
}
