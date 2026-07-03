'use client';

// Newsletter composer + campaign history. Drafts are saved via server actions;
// the send-to-all loop goes through POST /api/admin/mailing/send-campaign
// (long maxDuration). Send is two-step confirmed and shows the audience size.

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Eye, EyeOff, Save, FlaskConical, Send, Trash2, Pencil, Loader2 } from 'lucide-react';
import {
  deleteCampaign,
  previewCampaignHtml,
  saveCampaign,
  sendTestCampaign,
  type CampaignSummary,
} from '@/lib/actions/mailing';

type Busy = 'save' | 'test' | 'send' | 'preview' | null;

const inputCls =
  'w-full rounded-lg border border-neutral-800 bg-neutral-850 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-600';

export default function CampaignManager({
  campaigns,
  audience,
  onChanged,
}: {
  campaigns: CampaignSummary[];
  audience: number;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations('Mailing');
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const startNew = () => {
    setEditingId(null);
    setSubject('');
    setPreheader('');
    setBodyMd('');
    setPreviewHtml(null);
    setConfirmSend(false);
    setNotice(null);
    setOpen(true);
  };

  const startEdit = (c: CampaignSummary) => {
    setEditingId(c.id);
    setSubject(c.subject);
    setPreheader(c.preheader ?? '');
    setBodyMd(c.bodyMd);
    setPreviewHtml(null);
    setConfirmSend(false);
    setNotice(null);
    setOpen(true);
  };

  const canAct = subject.trim().length > 0 && bodyMd.trim().length > 0 && busy === null;

  const doSave = async (): Promise<string | null> => {
    setBusy('save');
    setNotice(null);
    try {
      const saved = await saveCampaign({ id: editingId, subject, preheader, bodyMd });
      setEditingId(saved.id);
      await onChanged();
      return saved.id;
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const doPreview = async () => {
    if (previewHtml !== null) {
      setPreviewHtml(null);
      return;
    }
    setBusy('preview');
    try {
      setPreviewHtml(await previewCampaignHtml({ subject, preheader, bodyMd }));
    } catch {
      setNotice({ ok: false, text: t('error') });
    } finally {
      setBusy(null);
    }
  };

  const doTest = async () => {
    setBusy('test');
    setNotice(null);
    try {
      const res = await sendTestCampaign({ subject, preheader, bodyMd });
      setNotice(res.ok ? { ok: true, text: t('sendTestDone') } : { ok: false, text: res.error ?? t('error') });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
    } finally {
      setBusy(null);
    }
  };

  const doSendAll = async () => {
    setBusy('send');
    setNotice(null);
    try {
      const id = await doSaveInline();
      if (!id) return;
      const res = await fetch('/api/admin/mailing/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? t('error') });
        return;
      }
      setNotice({ ok: true, text: t('sendResult', { sent: data.sent, total: data.recipientCount }) });
      setOpen(false);
      await onChanged();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
    } finally {
      setBusy(null);
      setConfirmSend(false);
    }
  };

  // Save without toggling the shared busy flag (doSendAll owns it).
  const doSaveInline = async (): Promise<string | null> => {
    try {
      const saved = await saveCampaign({ id: editingId, subject, preheader, bodyMd });
      setEditingId(saved.id);
      return saved.id;
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
      return null;
    }
  };

  const doDelete = async (id: string) => {
    try {
      await deleteCampaign(id);
      if (editingId === id) setOpen(false);
      await onChanged();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
    }
  };

  const statusChip = (c: CampaignSummary) => {
    if (c.status === 'draft')
      return <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">{t('statusDraft')}</span>;
    if (c.status === 'sending')
      return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">{t('statusSending')}</span>;
    return <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">{t('statusSent')}</span>;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Composer */}
      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">{t('subjectLabel')}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('subjectPlaceholder')} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">{t('preheaderLabel')}</label>
              <input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder={t('preheaderPlaceholder')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">{t('bodyLabel')}</label>
            <textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder={t('bodyPlaceholder')}
              rows={12}
              className={`${inputCls} resize-y font-mono text-[13px] leading-relaxed`}
            />
          </div>

          {previewHtml !== null && (
            <iframe
              srcDoc={previewHtml}
              sandbox=""
              title={t('preview')}
              className="h-[480px] w-full rounded-lg border border-neutral-800 bg-neutral-950"
            />
          )}

          {notice && (
            <p className={`text-xs ${notice.ok ? 'text-green-400' : 'text-red-400'}`}>{notice.text}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={doSave} disabled={!canAct} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">
              {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {t('saveDraft')}
            </button>
            <button onClick={doPreview} disabled={!canAct} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">
              {busy === 'preview' ? <Loader2 size={13} className="animate-spin" /> : previewHtml !== null ? <EyeOff size={13} /> : <Eye size={13} />}
              {previewHtml !== null ? t('hidePreview') : t('preview')}
            </button>
            <button onClick={doTest} disabled={!canAct} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">
              {busy === 'test' ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} {t('sendTest')}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {confirmSend ? (
                <>
                  <span className="text-xs text-neutral-400">{t('sendAllConfirm', { count: audience })}</span>
                  <button onClick={doSendAll} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg bg-red-400/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-40">
                    {busy === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    {busy === 'send' ? t('sendingProgress') : t('sendAllGo')}
                  </button>
                  <button onClick={() => setConfirmSend(false)} disabled={busy === 'send'} className="rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
                    {t('cancel')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmSend(true)} disabled={!canAct} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500/85 disabled:opacity-40">
                    <Send size={13} /> {t('sendAll')}
                  </button>
                  <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
                    {t('cancel')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button onClick={startNew} className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500/85">
          <Plus size={14} /> {t('newCampaign')}
        </button>
      )}

      {/* History */}
      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-8 text-center text-xs text-neutral-500">
          {t('noCampaigns')}
        </div>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-neutral-850 px-4 py-3 last:border-0 hover:bg-neutral-800/10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-neutral-200">{c.subject}</span>
                  {statusChip(c)}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  {c.status === 'sent'
                    ? `${fmt.format(new Date(c.sentAt ?? c.createdAt))} · ${t('sentMeta', { sent: c.sentCount, failed: c.failedCount, count: c.recipientCount })}`
                    : fmt.format(new Date(c.createdAt))}
                </div>
              </div>
              {c.status === 'draft' && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => startEdit(c)} title={t('editCampaign')} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => doDelete(c.id)} title={t('deleteCampaign')} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
