'use client';

import { useState, useRef } from 'react';
import { LayoutList, KanbanSquare, Calendar as CalendarIcon, Plus, ChevronDown, Pencil, Trash2, Copy, Check } from 'lucide-react';
import type { DatabaseView } from '@/lib/types/views';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { IconPicker } from './lazyDialogs';
import PageIcon from './PageIcon';

interface ViewsBarProps {
  views: DatabaseView[];
  activeViewId: string;
  onActivate: (id: string) => void;
  onAdd: (type: 'table' | 'kanban' | 'calendar') => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (views: DatabaseView[]) => void;
  onUpdateIcon?: (id: string, icon: string | null, color: string | null) => void;
}

const VIEW_TYPES = [
  { type: 'table', Icon: LayoutList, labelKey: 'tableView' },
  { type: 'kanban', Icon: KanbanSquare, labelKey: 'kanbanView' },
  { type: 'calendar', Icon: CalendarIcon, labelKey: 'calendarView' },
] as const;

/** The view's own icon when it has one, else its layout's glyph. */
function ViewIcon({ view, size = 16 }: { view: DatabaseView; size?: number }) {
  if (view.icon) return <PageIcon icon={view.icon} iconColor={view.iconColor} size={size} fallbackType="page" />;
  const Icon = view.config.type === 'kanban' ? KanbanSquare : view.config.type === 'calendar' ? CalendarIcon : LayoutList;
  return <Icon size={size} />;
}

/**
 * The database's views as line tabs (ink bar under the active one). A click on the
 * tab you're already on opens its menu (rename, duplicate, delete); its icon opens the
 * icon picker. Tabs drag to reorder. On phones the row collapses into one menu button.
 */
