'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, Copy, Check, Trash2, Lock, PenLine, ExternalLink, AlertCircle, Users, Loader2 } from 'lucide-react';
import {
  getSharesByWorkspace,
  revokeShare,
  type ShareRecord,
} from '@/lib/actions/sharing';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  onNavigateToMembers?: () => void;
}

function shareUrl(slug: string) {
  if (typeof window === 'undefined') return `/share/${slug}`;
  return `${window.location.origin}/share/${slug}`;
}

export default function SharingTab({ workspaceId, isAdmin, onNavigateToMembers }: Props) {
  const t = useTranslations('Sharing');
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmShare, setConfirmShare] = useState<ShareRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSharesByWorkspace(workspaceId);
      setShares(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const handleCopy = (share: ShareRecord) => {
    navigator.clipboard.writeText(shareUrl(share.slug)).then(() => {
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRevoke = (share: ShareRecord) => {
    setConfirmShare(share);
  };

  // Async on purpose: the confirm dialog stays open with a spinner until the share is gone.
  const doRevoke = async () => {
    if (!confirmShare) return;
    const share = confirmShare;
    await revokeShare(share.id, workspaceId);
    setShares(prev => prev.filter(s => s.id !== share.id));
    setConfirmShare(null);
  };

  return (
    <SettingsPage>
      <SettingsSection title={t('sharePageTitle')} description={t('sharePageHint')}>
        {loading ? (
          <div role="status" className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-fg-3" />
          </div>
        ) : shares.length === 0 ? (
          <EmptyState size="sm" icon={<Globe />} title={t('noShares')} />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
            {shares.map(share => (
              <li key={share.id} className="flex items-center gap-3 px-3 py-2.5">
                {share.permission === 'write'
                  ? <PenLine size={14} className="shrink-0 text-fg-3" />
                  : <Lock size={14} className="shrink-0 text-fg-3" />}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <code className="truncate font-mono text-xs text-fg">/share/{share.slug}</code>
                    {isAdmin && (
                      <a
                        href={shareUrl(share.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('openShare')}
                        className="shrink-0 rounded-sm text-fg-4 transition-colors hover:text-fg-2"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-3">
                    <span>{share.permission === 'write' ? t('permissionWrite') : t('permissionRead')}</span>
                    <span>{t('sharedAt')} {dateFormat.format(new Date(share.createdAt))}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" onClick={() => handleCopy(share)}>
                    {copiedId === share.id ? <Check /> : <Copy />}
                    {copiedId === share.id ? t('linkCopied') : t('copyLink')}
                  </Button>
                  <Tooltip content={t('revokeShare')}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleRevoke(share)}
                      aria-label={t('revokeShare')}
                      className="hover:text-red-400"
                    >
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection>
        {!isAdmin && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-fg-4" />
            <span>{t('slugHint')}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-3">
            <Users size={14} className="mt-0.5 shrink-0 text-fg-4" />
            <span>{t('privateSharingHint')}</span>
          </p>
          {onNavigateToMembers && (
            <Button size="sm" className="shrink-0 self-start sm:self-auto" onClick={onNavigateToMembers}>
              {t('goToMembers')}
            </Button>
          )}
        </div>
      </SettingsSection>

      {confirmShare && (
        <ConfirmDialog
          title={t('revokeShareTitle')}
          description={t('revokeConfirm')}
          confirmLabel={t('revokeShare')}
          cancelLabel={t('cancel')}
          onConfirm={doRevoke}
          onCancel={() => setConfirmShare(null)}
        />
      )}
    </SettingsPage>
  );
}
