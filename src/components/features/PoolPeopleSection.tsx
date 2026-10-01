'use client';

import { useEffect, useState } from 'react';
import { Mail, Trash, Copy, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPoolMembers, removeUserFromPool } from '@/lib/actions/billing';
import { revokeWorkspaceInvite } from '@/lib/actions/invites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { SettingsSection } from '@/components/ui/settings';

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
    return (
      <div role="status" className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-fg-3" />
      </div>
    );
  }

  return (
    <SettingsSection
      title={t('peopleTitle')}
      action={<Badge variant="outline">{pool.usage.used} / {isFinite(pool.usage.limit) ? pool.usage.limit : '∞'}</Badge>}
    >
      <ul className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
        {pool.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 px-3 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-hover text-2xs font-semibold text-fg-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.image ? <img src={m.image} alt="" className="size-full object-cover" /> : (m.name || m.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-fg">{m.name || m.email}</p>
              <p className="truncate text-xs text-fg-3">{m.workspaces.map((w) => w.name).join(', ')}</p>
            </div>
            {m.isOwner ? (
              <span className="shrink-0 text-xs text-fg-3">{t('youOwner')}</span>
            ) : (
              <Tooltip content={t('removeFromAll')}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removeMember(m.userId)}
                  disabled={!!busy && busy !== m.userId}
                  loading={busy === m.userId}
                  aria-label={t('removeFromAll')}
                  className="hover:text-red-400"
                >
                  <Trash />
                </Button>
              </Tooltip>
            )}
          </li>
        ))}

        {pool.invites.map((inv) => (
          <li key={inv.id} className="flex items-center gap-2.5 px-3 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center">
              <Mail size={14} className="text-fg-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-fg-2">{inv.email}</p>
              <p className="truncate text-xs text-fg-3">{t('pendingIn', { workspace: inv.workspaceName })}</p>
            </div>
            <Tooltip content={copied === inv.id ? t('copied') : t('copy')}>
              <Button size="icon-sm" variant="ghost" onClick={() => copy(inv.inviteLink, inv.id)} aria-label={t('copy')}>
                {copied === inv.id ? <Check className="text-green-400" /> : <Copy />}
              </Button>
            </Tooltip>
            <Tooltip content={t('revokeInvite')}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => revoke(inv.id)}
                disabled={!!busy && busy !== inv.id}
                loading={busy === inv.id}
                aria-label={t('revokeInvite')}
                className="hover:text-red-400"
              >
                <Trash />
              </Button>
            </Tooltip>
          </li>
        ))}

        {pool.members.length === 0 && pool.invites.length === 0 && (
          <li className="px-3 py-3 text-xs text-fg-3">{t('peopleEmpty')}</li>
        )}
      </ul>

      <p className="text-xs leading-relaxed text-fg-3">{t('peopleHint')}</p>
    </SettingsSection>
  );
}
