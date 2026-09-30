'use client';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { X, Globe, Check, Copy, Trash2, Lock, PenLine, AlertCircle, ChevronDown } from 'lucide-react';
import {
  createShare,
  createShareWithChildren,
  getShareByPageId,
  revokeShare,
  updateShare,
  type ShareRecord,
  type ShareWidth,
} from '@/lib/actions/sharing';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';

interface Props {
  pageId: string;
  workspaceId: string;
  isAdmin: boolean;
  onClose: () => void;
}

function shareUrl(slug: string) {
  if (typeof window === 'undefined') return `/share/${slug}`;
  return `${window.location.origin}/share/${slug}`;
}

export default function ShareModal({ pageId, workspaceId, isAdmin, onClose }: Props) {
  const t = useTranslations('Sharing');
  const [existing, setExisting] = useState<ShareRecord | null | undefined>(undefined);
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [width, setWidth] = useState<ShareWidth>('narrow');
  const [editPermission, setEditPermission] = useState<'read' | 'write'>('read');
  const [editWidth, setEditWidth] = useState<ShareWidth>('narrow');
  const [editInSitemap, setEditInSitemap] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [includeChildren, setIncludeChildren] = useState(false);
  const [childrenShared, setChildrenShared] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  useEffect(() => {
    getShareByPageId(workspaceId, pageId).then(s => {
      setExisting(s);
      if (s) { setEditPermission(s.permission); setEditWidth(s.width); setEditInSitemap(s.inSitemap); }
    });
  }, [workspaceId, pageId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onClose]);

  const handleSaveEdit = () => {
    if (!existing) return;
    startTransition(async () => {
      await updateShare(existing.id, workspaceId, { permission: editPermission, width: editWidth, inSitemap: editInSitemap });
      setExisting(prev => prev ? { ...prev, permission: editPermission, width: editWidth, inSitemap: editInSitemap } : prev);
      setIsEditing(false);
    });
  };

  const handleCreate = () => {
    setError('');
    startTransition(async () => {
      const slug = isAdmin ? customSlug || undefined : undefined;
      const result = includeChildren
        ? await createShareWithChildren(workspaceId, pageId, permission, slug, width)
        : await createShare(workspaceId, pageId, permission, slug, width);

      if (result.error) {
        setError(result.error);
      } else if (result.share) {
        setExisting(result.share);
        if ('childCount' in result && typeof result.childCount === 'number') {
          setChildrenShared(result.childCount);
        }
      }
    });
  };

  const handleRevoke = () => {
    if (!existing) return;
    setShowRevokeConfirm(true);
  };

  // Async on purpose: the confirm dialog stays open with a spinner until the share is gone.
  const doRevoke = async () => {
    if (!existing) return;
    await revokeShare(existing.id, workspaceId);
    setExisting(null);
    setChildrenShared(null);
    setShowRevokeConfirm(false);
  };

  const handleCopy = () => {
    if (!existing) return;
    navigator.clipboard.writeText(shareUrl(existing.slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/30">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-100">{t('shareModalTitle')}</span>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {existing === undefined ? (
            <p className="text-[11px] text-neutral-500">…</p>
          ) : existing ? (
            /* ── Active share ── */
            <div className="space-y-3">
              {/* Link row */}
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2">
                {existing.permission === 'write'
                  ? <PenLine size={12} className="text-green-400 shrink-0" />
                  : <Lock size={12} className="text-neutral-500 shrink-0" />
                }
                <code className="flex-1 text-[11px] text-sky-400 font-mono break-all">
                  {shareUrl(existing.slug)}
                </code>
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-neutral-500">
                  {existing.permission === 'write' ? t('permissionWrite') : t('permissionRead')}
                  {' · '}
                  {t(`width${existing.width.charAt(0).toUpperCase() + existing.width.slice(1)}` as any)}
                  {existing.inSitemap && (
                    <span className="ml-1.5 text-green-500/70">· SEO ✓</span>
                  )}
                </p>
                <button
                  onClick={() => setIsEditing(v => !v)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {isEditing ? '↑ ' + t('copyLink').replace('Copy', 'Close') : t('editShare')}
                </button>
              </div>

              {/* Edit panel */}
              {isEditing && (
                <div className="border border-neutral-800 rounded-md bg-neutral-900/40 p-3 space-y-3">
                  {/* Permission */}
                  <div className="flex gap-2">
                    {(['read', 'write'] as const).map(p => (
                      <button key={p} onClick={() => setEditPermission(p)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
                          editPermission === p
                            ? p === 'write' ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-signal/15 border-signal/40 text-signal-text'
                            : 'border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                        }`}
                      >
                        {p === 'write' ? <PenLine size={10} /> : <Lock size={10} />}
                        {p === 'read' ? t('permissionRead') : t('permissionWrite')}
                      </button>
                    ))}
                  </div>
                  {/* Width */}
                  <div className="flex gap-1.5">
                    {(['narrow', 'wide', 'full'] as ShareWidth[]).map(w => (
                      <button key={w} onClick={() => setEditWidth(w)}
                        className={`flex-1 px-2 py-1.5 rounded border text-[10px] font-semibold transition-colors ${
                          editWidth === w ? 'bg-signal/15 border-signal/40 text-signal-text' : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                        }`}
                      >
                        {t(`width${w.charAt(0).toUpperCase() + w.slice(1)}` as any)}
                      </button>
                    ))}
                  </div>
                  {/* Sitemap toggle — admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => setEditInSitemap(v => !v)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 transition-colors"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        editInSitemap ? 'bg-green-500 border-green-500' : 'border-neutral-600'
                      }`}>
                        {editInSitemap && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <span className="text-[11px] text-neutral-300">{t('addToSitemap')}</span>
                      <span className="ml-auto text-2xs text-neutral-600">SEO</span>
                    </button>
                  )}

                  <button onClick={handleSaveEdit} disabled={isPending}
                    className="w-full text-[11px] font-semibold bg-ink hover:bg-ink/88 disabled:opacity-60 text-ink-fg py-1.5 rounded transition-colors"
                  >
                    {isPending ? '…' : t('saveChanges')}
                  </button>
                </div>
              )}

              {childrenShared !== null && childrenShared > 0 && (
                <p className="text-[10px] text-green-400/70 flex items-center gap-1">
                  <Check size={10} />
                  {t('childrenShared', { count: childrenShared })}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-ink hover:bg-ink/88 text-ink-fg px-3 py-2 rounded-md transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? t('linkCopied') : t('copyLink')}
                </button>
                <button onClick={handleRevoke} disabled={isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 border border-neutral-700 hover:border-red-500/40 hover:bg-neutral-800 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {t('revokeShare')}
                </button>
              </div>
            </div>
          ) : (
            /* ── Create share form ── */
            <div className="space-y-4">
              <p className="text-[11px] text-neutral-400">{t('shareModalHint')}</p>

              {/* Permission */}
              <div className="space-y-1.5">
                <label className="text-2xs font-medium text-neutral-500">
                  {t('permissionLabel')}
                </label>
                <div className="flex gap-2">
                  {(['read', 'write'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPermission(p)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs font-semibold transition-colors ${
                        permission === p
                          ? p === 'write'
                            ? 'bg-green-500/15 border-green-500/40 text-green-300'
                            : 'bg-signal/15 border-signal/40 text-signal-text'
                          : 'border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                    >
                      {p === 'write' ? <PenLine size={11} /> : <Lock size={11} />}
                      {p === 'read' ? t('permissionRead') : t('permissionWrite')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Width */}
              <div className="space-y-1.5">
                <label className="text-2xs font-medium text-neutral-500">
                  {t('widthLabel')}
                </label>
                <div className="flex gap-1.5">
                  {(['narrow', 'wide', 'full'] as ShareWidth[]).map(w => (
                    <button key={w} onClick={() => setWidth(w)}
                      className={`flex-1 px-2 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
                        width === w ? 'bg-signal/15 border-signal/40 text-signal-text' : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                      }`}
                    >
                      {t(`width${w.charAt(0).toUpperCase() + w.slice(1)}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Include children toggle */}
              <button
                onClick={() => setIncludeChildren(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    includeChildren ? 'bg-signal border-signal' : 'border-neutral-600 group-hover:border-neutral-500'
                  }`}>
                    {includeChildren && <Check size={10} strokeWidth={3} className="text-signal-fg" />}
                  </div>
                  <span className="text-[11px] text-neutral-300">{t('includeChildren')}</span>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-neutral-600 transition-transform ${includeChildren ? 'rotate-180' : ''}`}
                />
              </button>

              {includeChildren && (
                <p className="text-[10px] text-neutral-500 px-1">{t('includeChildrenHint')}</p>
              )}

              {/* Custom slug — admin only */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-2xs font-medium text-neutral-500">
                    {t('slugLabel')}
                  </label>
                  <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-md focus-within:border-signal/60 transition-colors">
                    <span className="pl-3 text-[11px] text-neutral-600 font-mono shrink-0">/share/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={e => setCustomSlug(e.target.value.toLowerCase())}
                      placeholder={t('slugPlaceholder')}
                      className="flex-1 bg-transparent text-[11px] text-neutral-200 font-mono px-2 py-2 outline-none placeholder-neutral-700"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-600">{t('slugHint')}</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-ink hover:bg-ink/88 disabled:opacity-60 text-ink-fg px-4 py-2.5 rounded-md transition-colors"
              >
                <Globe size={13} />
                {isPending ? '…' : t('createShare')}
              </button>
            </div>
          )}
        </div>
      </div>
      {showRevokeConfirm && (
        <ConfirmDialog
          title={t('revokeShareTitle')}
          description={t('revokeConfirm')}
          confirmLabel={t('revokeShare')}
          cancelLabel={t('cancel')}
          onConfirm={doRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
        />
      )}
    </div>
  );
}
