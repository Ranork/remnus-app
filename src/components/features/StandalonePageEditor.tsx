'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import Link from 'next/link';
import { ChevronLeft, RefreshCw, MoreHorizontal, Globe, ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateStandalonePageContent, updateWorkspaceItemTitle, updateWorkspaceItemIcon } from '@/lib/actions/workspace';
import BlockEditor, { type BlockEditorHandle } from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import SaveStatus, { type SaveState } from './SaveStatus';
import ShareModal from '@/components/share/ShareModal';
import { useTabNav } from '@/components/providers/TabsContext';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

type Item = { id: string; workspaceId: string; title: string; parentId?: string | null; icon?: string | null; iconColor?: string | null };
type Page = { id: string; content: string };

export default function StandalonePageEditor({
  item,
  page,
  subItems,
  isAdmin = false,
}: {
  item: Item;
  page: Page;
  subItems?: WorkspaceItemRow[];
  isAdmin?: boolean;
}) {
  const t = useTranslations('Page');
  const tEditor = useTranslations('Editor');
  const tWs = useTranslations('Workspace');
  const tSharing = useTranslations('Sharing');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const savedTitle = useRef(item.title);
  const [icon, setIcon] = useState(item.icon);
  const [iconColor, setIconColor] = useState(item.iconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  type WidthMode = 'narrow' | 'wide' | 'full';
  const [widthMode, setWidthMode] = useState<WidthMode>('narrow');
  const [openMenu, setOpenMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BlockEditorHandle>(null);

  const tabNav = useTabNav();
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    tabNav.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [tabNav]);

  useEffect(() => {
    const saved = localStorage.getItem(`page-width-${item.id}`) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
    else if (saved === 'true') setWidthMode('full'); // migrate old boolean
    else {
      const pref = document.documentElement.dataset.defaultWidth as WidthMode | undefined;
      if (pref === 'narrow' || pref === 'wide' || pref === 'full') setWidthMode(pref);
    }
  }, [item.id]);

  const cycleWidth = () => {
    const next: WidthMode = widthMode === 'narrow' ? 'wide' : widthMode === 'wide' ? 'full' : 'narrow';
    setWidthMode(next);
    localStorage.setItem(`page-width-${item.id}`, next);
  };

  const handleIconSelect = async (newIcon: string | null, newColor: string | null) => {
    setIcon(newIcon);
    setIconColor(newColor);
    await updateWorkspaceItemIcon(item.id, newIcon, newColor);
  };

  const widthLabels: Record<WidthMode, string> = { narrow: t('narrow'), wide: t('wide'), full: t('full') };

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  useEffect(() => {
    if (title === savedTitle.current) return;
    const t = setTimeout(() => {
      updateWorkspaceItemTitle(item.id, title);
      savedTitle.current = title;
    }, 800);
    return () => clearTimeout(t);
  }, [title, item.id]);

  useEffect(() => {
    document.title = `${title || 'Untitled'} | Remnus`;
  }, [title]);

  const saveContent = useCallback(async (md: string) => {
    setSaveState('saving');
    try {
      await updateStandalonePageContent(item.id, md);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [item.id]);

  const handleContentChange = useMemo(
    () => debounce(saveContent, 1000),
    [saveContent]
  );

  const containerClass =
    widthMode === 'full' ? 'px-4 sm:px-8 md:px-16 py-6 sm:py-10' :
    widthMode === 'wide' ? 'max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10' :
    'max-w-4xl mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-10';

  return (
    <div className={containerClass}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          {/* Back link only for sub-pages — climbs to the parent page. Top-level
              pages have no back button (by design). */}
          {item.parentId && (
            <Link
              href={`/page/${item.parentId}`}
              className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ChevronLeft size={14} />
              {t('back')}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SaveStatus state={saveState} />

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors p-1 cursor-pointer"
            title={tWs('refresh')}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
            <span className="hidden sm:inline">{tWs('refresh')}</span>
          </button>

          {/* ⋯ Options menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpenMenu(v => !v)}
              className="flex items-center justify-center p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {openMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-neutral-850 border border-neutral-800 shadow-xl py-1.5 w-44 rounded overflow-hidden animate-fade-in animate-duration-100">
                {/* Width — desktop only. On mobile the page is always full-bleed,
                    so the selector is hidden (it had no visual effect there). */}
                <div className="hidden lg:block">
                  <p className="px-3 pt-0.5 pb-1 text-[9px] font-semibold text-neutral-600 uppercase tracking-widest">
                    {widthLabels[widthMode]}
                  </p>
                  {(['narrow', 'wide', 'full'] as WidthMode[]).map(w => (
                    <button
                      key={w}
                      onClick={() => { setWidthMode(w); localStorage.setItem(`page-width-${item.id}`, w); setOpenMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                        widthMode === w ? 'text-blue-400 bg-blue-500/8' : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <ArrowLeftRight size={12} className={widthMode === w ? 'text-blue-400' : 'text-neutral-600'} />
                      {widthLabels[w]}
                      {widthMode === w && <span className="ml-auto text-[9px] text-blue-400">✓</span>}
                    </button>
                  ))}

                  <div className="border-t border-neutral-800 my-1.5" />
                </div>

                {/* Share */}
                <button
                  onClick={() => { setOpenMenu(false); setShowShareModal(true); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 cursor-pointer transition-colors"
                >
                  <Globe size={12} className="text-neutral-500" />
                  {tSharing('shareButton')}
                </button>
              </div>
            )}
          </div>
        </div>

        {showShareModal && (
          <ShareModal
            pageId={item.id}
            workspaceId={item.workspaceId}
            isAdmin={isAdmin}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </div>

      {/* Unified Page Header: Icon + Title Input */}
      <div className="flex items-center gap-3 mb-8 group/page-header relative select-none">
        <div className="relative shrink-0 flex items-center group/icon-wrapper">
          <div className="relative flex items-center">
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1 hover:bg-neutral-800 rounded transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={icon ? t('changeIcon') : t('addIcon')}
            >
              <PageIcon icon={icon} iconColor={iconColor} size={40} fallbackType="page" />
            </button>
            {icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 px-1.5 py-0.5 text-[9px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded transition-all cursor-pointer font-medium whitespace-nowrap shadow-xl z-20"
              >
                Remove
              </button>
            )}
          </div>

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

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editorRef.current?.insertLineAtStart();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                editorRef.current?.focusStart();
              }
            }}
            placeholder={t('untitled')}
            className="w-full bg-transparent text-white font-bold text-2xl sm:text-4xl focus:outline-none placeholder:text-neutral-700 tracking-tight py-1"
          />
        </div>
      </div>

      <BlockEditor
        ref={editorRef}
        key={page.id}
        initialContent={page.content}
        onChange={handleContentChange}
        placeholder={tEditor('placeholder')}
        workspaceId={item.workspaceId}
        parentId={item.id}
        initialSubItems={subItems}
        onImmediateSave={saveContent}
      />
    </div>
  );
}
