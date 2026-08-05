'use client';

// Invite composer: fetch an app's public info from Scout Forge by idstr,
// edit it, pick a gift tier/duration, save → get a shareable /welcome/<token>
// link. Mirrors CampaignManager.tsx's open/closed composer shape.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Download, Copy, Check, Loader2 } from 'lucide-react';
import { createProspectInvite, lookupScoutForgeApp } from '@/lib/actions/prospectInvites';

type Busy = 'fetch' | 'save' | null;

const inputCls =
  'w-full rounded-lg border border-neutral-800 bg-neutral-850 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-600';
const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500';

export default function InviteManager({ onChanged }: { onChanged: () => Promise<void> }) {
  const t = useTranslations('ProspectInvites');
  const tBilling = useTranslations('Billing');

  const [open, setOpen] = useState(false);
  const [idstr, setIdstr] = useState('');
  const [appName, setAppName] = useState('');
  const [appLogoUrl, setAppLogoUrl] = useState('');
  const [appTagline, setAppTagline] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [giftTier, setGiftTier] = useState<'startup' | 'professional'>('startup');
  const [giftDays, setGiftDays] = useState(30);
  const [linkExpiresInDays, setLinkExpiresInDays] = useState<number | ''>(30);

  const [busy, setBusy] = useState<Busy>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setIdstr('');
    setAppName('');
    setAppLogoUrl('');
    setAppTagline('');
    setAppUrl('');
    setGiftTier('startup');
    setGiftDays(30);
    setLinkExpiresInDays(30);
    setFetchError(null);
    setNotice(null);
    setGeneratedLink(null);
    setCopied(false);
  };

  const startNew = () => {
    reset();
    setOpen(true);
  };

  const canFetch = idstr.trim().length > 0 && busy === null;
  const canSave = idstr.trim().length > 0 && appName.trim().length > 0 && giftDays > 0 && busy === null;

  const doFetch = async () => {
    setBusy('fetch');
    setFetchError(null);
    try {
      const res = await lookupScoutForgeApp(idstr.trim());
      if (res.ok) {
        setAppName(res.app.name);
        setAppLogoUrl(res.app.logoUrl ?? '');
        setAppTagline(res.app.shortDescription ?? '');
        setAppUrl(res.app.url ?? '');
      } else {
        setFetchError(res.error);
      }
    } catch {
      setFetchError(t('fetchErrorGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const doSave = async () => {
    setBusy('save');
    setNotice(null);
    try {
      const created = await createProspectInvite({
        appIdstr: idstr.trim(),
        appName: appName.trim(),
        appLogoUrl: appLogoUrl.trim() || null,
        appTagline: appTagline.trim() || null,
        appUrl: appUrl.trim() || null,
        giftTier,
        giftDays,
        linkExpiresInDays: linkExpiresInDays === '' ? null : linkExpiresInDays,
      });
      setGeneratedLink(created.inviteLink);
      await onChanged();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('error') });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!open) {
    return (
      <button onClick={startNew} className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500/85">
        <Plus size={14} /> {t('newInvite')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <div>
        <label className={labelCls}>{t('idstrLabel')}</label>
        <div className="flex gap-2">
          <input value={idstr} onChange={(e) => setIdstr(e.target.value)} placeholder={t('idstrPlaceholder')} className={inputCls} />
          <button
            onClick={doFetch}
            disabled={!canFetch}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            {busy === 'fetch' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {t('fetchButton')}
          </button>
        </div>
        {fetchError && <p className="mt-1.5 text-xs text-red-400">{fetchError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('appNameLabel')}</label>
          <input value={appName} onChange={(e) => setAppName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t('appLogoUrlLabel')}</label>
          <input value={appLogoUrl} onChange={(e) => setAppLogoUrl(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('appTaglineLabel')}</label>
        <input value={appTagline} onChange={(e) => setAppTagline(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>{t('appUrlLabel')}</label>
        <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>{t('giftTierLabel')}</label>
          <select value={giftTier} onChange={(e) => setGiftTier(e.target.value as 'startup' | 'professional')} className={inputCls}>
            <option value="startup">{tBilling('tier_startup')}</option>
            <option value="professional">{tBilling('tier_professional')}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('giftDaysLabel')}</label>
          <input
            type="number"
            min={1}
            value={giftDays}
            onChange={(e) => setGiftDays(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('linkExpiryDaysLabel')}</label>
          <input
            type="number"
            min={1}
            value={linkExpiresInDays}
            onChange={(e) => setLinkExpiresInDays(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={t('linkExpiryNeverPlaceholder')}
            className={inputCls}
          />
        </div>
      </div>

      {generatedLink && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-green-300">{generatedLink}</span>
          <button onClick={copyLink} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] text-green-300 hover:bg-green-500/15">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('linkCopied') : t('copyLink')}
          </button>
        </div>
      )}

      {notice && <p className={`text-xs ${notice.ok ? 'text-green-400' : 'text-red-400'}`}>{notice.text}</p>}

      <div className="flex items-center gap-2">
        <button onClick={doSave} disabled={!canSave} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500/85 disabled:opacity-40">
          {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {t('save')}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
