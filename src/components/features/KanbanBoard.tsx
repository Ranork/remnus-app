'use client';

import React, { useState, useRef } from 'react';
import { useProgressiveLimit } from '@/lib/useProgressiveLimit';
import { useRouter } from 'next/navigation';
import { GripVertical, Trash2, Plus, Copy, ExternalLink, ArrowUpRight, Maximize2, Link2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, KanbanSquare } from 'lucide-react';
import { normalizeOption, formatDateValue } from '@/lib/types/properties';
import { useLocale, useTranslations } from 'next-intl';
import type { SelectOption } from '@/lib/types/properties';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import InlineCellEditor from './InlineCellEditor';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { StatusChip, UserChip, UserTags, OptionChip, PropertyMark, GroupGlyph, isSelfDescribingType } from './PropertyTags';
import PageIcon from './PageIcon';
import { IconPicker } from './lazyDialogs';
import AgentEditBadge from './AgentEditBadge';
import RecurringBadge from './recurrence/RecurringBadge';
import { updatePageIcon, updatePageCardCollapsed, updatePagesCardCollapsed } from '@/lib/actions/page';
import { updateDatabaseSchema } from '@/lib/actions/database';
import { ConfirmDialog } from './ConfirmDialog';

function getEffectiveGroupOrder(options: string[], groupOrder: string[]): string[] {
  if (!groupOrder || groupOrder.length === 0) return options;
  const optSet = new Set(options);
  const ordered = groupOrder.filter((g) => optSet.has(g));
  const extras = options.filter((o) => !groupOrder.includes(o));
  return [...ordered, ...extras];
}

