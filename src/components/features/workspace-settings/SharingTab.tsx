'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Globe, Copy, Check, Trash2, Lock, PenLine, ExternalLink, AlertCircle, Users } from 'lucide-react';
import {
  getSharesByWorkspace,
  revokeShare,
  type ShareRecord,
} from '@/lib/actions/sharing';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';

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
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmShare, setConfirmShare] = useState<ShareRecord | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSharesByWorkspace(workspaceId);
      setShares(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspaceId]);

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
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-2xs font-medium text-neutral-500">{t('sharePageTitle')}</p>
        <p className="text-[11px] text-neutral-400">{t('sharePageHint')}</p>
      </div>

      {loading ? (
        <div className="text-[11px] text-neutral-600 py-4">…</div>
      ) : shares.length === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-neutral-600 py-4">
          <Globe size={13} />
          {t('noShares')}
        </div>
      ) : (
        <div className="space-y-px">
          {shares.map(share => (
            <div
              key={share.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800"
            >
              <div className="shrink-0">
                {share.permission === 'write'
                  ? <PenLine size={13} className="text-green-400" />
                  : <Lock size={13} className="text-neutral-500" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <code className="text-[10px] text-sky-400 font-mono truncate">
                    /share/{share.slug}
                  </code>
                  {isAdmin && (
                    <a
                      href={shareUrl(share.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-600 hover:text-neutral-400 transition-colors shrink-0"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {share.permission === 'write' ? t('permissionWrite') : t('permissionRead')}
                  {' · '}
                  {t('sharedAt')} {new Date(share.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleCopy(share)}
                  title={t('copyLink')}
                  className="flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded border border-neutral-700 transition-colors"
                >
                  {copiedId === share.id ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
                  {copiedId === share.id ? t('linkCopied') : t('copyLink')}
                </button>
                <button
                  onClick={() => handleRevoke(share)}
                  title={t('revokeShare')}
                  className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="flex items-start gap-2 text-[11px] text-neutral-500 border border-neutral-800 rounded-md px-3 py-2.5 bg-neutral-900/50">
          <AlertCircle size={12} className="mt-0.5 shrink-0 text-amber-500/70" />
          <span>{t('slugHint')}</span>
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-neutral-500 border border-neutral-800 rounded-md px-3 py-2.5 bg-neutral-900/50">
        <Users size={12} className="mt-0.5 shrink-0 text-signal-text/70" />
        <span className="flex-1">{t('privateSharingHint')}</span>
        {onNavigateToMembers && (
          <button
            onClick={onNavigateToMembers}
            className="shrink-0 text-signal-text hover:text-fg transition-colors font-medium"
          >
            {t('goToMembers')} →
          </button>
        )}
      </div>

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
    </div>
  );
}
