'use client';

// Invite status/history table: copy link, refresh-from-Scout-Forge, inline
// edit, delete and revoke. Refresh/Edit are pending-only; Delete covers
// pending/link_expired/reverted (nothing live to lose); Revoke is the only
// action for an `active` (claimed, not yet reverted) invite — it claws back
// the granted plan (never a real paid subscription, see prospectInvites.ts)
// and THEN deletes, so the row can never be removed without the plan being
// reverted first. Both destructive actions require an inline confirm step.
// Mirrors EmailLogTable.tsx's table shape.

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, Check, RefreshCw, Pencil, Trash2, Undo2, Loader2, Save, X } from 'lucide-react';
import {
  deleteProspectInvite,
  refreshFromScoutForge,
  revokeClaimedInvite,
  updateProspectInvite,
  type ProspectInviteSummary,
} from '@/lib/actions/prospectInvites';

const STATUS_STYLE: Record<ProspectInviteSummary['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-500',
  active: 'bg-green-500/10 text-green-400',
  reverted: 'bg-neutral-800 text-neutral-400',
  link_expired: 'bg-red-500/10 text-red-400',
};

const STATUS_LABEL_KEYS: Record<ProspectInviteSummary['status'], string> = {
  pending: 'statusPending',
  active: 'statusActive',
  reverted: 'statusReverted',
  link_expired: 'statusLinkExpired',
};

const inputCls = 'w-full rounded-md border border-neutral-800 bg-neutral-850 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-neutral-600';

interface EditState {
  appName: string;
  appLogoUrl: string;
  appTagline: string;
  appUrl: string;
  giftTier: 'startup' | 'professional';
  giftDays: number;
}

type ConfirmAction = 'delete' | 'revoke';

