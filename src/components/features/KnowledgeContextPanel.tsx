'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, Check, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPageKnowledge, markPageKnowledgeReviewed, updatePageKnowledge } from '@/lib/actions/knowledge';
import type { KnowledgeCorpusItem, KnowledgeStatus } from '@/lib/services/knowledge';

const EMPTY_FORM = { conceptType: '', description: '', tags: '', sources: '', status: 'draft' as KnowledgeStatus, staleAfter: '' };

export default function KnowledgeContextPanel({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
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
  }, [workspaceId, pageId, t]);

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
    } catch {
      setMessage(t('knowledgeReviewFailed'));
    } finally {
      setBusy(null);
    }
  }

  const trustLabel = knowledge ? t(`knowledgeTrust.${knowledge.metadata.trust}`) : t('knowledgeTrust.unverified');

  return (
    <div className="mt-10 border-t border-neutral-800 pt-6">
      <button type="button" onClick={() => setCollapsed(value => !value)} className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-300 cursor-pointer">
        <ChevronRight size={12} className={`transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        <BrainCircuit size={12} />
        {t('knowledgeTitle')}
        {knowledge && <span className="ml-1 text-[10px] text-neutral-600">{trustLabel}</span>}
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-4 border-l border-neutral-800 pl-4">
          <p className="text-xs leading-relaxed text-neutral-500">{t('knowledgeHint')}</p>
          {busy === 'load' ? <Loader2 size={14} className="animate-spin text-neutral-500" /> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] text-neutral-500">
                  <span>{t('knowledgeType')}</span>
                  <input value={form.conceptType} onChange={event => setForm(current => ({ ...current, conceptType: event.target.value }))} className="w-full border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500" />
                </label>
                <label className="space-y-1 text-[11px] text-neutral-500">
                  <span>{t('knowledgeStatus')}</span>
                  <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as KnowledgeStatus }))} className="w-full border-b border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500">
                    <option value="draft">{t('knowledgeStatusDraft')}</option>
                    <option value="stable">{t('knowledgeStatusStable')}</option>
                    <option value="deprecated">{t('knowledgeStatusDeprecated')}</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-[11px] text-neutral-500">
                <span>{t('knowledgeDescription')}</span>
                <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} rows={2} className="w-full resize-y border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] text-neutral-500">
                  <span>{t('knowledgeTags')}</span>
                  <input value={form.tags} onChange={event => setForm(current => ({ ...current, tags: event.target.value }))} placeholder={t('knowledgeTagsHint')} className="w-full border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500" />
                </label>
                <label className="space-y-1 text-[11px] text-neutral-500">
                  <span>{t('knowledgeStaleAfter')}</span>
                  <input type="date" value={form.staleAfter} onChange={event => setForm(current => ({ ...current, staleAfter: event.target.value }))} className="w-full border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500" />
                </label>
              </div>
              <label className="block space-y-1 text-[11px] text-neutral-500">
                <span>{t('knowledgeSources')}</span>
                <textarea value={form.sources} onChange={event => setForm(current => ({ ...current, sources: event.target.value }))} rows={2} placeholder={t('knowledgeSourcesHint')} className="w-full resize-y border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500" />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={save} disabled={!!busy} className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 cursor-pointer">
                  {busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t('knowledgeSave')}
                </button>
                <button type="button" onClick={review} disabled={!!busy} className="inline-flex items-center gap-1.5 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50 cursor-pointer">
                  {busy === 'review' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}{t('knowledgeReview')}
                </button>
                <span className="text-[10px] text-neutral-600">{message || trustLabel}</span>
              </div>
              <p className="text-[10px] leading-relaxed text-neutral-600">{t('knowledgeReviewHint')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
