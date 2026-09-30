'use client';

import { useEffect, useState } from 'react';
import { Users, Mail, Trash, Copy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPoolMembers, removeUserFromPool } from '@/lib/actions/billing';
import { revokeWorkspaceInvite } from '@/lib/actions/invites';

type Pool = Awaited<ReturnType<typeof getPoolMembers>>;

// Central "People & seats" — everyone across the owner's workspaces + pending invites.
export default function PoolPeopleSection() {
  const t = useTranslations('Billing');
  const [pool, setPool] = useState<Pool | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => getPoolMembers().then(setPool).catch(() => {});
  useEffect(() => { load(); }, []);

  const removeMember = async (userId: string) => {
    setBusy(userId);
    await removeUserFromPool(userId).catch(() => {});
    await load();
    setBusy(null);
  };
  const revoke = async (id: string) => {
    setBusy(id);
    await revokeWorkspaceInvite(id).catch(() => {});
    await load();
    setBusy(null);
  };
  const copy = (link: string, id: string) => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  if (!pool) {
    return <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-neutral-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Users size={12} /> {t('peopleTitle')}
        </span>
        <span className="text-[11px] text-neutral-500">{pool.usage.used} / {isFinite(pool.usage.limit) ? pool.usage.limit : '∞'}</span>
      </div>

      <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
        {pool.members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-300 shrink-0 overflow-hidden">
              {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover" /> : (m.name || m.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[12.5px] text-neutral-100 truncate">{m.name || m.email}</p>
              <p className="m-0 text-[10.5px] text-neutral-500 truncate">
                {m.workspaces.map((w) => w.name).join(', ')}
              </p>
            </div>
            {m.isOwner ? (
              <span className="text-[10px] text-neutral-500 shrink-0">{t('youOwner')}</span>
            ) : (
              <button
                onClick={() => removeMember(m.userId)}
                disabled={busy === m.userId}
                className="shrink-0 text-neutral-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                title={t('removeFromAll')}
              >
                {busy === m.userId ? <Loader2 size={13} className="animate-spin" /> : <Trash size={13} />}
              </button>
            )}
          </div>
        ))}

        {pool.invites.map((inv) => (
          <div key={inv.id} className="flex items-center gap-2.5 px-3 py-2 bg-signal/5">
            <Mail size={13} className="text-signal-text shrink-0 ml-1" />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[12.5px] text-neutral-200 truncate">{inv.email}</p>
              <p className="m-0 text-[10.5px] text-neutral-500 truncate">{t('pendingIn', { workspace: inv.workspaceName })}</p>
            </div>
            <button onClick={() => copy(inv.inviteLink, inv.id)} className="shrink-0 text-neutral-500 hover:text-neutral-200 transition-colors" title={t('copy')}>
              {copied === inv.id ? <span className="text-[10px] text-green-400">{t('copied')}</span> : <Copy size={13} />}
            </button>
            <button onClick={() => revoke(inv.id)} disabled={busy === inv.id} className="shrink-0 text-neutral-500 hover:text-red-400 disabled:opacity-50 transition-colors" title={t('revokeInvite')}>
              {busy === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Trash size={13} />}
            </button>
          </div>
        ))}

        {pool.members.length === 0 && pool.invites.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-neutral-500">{t('peopleEmpty')}</div>
        )}
      </div>

      <p className="m-0 mt-2 text-[10.5px] text-neutral-600 leading-relaxed">{t('peopleHint')}</p>
    </div>
  );
}
