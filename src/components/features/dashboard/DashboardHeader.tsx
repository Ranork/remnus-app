'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import { IconPicker } from '@/components/features/lazyDialogs';
import { updateWorkspaceItemIcon, updateWorkspaceItemTitle, deleteWorkspaceItem } from '@/lib/actions/workspace';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { Button } from '@/components/ui/button';

/**
 * Icon + editable title for a dashboard, mirroring `StandalonePageEditor`'s
 * header so the two item types feel like one product. Both fields write
 * through the shared workspace-item actions — a dashboard's name lives in
 * `workspace_items`, exactly like a page's, and never inside the spec.
 */
export default function DashboardHeader({
  itemId,
  workspaceId,
  initialTitle,
  initialIcon,
  initialIconColor,
  blockCount,
  isHome = false,
  compact = false,
}: {
  itemId: string;
  workspaceId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialIconColor: string | null;
  blockCount: number;
  /** The workspace's pinned Pano. It is left out of the sidebar tree, so delete lives here. */
  isHome?: boolean;
  /** A project block below carries the page's big title: this one steps down to a label. */
  compact?: boolean;
}) {
  const t = useTranslations('Dashboard');
  const tPage = useTranslations('Page');
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon);
  const [iconColor, setIconColor] = useState(initialIconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const savedTitle = useRef(initialTitle);

  // Debounced save, same shape as the page editor's title save.
  useEffect(() => {
    if (title === savedTitle.current) return;
    const timer = setTimeout(() => {
      updateWorkspaceItemTitle(itemId, title);
      savedTitle.current = title;
    }, 600);
    return () => clearTimeout(timer);
  }, [title, itemId]);

  // A rename made elsewhere (an agent, another tab) arrives in `initialTitle` on the next
  // refresh; adopt it unless a local edit is still waiting for the save above.
  useEffect(() => {
    if (initialTitle === savedTitle.current || title !== savedTitle.current) return;
    savedTitle.current = initialTitle;
    setTitle(initialTitle);
  }, [initialTitle, title]);

  // After every render, not only on a title change: a server refresh re-renders the
  // layout's default "Remnus" <title>, and this component's props are plain strings, so
  // nothing else here changes identity to re-run the effect.
  useEffect(() => {
    document.title = `${title || t('untitled')} | Remnus`;
  });

  const handleIconSelect = (nextIcon: string | null, nextColor: string | null) => {
    setIcon(nextIcon);
    setIconColor(nextColor);
    setShowIconPicker(false);
    updateWorkspaceItemIcon(itemId, nextIcon, nextColor);
  };

  return (
    <div className={`flex items-center select-none ${compact ? 'mb-4 gap-2' : 'mb-6 gap-3'}`}>
      <div className="relative flex shrink-0 items-center">
        <button
          ref={iconButtonRef}
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-control p-1 transition-colors duration-150 hover:bg-hover"
          title={icon ? tPage('changeIcon') : tPage('addIcon')}
        >
          <PageIcon icon={icon} iconColor={iconColor} size={compact ? 18 : 34} fallbackType="dashboard" />
        </button>
        {showIconPicker && (
          <IconPicker
            currentIcon={icon}
            currentIconColor={iconColor}
            onSelect={handleIconSelect}
            onClose={() => setShowIconPicker(false)}
            anchorRef={iconButtonRef}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('untitled')}
          aria-label={t('renameDashboard')}
          className={
            compact
              ? 'w-full bg-transparent py-0.5 text-ui font-medium text-fg-3 placeholder:text-fg-4 outline-none hover:text-fg-2 focus:text-fg'
              : 'w-full bg-transparent py-0.5 text-2xl font-semibold tracking-tight text-fg placeholder:text-fg-4 outline-none sm:text-3xl'
          }
        />
        {!compact && <p className="text-xs text-fg-4">{t('blockCount', { count: blockCount })}</p>}
      </div>

      {isHome && (
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'icon'}
          onClick={() => setConfirmDelete(true)}
          title={t('deleteDashboard')}
          aria-label={t('deleteDashboard')}
          className="shrink-0 hover:text-red-400"
        >
          <Trash2 />
        </Button>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('deleteDashboardTitle')}
          description={t('deleteDashboardBody')}
          confirmLabel={t('deleteDashboardConfirm')}
          cancelLabel={t('cancel')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            // Stays busy until we have left the page; the Pano button then offers a fresh one.
            await deleteWorkspaceItem(itemId);
            router.push(`/w/${workspaceId}`);
          }}
        />
      )}
    </div>
  );
}
