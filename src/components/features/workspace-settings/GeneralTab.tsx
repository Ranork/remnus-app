'use client';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, HardDrive } from 'lucide-react';
import { renameWorkspace, deleteWorkspace, updateWorkspaceIcon, getWorkspaceStorageUsage } from '@/lib/actions/workspace';
import IconPicker from '@/components/features/IconPicker';
import PageIcon from '@/components/features/PageIcon';
import { formatBytes } from '@/components/features/admin/format';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DangerZone, Field, SettingsPage, SettingsSection } from '@/components/ui/settings';

interface GeneralTabProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  workspaceIconColor?: string | null;
  hasPrivilegedAccess: boolean;
  onRenamed: (newName: string) => void;
  onIconChanged?: (icon: string | null, iconColor: string | null) => void;
  onDeleted: () => void;
  onClose: () => void;
}

export default function GeneralTab({
  workspaceId,
  workspaceName,
  workspaceIcon,
  workspaceIconColor,
  hasPrivilegedAccess,
  onRenamed,
  onIconChanged,
  onDeleted,
  onClose,
}: GeneralTabProps) {
  const t = useTranslations('WorkspaceSettings');

  const [newName, setNewName] = useState(workspaceName);
  const [renameError, setRenameError] = useState('');
  const [renameSuccess, setRenameSuccess] = useState('');
  const [isRenaming, startRenameTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const [currentIcon, setCurrentIcon] = useState<string | null>(workspaceIcon ?? null);
  const [currentIconColor, setCurrentIconColor] = useState<string | null>(workspaceIconColor ?? null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSharedPagesConfirm, setShowSharedPagesConfirm] = useState(false);
  const [sharedPagesWarning, setSharedPagesWarning] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    getWorkspaceStorageUsage(workspaceId)
      .then(b => { if (active) setStorageBytes(b); })
      .catch(() => {});
    return () => { active = false; };
  }, [workspaceId]);

  const handleRename = () => {
    const trimmed = newName.trim();
    if (!trimmed) { setRenameError(t('nameRequired')); return; }
    setRenameError('');
    setRenameSuccess('');
    startRenameTransition(async () => {
      const res = await renameWorkspace(workspaceId, trimmed) as { success?: boolean; error?: string };
      if (res && 'error' in res) {
        setRenameError(res.error || 'Failed to rename workspace');
      } else {
        setRenameSuccess(t('renameSuccess'));
        onRenamed(trimmed);
      }
    });
  };

  const handleDelete = () => {
    setDeleteError('');
    setShowDeleteConfirm(true);
  };

  const doDelete = () => {
    setShowDeleteConfirm(false);
    startDeleteTransition(async () => {
      const res = await deleteWorkspace(workspaceId);
      if (!res) { onDeleted(); onClose(); return; }
      if ('sharedPagesWarning' in res && res.sharedPagesWarning) {
        setSharedPagesWarning(res.sharedPagesWarning);
        setShowSharedPagesConfirm(true);
      } else if ('error' in res) {
        setDeleteError(res.error ?? '');
      } else {
        onDeleted();
        onClose();
      }
    });
  };

  const doForceDelete = () => {
    setShowSharedPagesConfirm(false);
    startDeleteTransition(async () => {
      const { revokeAllSharesInWorkspace } = await import('@/lib/actions/sharing');
      await revokeAllSharesInWorkspace(workspaceId);
      const res2 = await deleteWorkspace(workspaceId);
      if (res2 && 'error' in res2) { setDeleteError(res2.error ?? ''); return; }
      onDeleted(); onClose();
    });
  };

  return (
    <SettingsPage>
      <SettingsSection title={t('workspaceIcon')}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIconPicker(v => !v)}
              className="flex size-12 cursor-pointer items-center justify-center rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-fg-4)]"
              title={t('changeIcon')}
              aria-label={t('changeIcon')}
            >
              {currentIcon ? (
                <PageIcon icon={currentIcon} iconColor={currentIconColor} size={28} />
              ) : (
                <span className="text-2xl font-semibold text-fg-4 select-none">
                  {(workspaceName || 'W').trim().charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            {showIconPicker && (
              <IconPicker
                currentIcon={currentIcon}
                currentIconColor={currentIconColor}
                onSelect={async (newIcon, newColor) => {
                  setCurrentIcon(newIcon);
                  setCurrentIconColor(newColor);
                  setShowIconPicker(false);
                  await updateWorkspaceIcon(workspaceId, newIcon, newColor);
                  onIconChanged?.(newIcon, newColor);
                }}
                onClose={() => setShowIconPicker(false)}
              />
            )}
          </div>
          <p className="text-xs leading-relaxed text-fg-3">{t('workspaceIconHint')}</p>
        </div>
      </SettingsSection>

      <SettingsSection>
        <Field
          label={t('workspaceName')}
          htmlFor="settings-workspace-name"
          error={renameError || undefined}
          hint={!hasPrivilegedAccess ? t('ownerOnlyHint') : undefined}
        >
          <div className="flex gap-2">
            <Input
              id="settings-workspace-name"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setRenameSuccess(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && hasPrivilegedAccess) handleRename(); }}
              disabled={isRenaming || !hasPrivilegedAccess}
              className="flex-1"
            />
            {hasPrivilegedAccess && (
              <Button
                variant="primary"
                onClick={handleRename}
                disabled={newName.trim() === workspaceName}
                loading={isRenaming}
              >
                {t('save')}
              </Button>
            )}
          </div>
        </Field>
        {renameSuccess && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-fg-2">
            <Check size={12} className="text-green-400" /> {renameSuccess}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title={t('storageTitle')} description={t('storageHint')}>
        <p className="flex items-center gap-2 text-ui text-fg">
          <HardDrive size={16} className="shrink-0 text-fg-3" />
          {storageBytes === null ? '…' : formatBytes(storageBytes)}
        </p>
      </SettingsSection>

      {hasPrivilegedAccess && (
        <DangerZone
          title={t('dangerZone')}
          description={t('deleteWarning')}
          action={
            <Button variant="danger" size="sm" onClick={handleDelete} loading={isDeleting}>
              {t('deleteWorkspace')}
            </Button>
          }
        >
          {deleteError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={12} /> {deleteError}
            </p>
          )}
        </DangerZone>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('deleteWorkspace')}
          description={t('deleteConfirm')}
          confirmLabel={t('confirmDelete')}
          cancelLabel={t('cancel')}
          onConfirm={doDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showSharedPagesConfirm && (
        <ConfirmDialog
          title={t('deleteSharedPagesTitle')}
          description={`${sharedPagesWarning} ${t('deleteConfirm')}`}
          confirmLabel={t('deleteSharedPagesConfirm')}
          cancelLabel={t('cancel')}
          onConfirm={doForceDelete}
          onCancel={() => setShowSharedPagesConfirm(false)}
        />
      )}
    </SettingsPage>
  );
}