export default function InviteStatusTable({
  invites,
  onChanged,
}: {
  invites: ProspectInviteSummary[];
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations('ProspectInvites');
  const tBilling = useTranslations('Billing');
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: ConfirmAction } | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);

  const copyLink = async (invite: ProspectInviteSummary) => {
    await navigator.clipboard.writeText(invite.inviteLink);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const startEdit = (invite: ProspectInviteSummary) => {
    setConfirm(null);
    setEditingId(invite.id);
    setRowError(null);
    setEdit({
      appName: invite.appName,
      appLogoUrl: invite.appLogoUrl ?? '',
      appTagline: invite.appTagline ?? '',
      appUrl: invite.appUrl ?? '',
      giftTier: invite.giftTier,
      giftDays: invite.giftDays,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = async (id: string) => {
    if (!edit) return;
    setBusyId(id);
    setRowError(null);
    try {
      await updateProspectInvite(id, {
        appName: edit.appName,
        appLogoUrl: edit.appLogoUrl || null,
        appTagline: edit.appTagline || null,
        appUrl: edit.appUrl || null,
        giftTier: edit.giftTier,
        giftDays: edit.giftDays,
      });
      cancelEdit();
      await onChanged();
    } catch (e) {
      setRowError({ id, text: e instanceof Error ? e.message : t('error') });
    } finally {
      setBusyId(null);
    }
  };

  const doRefresh = async (id: string) => {
    setBusyId(id);
    setRowError(null);
    try {
      const res = await refreshFromScoutForge(id);
      if (!res.ok) { setRowError({ id, text: res.error }); return; }
      await onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const askConfirm = (invite: ProspectInviteSummary, action: ConfirmAction) => {
    cancelEdit();
    setRowError(null);
    setConfirm({ id: invite.id, action });
  };

  const runConfirmed = async (invite: ProspectInviteSummary) => {
    if (!confirm || confirm.id !== invite.id) return;
    setBusyId(invite.id);
    setRowError(null);
    try {
      if (confirm.action === 'delete') {
        await deleteProspectInvite(invite.id);
      } else {
        const res = await revokeClaimedInvite(invite.id);
        if (!res.ok) { setRowError({ id: invite.id, text: res.error }); return; }
      }
      setConfirm(null);
      await onChanged();
    } catch (e) {
      setRowError({ id: invite.id, text: e instanceof Error ? e.message : t('error') });
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-8 text-center text-xs text-neutral-500">
        {t('noInvites')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead>
          <tr className="border-b border-neutral-800 text-[10.5px] uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-2.5 font-medium">{t('colApp')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colOpened')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colGift')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colCreated')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colClaimedBy')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => {
            const isEditing = editingId === invite.id;
            const isConfirming = confirm?.id === invite.id;
            return (
              <Fragment key={invite.id}>
                <tr className="border-b border-neutral-850 last:border-0 hover:bg-neutral-800/10">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {invite.appLogoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={invite.appLogoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                      )}
                      <span className="max-w-[180px] truncate text-neutral-200" title={invite.appName}>{invite.appName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[invite.status]}`}>
                      {t(STATUS_LABEL_KEYS[invite.status])}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-400">
                    {invite.openCount > 0 ? t('openedCount', { count: invite.openCount }) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">
                    {t('giftCell', { days: invite.giftDays, tier: invite.giftTier === 'professional' ? tBilling('tier_professional') : tBilling('tier_startup') })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-500">{fmt.format(new Date(invite.createdAt))}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{invite.claimedByEmail ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => copyLink(invite)} title={t('copyLink')} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
                        {copiedId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      {invite.status === 'pending' && (
                        <>
                          <button
                            onClick={() => doRefresh(invite.id)}
                            disabled={busyId === invite.id}
                            title={t('refreshFromScoutForge')}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40"
                          >
                            {busyId === invite.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                          <button
                            onClick={() => (isEditing ? cancelEdit() : startEdit(invite))}
                            title={t('edit')}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                          >
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                      {invite.status === 'active' && (
                        <button
                          onClick={() => (isConfirming ? setConfirm(null) : askConfirm(invite, 'revoke'))}
                          title={t('revoke')}
                          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-amber-400"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                      {(invite.status === 'pending' || invite.status === 'link_expired' || invite.status === 'reverted') && (
                        <button
                          onClick={() => (isConfirming ? setConfirm(null) : askConfirm(invite, 'delete'))}
                          title={t('delete')}
                          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {isEditing && edit && (
                  <tr className="border-b border-neutral-850 bg-neutral-850/40 last:border-0">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input value={edit.appName} onChange={(e) => setEdit({ ...edit, appName: e.target.value })} placeholder={t('appNameLabel')} className={inputCls} />
                        <input value={edit.appLogoUrl} onChange={(e) => setEdit({ ...edit, appLogoUrl: e.target.value })} placeholder={t('appLogoUrlLabel')} className={inputCls} />
                        <input value={edit.appTagline} onChange={(e) => setEdit({ ...edit, appTagline: e.target.value })} placeholder={t('appTaglineLabel')} className={inputCls} />
                        <input value={edit.appUrl} onChange={(e) => setEdit({ ...edit, appUrl: e.target.value })} placeholder={t('appUrlLabel')} className={inputCls} />
                        <select value={edit.giftTier} onChange={(e) => setEdit({ ...edit, giftTier: e.target.value as 'startup' | 'professional' })} className={inputCls}>
                          <option value="startup">{tBilling('tier_startup')}</option>
                          <option value="professional">{tBilling('tier_professional')}</option>
                        </select>
                        <input type="number" min={1} value={edit.giftDays} onChange={(e) => setEdit({ ...edit, giftDays: Number(e.target.value) })} className={inputCls} />
                      </div>
                      {rowError?.id === invite.id && <p className="mt-2 text-xs text-red-400">{rowError.text}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(invite.id)}
                          disabled={busyId === invite.id}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500/85 disabled:opacity-40"
                        >
                          {busyId === invite.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {t('save')}
                        </button>
                        <button onClick={cancelEdit} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
                          <X size={13} /> {t('cancel')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {isConfirming && (
                  <tr className="border-b border-neutral-850 bg-red-500/5 last:border-0">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-red-300">
                          {confirm.action === 'revoke' ? t('confirmRevokeText') : t('confirmDeleteText')}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => runConfirmed(invite)}
                            disabled={busyId === invite.id}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
                          >
                            {busyId === invite.id ? <Loader2 size={13} className="animate-spin" /> : confirm.action === 'revoke' ? <Undo2 size={13} /> : <Trash2 size={13} />}
                            {confirm.action === 'revoke' ? t('confirmRevokeGo') : t('confirmDeleteGo')}
                          </button>
                          <button onClick={() => setConfirm(null)} disabled={busyId === invite.id} className="rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                      {rowError?.id === invite.id && <p className="mt-2 text-xs text-red-400">{rowError.text}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
