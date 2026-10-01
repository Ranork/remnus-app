'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, Check, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPageKnowledge, markPageKnowledgeReviewed, updatePageKnowledge } from '@/lib/actions/knowledge';
import type { KnowledgeCorpusItem, KnowledgeStatus } from '@/lib/services/knowledge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import PageSection from './PageSection';

const EMPTY_FORM = { conceptType: '', description: '', tags: '', sources: '', status: 'draft' as KnowledgeStatus, staleAfter: '' };

const labelCls = 'flex flex-col gap-1.5 text-xs text-fg-3';

export default function KnowledgeContextPanel({
  workspaceId,
  pageId,
  refreshKey = 0,
  onReviewed,
}: {
  workspaceId: string;
  pageId: string;
  /** Bumped when the page was reviewed elsewhere (the provenance line) — reloads the panel. */
  refreshKey?: number;
  /** After a review here, so the provenance line under the title shows it too. */
  onReviewed?: () => void;
}) {
  const t = useTranslations('Page');
  const [collapsed, setCollapsed] = useState(true);
  const [knowledge, setKnowledge] = useState<KnowledgeCorpusItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<'load' | 'save' | 'review' | null>('load');
  const [message, setMessage] = useState('');

  function applyKnowledge(value: KnowledgeCorpusItem) {
    setKnowledge(value);
    setForm({
      conceptType: value.metadata.conceptType ?? '',
      description: value.metadata.description ?? '',
      tags: value.metadata.tags.join(', '),
      sources: value.metadata.sources.map(source => source.resource).join('\n'),
      status: value.metadata.status ?? 'draft',
      staleAfter: value.metadata.staleAfter?.slice(0, 10) ?? '',
    });
  }

  useEffect(() => {
    let cancelled = false;
    setBusy('load');
    getPageKnowledge(workspaceId, pageId)
      .then(value => { if (!cancelled) applyKnowledge(value); })
      .catch(() => { if (!cancelled) setMessage(t('knowledgeLoadFailed')); })
      .finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId, t, refreshKey]);

  async function save() {
    setBusy('save');
    setMessage('');
    try {
      const value = await updatePageKnowledge(workspaceId, pageId, {
        conceptType: form.conceptType,
        description: form.description,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        sources: form.sources.split('\n').map(resource => resource.trim()).filter(Boolean).map(resource => ({ resource })),
        status: form.status,
        staleAfter: form.staleAfter || null,
      });
      applyKnowledge(value);
      setMessage(t('knowledgeSaved'));
    } catch {
      setMessage(t('knowledgeSaveFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function review() {
    setBusy('review');
    setMessage('');
    try {
      applyKnowledge(await markPageKnowledgeReviewed(workspaceId, pageId));
      setMessage(t('knowledgeReviewed'));
      onReviewed?.();
    } catch {
      setMessage(t('knowledgeReviewFailed'));
    } finally {
      setBusy(null);
    }
  }

  const trustLabel = knowledge ? t(`knowledgeTrust.${knowledge.metadata.trust}`) : t('knowledgeTrust.unverified');

  return (
    <PageSection
      icon={<BrainCircuit />}
      title={t('knowledgeTitle')}
      meta={knowledge ? trustLabel : undefined}
      open={!collapsed}
      onToggle={() => setCollapsed(value => !value)}
    >
      <div className="mt-3 space-y-4">
        <p className="text-xs leading-relaxed text-fg-3">{t('knowledgeHint')}</p>
        {busy === 'load' ? <Loader2 size={14} className="animate-spin text-fg-4" aria-hidden /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                <span>{t('knowledgeType')}</span>
                <Input size="sm" value={form.conceptType} onChange={event => setForm(current => ({ ...current, conceptType: event.target.value }))} />
              </label>
              <label className={labelCls}>
                <span>{t('knowledgeStatus')}</span>
                <SimpleSelect
                  value={form.status}
                  onValueChange={value => setForm(current => ({ ...current, status: value as KnowledgeStatus }))}
                  options={[
                    { value: 'draft', label: t('knowledgeStatusDraft') },
                    { value: 'stable', label: t('knowledgeStatusStable') },
                    { value: 'deprecated', label: t('knowledgeStatusDeprecated') },
                  ]}
                  aria-label={t('knowledgeStatus')}
                  size="sm"
                  className="w-full"
                />
              </label>
            </div>
            <label className={labelCls}>
              <span>{t('knowledgeDescription')}</span>
              <Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} rows={2} className="min-h-16 text-xs" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                <span>{t('knowledgeTags')}</span>
                <Input size="sm" value={form.tags} onChange={event => setForm(current => ({ ...current, tags: event.target.value }))} placeholder={t('knowledgeTagsHint')} />
              </label>
              <label className={labelCls}>
                <span>{t('knowledgeStaleAfter')}</span>
                <Input size="sm" type="date" value={form.staleAfter} onChange={event => setForm(current => ({ ...current, staleAfter: event.target.value }))} className="scheme-dark" />
              </label>
            </div>
            <label className={labelCls}>
              <span>{t('knowledgeSources')}</span>
              <Textarea value={form.sources} onChange={event => setForm(current => ({ ...current, sources: event.target.value }))} rows={2} placeholder={t('knowledgeSourcesHint')} className="min-h-16 font-mono text-xs" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={save} loading={busy === 'save'} disabled={!!busy}>
                <Check />{t('knowledgeSave')}
              </Button>
              <Button variant="outline" size="sm" onClick={review} loading={busy === 'review'} disabled={!!busy}>
                <ShieldCheck />{t('knowledgeReview')}
              </Button>
              <span role="status" className="text-xs text-fg-3">{message || trustLabel}</span>
            </div>
            <p className="text-xs leading-relaxed text-fg-3">{t('knowledgeReviewHint')}</p>
          </>
        )}
      </div>
    </PageSection>
  );
}
