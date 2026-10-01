'use client';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Globe, Check, Copy, Trash2, Lock, PenLine, AlertCircle, ChevronDown, Loader2, Settings2 } from 'lucide-react';
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
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Field } from '@/components/ui/settings';
import { cn } from '@/lib/cn';

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

  const widthLabel = (w: ShareWidth) => t(`width${w.charAt(0).toUpperCase() + w.slice(1)}` as 'widthNarrow');
  // Long labels ("Can edit (login required)") wrap inside their segment instead of overflowing.
  const WRAP = 'h-auto min-h-8 py-1.5 leading-tight whitespace-normal';

  const permissionControl = (value: 'read' | 'write', onChange: (v: 'read' | 'write') => void) => (
    <SegmentedControl value={value} onValueChange={onChange} aria-label={t('permissionLabel')} className="w-full">
      <SegmentedControlItem value="read" className={WRAP}><Lock />{t('permissionRead')}</SegmentedControlItem>
      <SegmentedControlItem value="write" className={WRAP}><PenLine />{t('permissionWrite')}</SegmentedControlItem>
    </SegmentedControl>
  );

  const widthControl = (value: ShareWidth, onChange: (v: ShareWidth) => void) => (
    <SegmentedControl value={value} onValueChange={onChange} aria-label={t('widthLabel')} className="w-full">
      {(['narrow', 'wide', 'full'] as ShareWidth[]).map(w => (
        <SegmentedControlItem key={w} value={w}>{widthLabel(w)}</SegmentedControlItem>
      ))}
    </SegmentedControl>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('shareModalTitle')}</DialogTitle>
          {existing === null && <DialogDescription>{t('shareModalHint')}</DialogDescription>}
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {existing === undefined ? (
            <div role="status" className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-fg-3" />
            </div>
          ) : existing ? (
            /* ── Active share ── */
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2 rounded-control bg-raised px-3 py-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                  {existing.permission === 'write'
                    ? <PenLine size={14} className="mt-0.5 shrink-0 text-fg-3" />
                    : <Lock size={14} className="mt-0.5 shrink-0 text-fg-3" />}
                  <code className="flex-1 font-mono text-xs break-all text-fg">{shareUrl(existing.slug)}</code>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge size="sm">{existing.permission === 'write' ? t('permissionWrite') : t('permissionRead')}</Badge>
                  <Badge size="sm">{widthLabel(existing.width)}</Badge>
                  {existing.inSitemap && <Badge size="sm" variant="success">{t('addToSitemap')}</Badge>}
                </div>
              </div>

              {childrenShared !== null && childrenShared > 0 && (
                <p role="status" className="flex items-center gap-1.5 text-xs text-fg-2">
                  <Check size={12} className="text-green-400" />
                  {t('childrenShared', { count: childrenShared })}
                </p>
              )}

              <div className="rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setIsEditing(v => !v)}
                  aria-expanded={isEditing}
                  className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-surface px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-ui font-medium text-fg-2 transition-colors group-hover:text-fg">
                    <Settings2 size={14} className="text-fg-3" />
                    {t('editShare')}
                  </span>
                  <ChevronDown size={16} className={cn('text-fg-3 transition-transform duration-150', isEditing && 'rotate-180')} />
                </button>
                {isEditing && (
                  <div className="flex flex-col gap-3 px-3 pb-3">
                    <Field label={t('permissionLabel')}>{permissionControl(editPermission, setEditPermission)}</Field>
                    <Field label={t('widthLabel')}>{widthControl(editWidth, setEditWidth)}</Field>
                    {/* Sitemap toggle — admin only */}
                    {isAdmin && (
                      <label className="flex cursor-pointer items-center gap-2.5 text-ui text-fg-2">
                        <Checkbox checked={editInSitemap} onCheckedChange={(v) => setEditInSitemap(v)} />
                        {t('addToSitemap')}
                      </label>
                    )}
                    <Button variant="primary" size="sm" className="self-start" onClick={handleSaveEdit} loading={isPending}>
                      {t('saveChanges')}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Create share form ── */
            <>
              <Field label={t('permissionLabel')}>{permissionControl(permission, setPermission)}</Field>
              <Field label={t('widthLabel')}>{widthControl(width, setWidth)}</Field>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox checked={includeChildren} onCheckedChange={(v) => setIncludeChildren(v)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="text-ui text-fg">{t('includeChildren')}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{t('includeChildrenHint')}</span>
                </span>
              </label>

              {/* Custom slug — admin only */}
              {isAdmin && (
                <Field label={t('slugLabel')} htmlFor="share-custom-slug" hint={t('slugHint')}>
                  <div className="flex items-center rounded-control border border-line bg-raised transition-colors hover:border-line-strong focus-within:border-focus">
                    <span className="shrink-0 pl-2.5 font-mono text-xs text-fg-3">/share/</span>
                    <input
                      id="share-custom-slug"
                      type="text"
                      value={customSlug}
                      onChange={e => setCustomSlug(e.target.value.toLowerCase())}
                      placeholder={t('slugPlaceholder')}
                      className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 pl-1 font-mono text-xs text-fg outline-none placeholder:text-fg-4"
                    />
                  </div>
                </Field>
              )}

              {error && (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </>
          )}
        </DialogBody>

        {existing === null && (
          <DialogFooter>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              <Globe />
              {t('createShare')}
            </Button>
          </DialogFooter>
        )}
        {existing && (
          <DialogFooter className="justify-between">
            <Button variant="ghost" onClick={handleRevoke} disabled={isPending} className="hover:bg-red-500/12 hover:text-red-400">
              <Trash2 />
              {t('revokeShare')}
            </Button>
            <Button variant="primary" onClick={handleCopy}>
              {copied ? <Check /> : <Copy />}
              {copied ? t('linkCopied') : t('copyLink')}
            </Button>
          </DialogFooter>
        )}

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
      </DialogContent>
    </Dialog>
  );
}
