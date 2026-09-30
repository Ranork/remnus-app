'use client';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, HardDrive } from 'lucide-react';
import { renameWorkspace, deleteWorkspace, updateWorkspaceIcon, getWorkspaceStorageUsage } from '@/lib/actions/workspace';
import IconPicker from '@/components/features/IconPicker';
import PageIcon from '@/components/features/PageIcon';
import { formatBytes } from '@/components/features/admin/format';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';

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
    <div className="space-y-6">
      {/* Workspace Icon */}
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-neutral-500">
          {t('workspaceIcon')}
        </label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowIconPicker(v => !v)}
              className="w-12 h-12 rounded-lg border border-neutral-700 hover:border-neutral-500 bg-neutral-900 flex items-center justify-center transition-colors cursor-pointer"
              title={t('changeIcon')}
            >
              {currentIcon ? (
                <PageIcon icon={currentIcon} iconColor={currentIconColor} size={28} />
              ) : (
                <span className="text-2xl font-bold text-neutral-600 select-none">
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
          <p className="text-[11px] text-neutral-500 leading-relaxed">{t('workspaceIconHint')}</p>
        </div>
      </div>

      {/* Workspace Name */}
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-neutral-500">
          {t('workspaceName')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isRenaming || !hasPrivilegedAccess}
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-md text-neutral-100 placeholder-neutral-600 px-3 py-1.5 text-sm outline-none focus:border-signal/60 transition-colors disabled:opacity-50"
          />
          {hasPrivilegedAccess && (
            <button
              onClick={handleRename}
              disabled={isRenaming || newName.trim() === workspaceName}
              className="text-xs bg-ink hover:bg-ink/88 disabled:opacity-50 disabled:cursor-not-allowed text-ink-fg px-4 py-1.5 rounded-md font-medium transition-colors"
            >
              {isRenaming ? t('saving') : t('save')}
            </button>
          )}
        </div>
        {renameError && (
          <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
            <AlertCircle size={12} /> {renameError}
          </p>
        )}
        {renameSuccess && (
          <p className="text-xs text-sky-400 flex items-center gap-1 mt-1">
            <Check size={12} /> {renameSuccess}
          </p>
        )}
        {!hasPrivilegedAccess && (
          <p className="text-[11px] text-neutral-500 italic">{t('ownerOnlyHint')}</p>
        )}
      </div>

      {/* Storage usage */}
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-neutral-500">
          {t('storageTitle')}
        </label>
        <div className="flex items-center gap-2.5 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2">
          <HardDrive size={15} className="text-neutral-500 shrink-0" />
          <span className="text-sm text-neutral-200">
            {storageBytes === null ? '…' : formatBytes(storageBytes)}
          </span>
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed">{t('storageHint')}</p>
      </div>

      {/* Danger Zone */}
      {hasPrivilegedAccess && (
        <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-lg space-y-3">
          <h4 className="text-xs font-medium text-red-400">
            {t('dangerZone')}
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">{t('deleteWarning')}</p>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs bg-red-400 hover:bg-red-500 text-white font-semibold py-1.5 px-3 rounded-md transition-colors disabled:opacity-50"
          >
            {isDeleting ? t('deleting') : t('deleteWorkspace')}
          </button>
          {deleteError && (
            <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
              <AlertCircle size={12} /> {deleteError}
            </p>
          )}
        </div>
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
    </div>
  );
}
