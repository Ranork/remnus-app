'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import PageIcon from '@/components/features/PageIcon';
import IconPicker from '@/components/features/IconPicker';
import { updateWorkspaceItemIcon, updateWorkspaceItemTitle } from '@/lib/actions/workspace';

/**
 * Icon + editable title for a dashboard, mirroring `StandalonePageEditor`'s
 * header so the two item types feel like one product. Both fields write
 * through the shared workspace-item actions — a dashboard's name lives in
 * `workspace_items`, exactly like a page's, and never inside the spec.
 */
export default function DashboardHeader({
  itemId,
  initialTitle,
  initialIcon,
  initialIconColor,
  blockCount,
}: {
  itemId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialIconColor: string | null;
  blockCount: number;
}) {
  const t = useTranslations('Dashboard');
  const tPage = useTranslations('Page');
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

  useEffect(() => {
    document.title = `${title || t('untitled')} | Remnus`;
  }, [title, t]);

  const handleIconSelect = (nextIcon: string | null, nextColor: string | null) => {
    setIcon(nextIcon);
    setIconColor(nextColor);
    setShowIconPicker(false);
    updateWorkspaceItemIcon(itemId, nextIcon, nextColor);
  };

  return (
    <div className="mb-6 flex items-center gap-3 select-none">
      <div className="relative flex shrink-0 items-center">
        <button
          ref={iconButtonRef}
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150 hover:bg-neutral-800"
          title={icon ? tPage('changeIcon') : tPage('addIcon')}
        >
          <PageIcon icon={icon} iconColor={iconColor} size={34} fallbackType="dashboard" />
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
          className="w-full bg-transparent py-0.5 text-2xl font-bold tracking-tight text-neutral-100 placeholder:text-neutral-700 focus:outline-none sm:text-3xl"
        />
        <p className="text-[11px] text-neutral-600">{t('blockCount', { count: blockCount })}</p>
      </div>
    </div>
  );
}
