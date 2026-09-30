'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import Link from 'next/link';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { updateStandalonePageContent, updateWorkspaceItemTitle, updateWorkspaceItemIcon } from '@/lib/actions/workspace';
import BlockEditor, { type BlockEditorHandle } from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import SaveStatus, { type SaveState } from './SaveStatus';
import PageActionsMenu from './PageActionsMenu';
import { Button } from '@/components/ui/button';
import ShareModal from '@/components/share/ShareModal';
import { PageMarkdownDialog } from './PageMarkdownDialog';
import { PageHistoryModal } from './PageHistoryModal';
import PageBacklinksPanel from './PageBacklinksPanel';
import LocalGraphPanel from './graph/LocalGraphPanel';
import KnowledgeContextPanel from './KnowledgeContextPanel';
import PageCommentsPanel from './PageCommentsPanel';
import { useTabNav } from '@/components/providers/TabsContext';
import { tabKeys } from './tabs/keys';
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const editorRef = useRef<BlockEditorHandle>(null);

  // Keep the Tauri keep-alive query cache (TabPane) in sync with each save, so
  // leaving and re-entering this tab within the staleTime window doesn't reload
  // the pre-edit content from the cache. No-op on web (the query is never read).
  const queryClient = useQueryClient();
  const patchPageCache = useCallback(
    (patch: { item?: Partial<Item>; content?: string }) => {
      queryClient.setQueryData(tabKeys.standalone(item.id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ...(patch.item ? { item: { ...old.item, ...patch.item } } : {}),
          ...(patch.content !== undefined && old.page
            ? { page: { ...old.page, content: patch.content } }
            : {}),
        };
      });
    },
    [queryClient, item.id]
  );

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

  const changeWidth = (next: WidthMode) => {
    setWidthMode(next);
    localStorage.setItem(`page-width-${item.id}`, next);
  };

  const handleIconSelect = async (newIcon: string | null, newColor: string | null) => {
    setIcon(newIcon);
    setIconColor(newColor);
    await updateWorkspaceItemIcon(item.id, newIcon, newColor);
    patchPageCache({ item: { icon: newIcon, iconColor: newColor } });
  };


  useEffect(() => {
    if (title === savedTitle.current) return;
    const t = setTimeout(() => {
      updateWorkspaceItemTitle(item.id, title);
      patchPageCache({ item: { title } });
      savedTitle.current = title;
    }, 800);
    return () => clearTimeout(t);
  }, [title, item.id, patchPageCache]);

  // A rename made elsewhere (an agent, another tab) arrives in `item.title` on the next
  // refresh; the input read it only once. Adopt it unless a local edit is still waiting
  // for the save above — same rule as the body (see the live content sync in BlockEditor).
  useEffect(() => {
    if (item.title === savedTitle.current || title !== savedTitle.current) return;
    savedTitle.current = item.title;
    setTitle(item.title);
  }, [item.title, title]);

  // Re-applied after every server refresh too (`item` is a new object then): the refresh
  // re-renders the layout's default "Remnus" <title>, which would otherwise stay.
  useEffect(() => {
    document.title = `${title || 'Untitled'} | Remnus`;
  }, [title, item]);

  const saveContent = useCallback(async (md: string) => {
    setSaveState('saving');
    try {
      await updateStandalonePageContent(item.id, md);
      patchPageCache({ content: md });
      editorRef.current?.markSaved(md);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [item.id, patchPageCache]);

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
      <div className="mb-8 flex min-h-8 items-center justify-between gap-3">
        <div className="min-w-0">
          {/* Back link only for sub-pages — climbs to the parent page. Top-level
              pages have no back button (by design). */}
          {item.parentId && (
            <Link
              href={`/page/${item.parentId}`}
              className="-ml-2 inline-flex h-8 items-center gap-1 rounded-control px-2 text-ui text-fg-3 transition-colors hover:bg-hover hover:text-fg"
            >
              <ChevronLeft size={16} />
              {t('back')}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1">
          <SaveStatus state={saveState} className="mr-1" />

          <Button variant="ghost" size="sm" onClick={handleRefresh} title={tWs('refresh')} aria-label={tWs('refresh')}>
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{tWs('refresh')}</span>
          </Button>

          <PageActionsMenu
            widthMode={widthMode}
            onWidthChange={changeWidth}
            onShare={() => setShowShareModal(true)}
            onMarkdown={() => setMarkdownDraft(editorRef.current?.getMarkdown() ?? page.content)}
            onHistory={() => setShowHistory(true)}
          />
        </div>

        {showShareModal && (
          <ShareModal
            pageId={item.id}
            workspaceId={item.workspaceId}
            isAdmin={isAdmin}
            onClose={() => setShowShareModal(false)}
          />
        )}

        {markdownDraft !== null && (
          <PageMarkdownDialog
            initialMarkdown={markdownDraft}
            onApply={(md) => editorRef.current?.replaceContent(md)}
            onClose={() => setMarkdownDraft(null)}
          />
        )}

        {showHistory && (
          <PageHistoryModal
            workspaceId={item.workspaceId}
            pageId={item.id}
            currentContent={editorRef.current?.getMarkdown() ?? page.content}
            onRestored={(content) => editorRef.current?.replaceContent(content)}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {/* Unified Page Header: Icon + Title Input */}
      <div className="flex items-center gap-3 mb-6 group/page-header relative select-none">
        <div className="relative shrink-0 flex items-center group/icon-wrapper">
          <div className="relative flex items-center">
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1 hover:bg-hover rounded-surface transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={icon ? t('changeIcon') : t('addIcon')}
            >
              <PageIcon icon={icon} iconColor={iconColor} size={36} fallbackType="page" />
            </button>
            {icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 focus-visible:opacity-100 h-6 px-2 text-2xs bg-fg text-desk rounded-control transition-opacity cursor-pointer font-medium whitespace-nowrap shadow-float z-20"
              >
                {t('removeIcon')}
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
            className="w-full bg-transparent text-fg font-semibold text-[28px] sm:text-[34px] leading-tight tracking-[-0.025em] outline-none placeholder:text-fg-4 py-1"
          />
        </div>
      </div>

      {/* Comments — directly under the title, above the body (standalone pages
          have no attributes section, so this is the closest equivalent to
          PageEditor's "right under the attributes" placement). */}
      <PageCommentsPanel workspaceId={item.workspaceId} pageId={item.id} />

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

      <KnowledgeContextPanel workspaceId={item.workspaceId} pageId={item.id} />
      <PageBacklinksPanel workspaceId={item.workspaceId} pageId={item.id} />
      <LocalGraphPanel workspaceId={item.workspaceId} pageId={item.id} />
    </div>
  );
}