export default function KanbanBoard({
  database,
  onSchemaChange,
  pages,
  groupByCol,
  groupOrder,
  onGroupOrderChange,
  onCardClick,
  onCardMove,
  onDeletePage,
  onRecurringDelete,
  onDuplicatePage,
  hasSorts,
  cardProperties,
  showPropertyLabels = true,
  propertyTextClamp = 'truncate',
  cardMarkCol,
  onUpdatePageProperties,
  onCreatePage,
  defaultPageIcon,
  defaultPageIconColor,
  onPageIconChange,
  onCardCollapsedChange,
  onCardsCollapsedChange,
  hiddenGroups = [],
}: {
  database: any;
  onSchemaChange?: (schema: any[]) => void;
  pages: any[];
  groupByCol: string;
  groupOrder: string[];
  onGroupOrderChange: (order: string[]) => void;
  onCardClick: (pageId: string) => void;
  onCardMove: (pageId: string, targetGroupId: string, targetPageId?: string, position?: 'before' | 'after') => void;
  onDeletePage: (pageId: string) => void;
  /** Series-aware delete; when absent every row uses the plain confirm. */
  onRecurringDelete?: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  hasSorts: boolean;
  cardProperties?: string[];
  showPropertyLabels?: boolean;
  propertyTextClamp?: 'truncate' | 'wrap';
  /** Property whose value marks every card as a badge (the view's "Mark cards by"). */
  cardMarkCol?: string;
  onUpdatePageProperties: (pageId: string, properties: Record<string, any>) => void;
  onCreatePage?: (initialProperties?: Record<string, any>) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onPageIconChange?: (pageId: string, icon: string | null, iconColor: string | null) => void;
  onCardCollapsedChange?: (pageId: string, collapsed: boolean) => void;
  onCardsCollapsedChange?: (pageIds: string[], collapsed: boolean) => void;
  hiddenGroups?: string[];
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const locale = useLocale();
  const router = useRouter();
  const schema = database.schema as any[];

  // Notion-style right-click menu for cards
  const cardMenu = useContextMenu();
  const buildCardMenu = (pageId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onCardClick(pageId) },
    { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
    { kind: 'separator' },
    { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
    { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => requestDelete(pageId) },
  ];

  const [editingCell, setEditingCell] = useState<{ pageId: string; colId: string } | null>(null);
  const [activeIconPickerPageId, setActiveIconPickerPageId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKanbanIconSelect = (pageId: string, newIcon: string | null, newColor: string | null) => {
    onPageIconChange?.(pageId, newIcon, newColor);
    updatePageIcon(pageId, newIcon, newColor);
  };

  const handleToggleCollapsed = (pageId: string, collapsed: boolean) => {
    onCardCollapsedChange?.(pageId, collapsed);
    updatePageCardCollapsed(pageId, collapsed);
  };

  // Column header toggle — collapses/expands every card in that column at once.
  const handleToggleColumnCollapsed = (columnPages: any[], collapsed: boolean) => {
    const ids = columnPages.map((p) => p.id);
    if (ids.length === 0) return;
    onCardsCollapsedChange?.(ids, collapsed);
    updatePagesCardCollapsed(ids, collapsed);
  };

  const handleCellSave = (pageId: string, colId: string, newVal: any) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const nextProps = { ...page.properties, [colId]: newVal };
    onUpdatePageProperties(pageId, nextProps);
  };

  // Persists a newly-typed select/multi_select option onto the column's schema.
  const handleCreateOption = (colId: string, value: string) => {
    const col = schema.find((c) => c.id === colId);
    if (!col) return;
    const existing = (col.options || []).map((o: string | SelectOption) => normalizeOption(o).value);
    if (existing.includes(value)) return;
    const nextSchema = schema.map((c) =>
      c.id === colId ? { ...c, options: [...(c.options || []), { value, color: 'default' }] } : c
    );
    onSchemaChange?.(nextSchema);
    updateDatabaseSchema(database.id, nextSchema);
  };

  const groupColumn = schema.find((col) => col.id === groupByCol);
  const options: string[] = (groupColumn?.options ?? []).map((o: string | SelectOption) => normalizeOption(o).value);

  const availableProps = schema.filter((c) => c.id !== 'title' && c.id !== groupByCol);
  const propsToShow = cardProperties !== undefined && cardProperties.length > 0
    ? cardProperties.map((id) => availableProps.find((c) => c.id === id)).filter(Boolean) as any[]
    : availableProps.slice(0, 2);

  const textClass = propertyTextClamp === 'wrap' ? 'wrap-break-word whitespace-pre-wrap' : 'truncate';
  const orderedOptions = getEffectiveGroupOrder(options, groupOrder);
  const allColumns = [...orderedOptions, 'Uncategorized'].filter(
    (colName) => !hiddenGroups.includes(colName)
  );

  const groupedPages: Record<string, any[]> = {};
  allColumns.forEach((col) => { groupedPages[col] = []; });
  pages.forEach((page) => {
    const val = page.properties[groupByCol];
    if (val && options.includes(val)) {
      groupedPages[val]?.push(page);
    } else {
      groupedPages['Uncategorized']?.push(page);
    }
  });
  // The first cards of each column arrive with the page; the rest fill in right after (V2 R9.2).
  const cardLimit = useProgressiveLimit(Math.max(0, ...Object.values(groupedPages).map((cards) => cards.length)), 20, 40);

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [isGroupDragReady, setIsGroupDragReady] = useState<string | null>(null);

  // Card dragging states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [dragOverColumnName, setDragOverColumnName] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // A recurring row's delete belongs to the series-aware flow (this one / this
  // and following / all), not to a plain yes-no confirm. Non-series rows keep
  // this view's own dialog, which is why the branch lives here rather than
  // inside the shared hook.
  const requestDelete = (pageId: string) => {
    const row = pages.find((p: any) => p.id === pageId);
    if (row?.seriesId && !row?.seriesDetached && onRecurringDelete) onRecurringDelete(pageId);
    else setConfirmDeleteId(pageId);
  };

  const handleGroupDragStart = (e: React.DragEvent, group: string) => {
    if (group === 'Uncategorized') return;
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGroupDragOver = (e: React.DragEvent, group: string) => {
    e.preventDefault();
    if (draggedGroup && draggedGroup !== group && group !== 'Uncategorized') {
      setDragOverGroup(group);
    }
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup || targetGroup === 'Uncategorized') {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }

    const current = orderedOptions;
    const fromIdx = current.indexOf(draggedGroup);
    const toIdx = current.indexOf(targetGroup);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newOrder = [...current];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);
      onGroupOrderChange(newOrder);
    }

    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  // Card drag and drop handlers
  const handleCardDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardDragOver = (e: React.DragEvent, targetCardId: string, columnName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId || draggedCardId === targetCardId) return;
    setDragOverColumnName(columnName);
    // A per-card insertion point (before/after) only makes sense when nothing
    // is actively re-sorting the column — with a sort active, DatabaseView
    // silently ignores manual positioning anyway (the sort would just put it
    // right back), so don't show a misleading indicator for it here.
    if (hasSorts) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOverPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    setDragOverCardId(targetCardId);
  };

  const handleCardDrop = (e: React.DragEvent, targetCardId: string, targetColumnName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId || cardId === targetCardId) {
      handleCardDragEnd();
      return;
    }

    if (hasSorts) {
      onCardMove(cardId, targetColumnName);
    } else {
      onCardMove(cardId, targetColumnName, targetCardId, dragOverPosition ?? 'before');
    }

    handleCardDragEnd();
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverPosition(null);
    setDragOverColumnName(null);
  };

  const handleColumnCardAreaDragOver = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    if (draggedCardId) {
      setDragOverColumnName(columnName);
      // Left a card's own drop zone for the column's empty area — clear the
      // stale per-card indicator instead of leaving it stuck on the last card.
      setDragOverCardId(null);
      setDragOverPosition(null);
    }
  };

  const handleColumnCardAreaDrop = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId) {
      handleCardDragEnd();
      return;
    }

    onCardMove(cardId, columnName);

    handleCardDragEnd();
  };

  if (!groupByCol) {
    return <EmptyState icon={<KanbanSquare />} title={t('groupByHint')} className="h-full justify-center" />;
  }

  const markColumn = cardMarkCol ? schema.find((c) => c.id === cardMarkCol) : null;
  // A mark already listed among the card's properties is not repeated as a badge.
  const showMark = !!markColumn && !propsToShow.some((c) => c.id === markColumn.id);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {allColumns.map((columnName) => {
        const isUncategorized = columnName === 'Uncategorized';
        const columnPages = groupedPages[columnName] ?? [];
        // "Expand all" only once every card is collapsed; a single expanded card
        // keeps the button meaning "collapse all".
        const allCardsCollapsed = columnPages.length > 0 && columnPages.every((p: any) => p.cardCollapsed);
        const isDraggingThis = draggedGroup === columnName;
        const isOver = dragOverGroup === columnName;
        // The group's colour lives in its heading glyph — a ring for a status, a dot
        // for a select option — not in a tinted column (V2 R8.2).

        return (
          <div
            key={columnName}
            draggable={!isUncategorized && isGroupDragReady === columnName}
            onDragStart={(e) => handleGroupDragStart(e, columnName)}
            onDragOver={(e) => handleGroupDragOver(e, columnName)}
            onDrop={(e) => handleGroupDrop(e, columnName)}
            onDragEnd={() => {
              handleGroupDragEnd();
              setIsGroupDragReady(null);
            }}
            onMouseLeave={() => setIsGroupDragReady(null)}
            className={`group/col flex w-68 shrink-0 flex-col rounded-surface transition-opacity ${
              isDraggingThis ? 'opacity-30' : ''
            } ${isOver ? 'ring-1 ring-signal/50' : ''}`}
          >
            <div
              onMouseDown={() => {
                if (!isUncategorized) {
                  setIsGroupDragReady(columnName);
                }
              }}
              onMouseUp={() => setIsGroupDragReady(null)}
              className={`mb-1 flex min-h-9 items-center justify-between gap-2 px-1 py-1.5 ${
                !isUncategorized ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <h3 className="flex min-w-0 items-center gap-2 text-ui font-medium text-fg-2">
                <GroupGlyph column={groupColumn} value={isUncategorized ? null : columnName} />
                <span className="truncate">{isUncategorized ? t('uncategorized') : columnName}</span>
                <span className="text-xs font-normal text-fg-3">{columnPages.length}</span>
              </h3>
              {columnPages.length > 0 && (
                <button
                  type="button"
                  // Stops the header's mousedown from arming the column drag.
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleColumnCollapsed(columnPages, !allCardsCollapsed);
                  }}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-fg-3 opacity-0 transition-opacity duration-100 group-hover/col:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
                  title={allCardsCollapsed ? t('expandAllCards') : t('collapseAllCards')}
                  aria-label={allCardsCollapsed ? t('expandAllCards') : t('collapseAllCards')}
                >
                  {allCardsCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => handleColumnCardAreaDragOver(e, columnName)}
              onDrop={(e) => handleColumnCardAreaDrop(e, columnName)}
              className={`flex min-h-16 flex-col rounded-control transition-colors ${
                dragOverColumnName === columnName && !dragOverCardId ? 'bg-hover/40' : ''
              }`}
            >
              {groupedPages[columnName].length === 0 ? (
                <div className="px-1 py-4 text-xs text-fg-3">{t('noPages')}</div>
              ) : (
                groupedPages[columnName].slice(0, cardLimit).map((page) => {
                  const isCardEditing = editingCell?.pageId === page.id;
                  const markValue = showMark && markColumn ? page.properties[markColumn.id] : undefined;
                  const hasMark = markValue !== undefined && markValue !== null && markValue !== '' && !(Array.isArray(markValue) && markValue.length === 0);
                  return (
                  <div
                    key={page.id}
                    onClick={() => onCardClick(page.id)}
                    onContextMenu={(e) => cardMenu.open(e, buildCardMenu(page.id))}
                    draggable={true}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      handleCardDragStart(e, page.id);
                    }}
                    onDragOver={(e) => handleCardDragOver(e, page.id, columnName)}
                    onDrop={(e) => handleCardDrop(e, page.id, columnName)}
                    onDragEnd={handleCardDragEnd}
                    // A card is a small raised surface with a hairline — no tint, no
                    // stripe; the drop line (signal) shows where a dragged card lands.
                    className={`group relative mb-2 cursor-pointer rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]
                      ${isCardEditing ? 'z-30 overflow-visible' : 'overflow-hidden'}
                      ${draggedCardId === page.id ? 'opacity-25' : ''}
                      ${dragOverCardId === page.id && dragOverPosition === 'before' ? 'before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-signal' : ''}
                      ${dragOverCardId === page.id && dragOverPosition === 'after' ? 'after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-signal' : ''}
                    `}
                  >
                    {/* Hover card actions */}
                    <div className="absolute right-1.5 top-1.5 z-10 flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                      {/* Collapse/expand — hides the property list, keeping just the title */}
                      <button
                        type="button"
                        onClick={() => handleToggleCollapsed(page.id, !page.cardCollapsed)}
                        className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg"
                        title={page.cardCollapsed ? t('expandCard') : t('collapseCard')}
                        aria-label={page.cardCollapsed ? t('expandCard') : t('collapseCard')}
                      >
                        {page.cardCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {/* Drag handle; a click opens the same menu as a right-click */}
                      <button
                        type="button"
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleCardDragStart(e, page.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          cardMenu.open(e, buildCardMenu(page.id));
                        }}
                        className="flex size-6 cursor-grab items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg active:cursor-grabbing"
                        title={hasSorts ? t('dragMove') : t('dragReorder')}
                        aria-label={hasSorts ? t('dragMove') : t('dragReorder')}
                      >
                        <GripVertical size={14} />
                      </button>
                    </div>

                    <div className="p-3">
                      {hasMark && markColumn && (
                        <div className="mb-2 flex flex-wrap gap-1 pr-12">
                          <PropertyMark column={markColumn} value={markValue} />
                        </div>
                      )}
                      {/* pr-12 (room for the collapse/grip buttons) only reserved on
                          hover — those buttons are `opacity-0` until then, so
                          holding the space permanently truncated titles that had
                          the room to show more. */}
                      <h4 className={`flex items-center gap-1.5 pr-1 text-sm font-medium text-fg transition-[padding-right] duration-200 ease-out group-hover:pr-12 ${propertyTextClamp === 'truncate' ? 'overflow-hidden' : 'wrap-break-word whitespace-normal overflow-visible'}`}>
                        <div className="relative shrink-0 select-none">
                          <button
                            type="button"
                            ref={(el) => { itemRefs.current[page.id] = el; }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                            }}
                            className="flex cursor-pointer items-center justify-center rounded p-0.5 transition-colors hover:bg-hover"
                            title={t('changeIcon')}
                            aria-label={t('changeIcon')}
                          >
                            <PageIcon
                              icon={page.icon || defaultPageIcon}
                              iconColor={page.iconColor || defaultPageIconColor}
                              size={16}
                              fallbackType="page"
                              className="shrink-0"
                            />
                          </button>
                          {activeIconPickerPageId === page.id && (
                            <IconPicker
                              currentIcon={page.icon}
                              currentIconColor={page.iconColor}
                              onSelect={(newIcon, newColor) => handleKanbanIconSelect(page.id, newIcon, newColor)}
                              onClose={() => setActiveIconPickerPageId(null)}
                              anchorRef={{ current: itemRefs.current[page.id] }}
                            />
                          )}
                        </div>
                        <span className={propertyTextClamp === 'truncate' ? 'truncate min-w-0' : ''}>{page.properties['title'] || tPage('untitled')}</span>
                        {/* No rule passed: the rhythm map is loaded by the calendar
                            view (which needs it for its window top-up anyway), so
                            here the badge answers "this repeats" and the details
                            live one click away in the card itself. */}
                        <RecurringBadge seriesId={page.seriesId} detached={page.seriesDetached} />
                      </h4>

                      <AgentEditBadge
                        agentName={page.agentName ?? null}
                        tokenName={page.agentTokenName ?? null}
                        editedAt={page.agentEditedAt ?? null}
                        className="absolute bottom-1.5 right-1.5 z-10"
                      />

                      {/* Collapsed cards hide this via CSS alone (not a JS
                          conditional) so hovering the card — via the `group`
                          class on the card root — can peek it back open without
                          touching the persisted collapsed state. Grid-rows
                          0fr→1fr animates to the block's natural height (same
                          technique as PendingGiftToast's hover-expand panel) —
                          plain `hidden`/`flex` has no in-between state to animate. */}
                      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${page.cardCollapsed ? 'grid-rows-[0fr] group-hover:grid-rows-[1fr]' : 'grid-rows-[1fr]'}`}>
                      <div className="overflow-hidden">
                      <div className="flex flex-col gap-1.5 pt-2">
                        {propsToShow.map((c) => {
                            const val = page.properties[c.id];
                            const isEditing = editingCell?.pageId === page.id && editingCell?.colId === c.id;
                            const isEmpty =
                              val === undefined ||
                              val === null ||
                              val === '' ||
                              (Array.isArray(val) && val.length === 0);
                            // An unticked checkbox is a value too ("not done"), but on a
                            // card it only adds noise — show it only once ticked.
                            const isUnchecked = c.type === 'checkbox' && !(val === true || val === 'true');
                            if ((isEmpty || isUnchecked) && !isEditing) return null;

                            let display: React.ReactNode;
                            if (c.type === 'select' && typeof val === 'string') {
                              display = <OptionChip value={val} options={c.options} />;
                            } else if (c.type === 'status' && typeof val === 'string') {
                              display = <StatusChip value={val} options={c.options} />;
                            } else if (c.type === 'user') {
                              display = <UserChip userId={String(val)} />;
                            } else if (c.type === 'multi_user' && Array.isArray(val)) {
                              display = <UserTags value={val} wrap={propertyTextClamp === 'wrap'} />;
                            } else if (c.type === 'multi_select' && Array.isArray(val)) {
                              display = (
                                <span className={`flex gap-1 ${propertyTextClamp === 'wrap' ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
                                  {val.map((optVal: string) => <OptionChip key={optVal} value={optVal} options={c.options} />)}
                                </span>
                              );
                            } else if ((c.type === 'date' || c.type === 'datetime') && val) {
                              display = (
                                <span className={`text-fg-2 ${textClass}`}>
                                  {formatDateValue(val, c.type as 'date' | 'datetime', c.dateFormat, locale)}
                                </span>
                              );
                            } else if (c.type === 'checkbox') {
                              display = (
                                <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                                  <Checkbox
                                    size="sm"
                                    checked={val === true || val === 'true'}
                                    onCheckedChange={(next) => handleCellSave(page.id, c.id, next)}
                                    aria-label={c.name}
                                  />
                                </span>
                              );
                            } else if (c.type === 'url' && val) {
                              const safeHref = typeof val === 'string' && /^https?:\/\//i.test(val) ? val : null;
                              display = safeHref ? (
                                <a href={safeHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`flex items-center gap-0.5 text-link hover:underline underline-offset-2 ${textClass}`}>
                                  <span className="truncate">{val}</span>
                                  <ExternalLink size={11} className="shrink-0" />
                                </a>
                              ) : (
                                <span className={`text-fg-2 ${textClass}`}>{val}</span>
                              );
                            } else if (c.type === 'email' && val) {
                              display = (
                                <a href={`mailto:${val}`} onClick={(e) => e.stopPropagation()} className={`text-link hover:underline underline-offset-2 ${textClass}`}>{val}</a>
                              );
                            } else {
                              display = (
                                <span className={`text-fg-2 ${textClass}`}>{val !== undefined && val !== null ? String(val) : ''}</span>
                              );
                            }

                            const handlePropClick = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (c.type === 'checkbox') return;
                              setEditingCell({ pageId: page.id, colId: c.id });
                            };

                            return (
                              <div
                                key={c.id}
                                className={`relative flex gap-1.5 overflow-visible text-xs leading-relaxed ${propertyTextClamp === 'wrap' ? 'items-start' : 'items-center'}`}
                              >
                                {/* A value that says what it is (a chip, a person, a
                                    link) needs no "Label:" — only ambiguous ones do. */}
                                {showPropertyLabels && !isSelfDescribingType(c.type) && (
                                  <span className="shrink-0 text-fg-3 select-none">{c.name}</span>
                                )}
                                {isEditing ? (
                                  <InlineCellEditor
                                    column={c}
                                    value={val}
                                    onSave={(newVal) => handleCellSave(page.id, c.id, newVal)}
                                    onClose={() => setEditingCell(null)}
                                    onCreateOption={
                                      c.type === 'select' || c.type === 'multi_select'
                                        ? (v) => handleCreateOption(c.id, v)
                                        : undefined
                                    }
                                  />
                                ) : (
                                  <div
                                    onClick={handlePropClick}
                                    className="inline-flex max-w-full min-w-0 cursor-pointer items-center"
                                  >
                                    {display}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
              {/* "+ New" at the bottom of the group, visible on hover of the column */}
              <button
                type="button"
                onClick={() => onCreatePage?.(isUncategorized ? {} : { [groupByCol]: columnName })}
                className="mt-0.5 flex w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-xs font-medium text-fg-3 opacity-0 transition duration-150 group-hover/col:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
              >
                <Plus size={14} />
                <span>{t('new')}</span>
              </button>
            </div>
          </div>
        );
      })}
      {confirmDeleteId && (
        <ConfirmDialog
          title={t('deletePageConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={() => { onDeletePage(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {cardMenu.node}
    </div>
  );
}
