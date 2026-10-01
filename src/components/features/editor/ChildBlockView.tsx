'use client';
import { NodeViewWrapper } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import PageIcon from '../PageIcon';
import { useTabs } from '@/components/providers/TabsContext';

export default function ChildBlockView({
  node,
  editor,
  decorations,
}: {
  node: any;
  editor: any;
  decorations?: readonly any[];
}) {
  const { itemId, databaseId, title, itemType, icon, iconColor } = node.attrs;
  const router = useRouter();
  const tabs = useTabs();
  const t = useTranslations('Editor');
  // Set by TrashedTargetsExtension: the target is in the Trash, not gone.
  const trashed = !!decorations?.some((decoration) => decoration.spec?.trashed);

  const ext = editor.extensionManager.extensions.find((e: any) => e.name === 'childBlock');
  const shareMap = ext?.options?.shareMap as Record<string, string> | null;
  const sharedSlug = shareMap?.[itemId];

  // In shared view: link to /share/[slug] if child is also shared, otherwise no link
  // In normal view: link to /page/[id] or /db/[id]
  const isSharedView = shareMap !== null && shareMap !== undefined;
  const normalHref = itemType === 'database' ? `/db/${databaseId || itemId}` : `/page/${itemId}`;
  const href = sharedSlug ? `/share/${sharedSlug}` : normalHref;

  const handleNavigate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSharedView && !sharedSlug) return; // not shared — block navigation
    if (trashed) return;

    // Ctrl/Cmd+click or middle-click → open in a new tab (Tauri only; web has no provider).
    const newTab = !!tabs && !isSharedView && (e.metaKey || e.ctrlKey || e.button === 1);

    // Save content immediately before navigating so it persists on return
    const md = (editor as any).getMarkdown?.();
    if (md && typeof ext?.options?.onImmediateSave === 'function') {
      try { await ext.options.onImmediateSave(md); } catch {}
    }

    if (newTab) tabs!.openInNewTab(href);
    else router.push(href);
  };

  // Drag + delete/duplicate are handled by the global BlockDragHandle (gutter),
  // so this view only renders the icon + title link. The `-mx-1 px-1` keeps the
  // hover background padded while aligning the icon with surrounding text.
  return (
    <NodeViewWrapper>
      {/* A sub-page reads as a line of the document: its icon and an underlined title
          at body size, a quiet hover lift — not a card. */}
      <div
        contentEditable={false}
        className="group/child -mx-1.5 my-0.5 flex items-center gap-2 rounded px-1.5 py-0.5 transition-colors select-none hover:bg-hover/60"
      >
        <span className="flex shrink-0 items-center">
          <PageIcon icon={icon || null} iconColor={iconColor || null} size={18} fallbackType={itemType} />
        </span>

        <button
          type="button"
          onClick={handleNavigate}
          onAuxClick={(e) => { if (e.button === 1) handleNavigate(e); }}
          disabled={(isSharedView && !sharedSlug) || trashed}
          title={trashed ? t('linkInTrashHint') : undefined}
          className={cn(
            'min-w-0 flex-1 truncate text-left font-medium underline decoration-1 underline-offset-4 transition-colors',
            trashed
              ? 'cursor-default text-fg-4 line-through decoration-transparent'
              : isSharedView && !sharedSlug
                ? 'cursor-default text-fg-4 decoration-transparent'
                : 'cursor-pointer text-fg decoration-line-strong group-hover/child:decoration-fg-3',
          )}
        >
          {title}
        </button>

        {trashed && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-fg-4">
            <Trash2 size={12} />
            {t('linkInTrash')}
          </span>
        )}

        {isSharedView && !sharedSlug && (
          <span title={t('childNotShared')} className="shrink-0">
            <Lock size={12} className="text-fg-4" aria-label={t('childNotShared')} />
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