export default function ViewsBar({
  views,
  activeViewId,
  onActivate,
  onAdd,
  onRename,
  onDelete,
  onDuplicate,
  onReorder,
  onUpdateIcon,
}: ViewsBarProps) {
  const t = useTranslations('Database');
  const tWs = useTranslations('Workspace');
  // The active tab's menu has no Trigger of its own (the tab is one) — it opens from
  // the tab's click, anchored to it.
  const [menuView, setMenuView] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  // A press on the tab while its menu is open closes the menu (outside press) a moment
  // before the click lands; remembering that keeps the click from reopening it.
  const lastMenuCloseRef = useRef<{ id: string; at: number } | null>(null);
  // Rename starts from the menu: its input must keep focus when the menu closes.
  const renameFromMenuRef = useRef(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeIconPickerViewId, setActiveIconPickerViewId] = useState<string | null>(null);
  const viewRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [draggedViewId, setDraggedViewId] = useState<string | null>(null);
  const [dragOverViewId, setDragOverViewId] = useState<string | null>(null);

  const startRename = (view: DatabaseView) => {
    renameFromMenuRef.current = true;
    setRenamingId(view.id);
    setRenameValue(view.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDragStart = (e: React.DragEvent, viewId: string) => {
    setDraggedViewId(viewId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, viewId: string) => {
    e.preventDefault();
    if (draggedViewId !== viewId) setDragOverViewId(viewId);
  };

  const handleDragLeave = (viewId: string) => {
    if (dragOverViewId === viewId) setDragOverViewId(null);
  };

  const handleDrop = (e: React.DragEvent, targetViewId: string) => {
    e.preventDefault();
    if (!draggedViewId || draggedViewId === targetViewId) {
      setDraggedViewId(null);
      setDragOverViewId(null);
      return;
    }

    const fromIdx = views.findIndex((v) => v.id === draggedViewId);
    const toIdx = views.findIndex((v) => v.id === targetViewId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newViews = [...views];
      const [moved] = newViews.splice(fromIdx, 1);
      newViews.splice(toIdx, 0, moved);
      onReorder(newViews);
    }

    setDraggedViewId(null);
    setDragOverViewId(null);
  };

  const handleDragEnd = () => {
    setDraggedViewId(null);
    setDragOverViewId(null);
  };

  const activeView = views.find((v) => v.id === activeViewId);
  const menuTarget = menuView ? views.find((v) => v.id === menuView.id) : undefined;

  const addViewItems = VIEW_TYPES.map(({ type, Icon, labelKey }) => (
    <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
      <Icon />
      {t(labelKey)}
    </DropdownMenuItem>
  ));

  return (
    <>
    {/* Mobile: one button naming the active view, its menu lists the others */}
    {activeView && (
      <div className="sm:hidden flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex h-10 cursor-pointer items-center gap-1.5 rounded-control px-2 text-ui font-medium text-fg transition-colors hover:bg-hover after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fg">
            <ViewIcon view={activeView} />
            <span className="max-w-[45vw] truncate">{activeView.name}</span>
            <ChevronDown size={14} className="text-fg-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {views.map((view) => (
              <DropdownMenuItem key={view.id} onClick={() => onActivate(view.id)}>
                <ViewIcon view={view} />
                <span className="flex-1 truncate">{view.name}</span>
                {view.id === activeViewId && <Check className="text-fg" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            aria-label={t('addView')}
            title={t('addView')}
          >
            <Plus />
          </DropdownMenuTrigger>
          <DropdownMenuContent>{addViewItems}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    )}

    {/* Desktop: line tabs */}
    <Tabs
      value={activeViewId}
      onValueChange={(value) => onActivate(String(value))}
      className="hidden sm:flex min-w-0 flex-row items-center"
    >
      {/* No hairline of its own: the toolbar row underneath already draws it. */}
      <TabsList className="min-w-0 overflow-x-auto scrollbar-hide shadow-none" style={{ scrollbarWidth: 'none' }}>
        {views.map((view) => {
          const isActive = view.id === activeViewId;
          const isRenaming = renamingId === view.id;

          return (
            <div
              key={view.id}
              className={cn(
                'relative flex shrink-0 cursor-grab active:cursor-grabbing',
                draggedViewId === view.id && 'opacity-25',
                // Drop line (signal) on the tab the dragged one would land before.
                dragOverViewId === view.id && 'before:absolute before:inset-y-2 before:-left-0.5 before:w-0.5 before:rounded-full before:bg-signal',
              )}
              draggable={!isRenaming}
              onDragStart={(e) => handleDragStart(e, view.id)}
              onDragOver={(e) => handleDragOver(e, view.id)}
              onDragLeave={() => handleDragLeave(view.id)}
              onDrop={(e) => handleDrop(e, view.id)}
              onDragEnd={handleDragEnd}
            >
              <TabsTab
                value={view.id}
                ref={(el: HTMLButtonElement | null) => { viewRefs.current[view.id] = el; }}
                onClick={(e) => {
                  if (!isActive || isRenaming) return;
                  const last = lastMenuCloseRef.current;
                  if (last && last.id === view.id && Date.now() - last.at < 400) return;
                  setMenuView({ id: view.id, anchor: e.currentTarget });
                }}
                aria-haspopup={isActive ? 'menu' : undefined}
                className={cn('h-10', isRenaming && 'invisible')}
              >
                <span
                  onClick={(e) => {
                    if (!isActive) return;
                    e.stopPropagation();
                    setActiveIconPickerViewId(view.id);
                  }}
                  className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-hover"
                  title={isActive ? t('changeIcon') : undefined}
                >
                  <ViewIcon view={view} />
                </span>
                <span>{view.name}</span>
              </TabsTab>
              {isRenaming && (
                <input
                  autoFocus
                  value={renameValue}
                  aria-label={t('viewName')}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    // Keep arrows/Home/End in the field instead of moving between tabs.
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  className="absolute inset-x-0 top-1.5 h-7 min-w-24 rounded-control bg-sheet px-2 text-ui text-fg outline-none shadow-[inset_0_0_0_1px_var(--color-focus)]"
                />
              )}
              {activeIconPickerViewId === view.id && (
                <IconPicker
                  currentIcon={view.icon || null}
                  currentIconColor={view.iconColor || null}
                  onSelect={(icon, color) => {
                    onUpdateIcon?.(view.id, icon, color);
                    setActiveIconPickerViewId(null);
                  }}
                  onClose={() => setActiveIconPickerViewId(null)}
                  anchorRef={{ current: viewRefs.current[view.id] }}
                />
              )}
            </div>
          );
        })}
      </TabsList>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'ml-1')}
          aria-label={t('addView')}
          title={t('addView')}
        >
          <Plus />
        </DropdownMenuTrigger>
        <DropdownMenuContent>{addViewItems}</DropdownMenuContent>
      </DropdownMenu>
    </Tabs>

    <DropdownMenu
      open={menuView !== null}
      onOpenChange={(open) => {
        if (open) return;
        if (menuView) lastMenuCloseRef.current = { id: menuView.id, at: Date.now() };
        setMenuView(null);
      }}
    >
      <DropdownMenuContent
        anchor={menuView?.anchor}
        className="min-w-44"
        finalFocus={() => {
          if (!renameFromMenuRef.current) return true;
          renameFromMenuRef.current = false;
          return false;
        }}
      >
        {menuTarget && (
          <>
            <DropdownMenuItem onClick={() => startRename(menuTarget)}>
              <Pencil />
              {t('renameView')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(menuTarget.id)}>
              <Copy />
              {tWs('duplicate')}
            </DropdownMenuItem>
            {views.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(menuTarget.id)}>
                  <Trash2 />
                  {t('deleteView')}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
