'use client';

import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateValue, normalizeOption, type SelectOption } from '@/lib/types/properties';
import { useLocale, useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';
import InlineCellEditor from './InlineCellEditor';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { StatusChip, UserChip, UserTags, OptionChip, MarkDot, PropertyTypeIcon } from './PropertyTags';
import { GripHorizontal, GripVertical, Trash2, Plus, Copy, EyeOff, ArrowUp, ArrowDown, Filter, X, RotateCcw, Check, ExternalLink, ArrowUpRight, Maximize2, Link2 } from 'lucide-react';
import type { ViewFilter, ViewSort, FilterOperator } from '@/lib/types/views';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import RecurringBadge from './recurrence/RecurringBadge';
import { updatePageIcon } from '@/lib/actions/page';
import { updateDatabaseSchema } from '@/lib/actions/database';
import { ConfirmDialog } from './ConfirmDialog';
import { SimpleSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip } from '@/components/ui/tooltip';
import { MENU_SURFACE, MENU_ICON, MENU_LABEL, MENU_SEPARATOR, menuItem } from './editor/menuStyles';
import { FilterValueField, useFilterOperators } from './database-sidebar/FiltersSection';

// ── Coarse-pointer (touch) detection via useSyncExternalStore ───────────────────
const COARSE_POINTER_QUERY = '(hover: none)';
function subscribeCoarsePointer(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
function getCoarsePointerSnapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(COARSE_POINTER_QUERY).matches;
}
function getCoarsePointerServerSnapshot() {
  return false;
}

function getPropertyIcon(type: string) {
  return <PropertyTypeIcon type={type} size={12} />;
}

function getVisibleColumns(schema: any[], columnOrder: string[], hiddenColumns: string[]): any[] {
  const hiddenSet = new Set(hiddenColumns ?? []);
  const visible = schema.filter((c) => !hiddenSet.has(c.id));
  if (!columnOrder || columnOrder.length === 0) return visible;
  const orderIndex = new Map(columnOrder.map((id, i) => [id, i]));
  return [...visible].sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Infinity;
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Infinity;
    return ai - bi;
  });
}

const ACTION_BAR_WIDTH = 26;

export default function TableLayout({
  database,
  onSchemaChange,
  pages,
  columnOrder,
  hiddenColumns,
  columnWidths = {},
  onColumnWidthsChange,
  rowColorCol,
  onColumnOrderChange,
  onRowClick,
  onRowReorder,
  onDeletePage,
  onRecurringDelete,
  onDuplicatePage,
  hasSorts,
  onUpdatePageProperties,
  onCreatePage,
  filters,
  sorts,
  onFiltersChange,
  onSortsChange,
  onToggleHideColumn,
  defaultPageIcon,
  defaultPageIconColor,
  onPageIconChange,
  disableRowDrag = false,
  showToggleColumnsButton = true,
}: {
  database: any;
  onSchemaChange?: (schema: any[]) => void;
  pages: any[];
  columnOrder: string[];
  hiddenColumns: string[];
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  rowColorCol?: string;
  onColumnOrderChange: (order: string[]) => void;
  onRowClick: (pageId: string) => void;
  onRowReorder: (orderedIds: string[]) => void;
  onDeletePage: (pageId: string) => void;
  /** Series-aware delete; when absent every row uses the plain confirm. */
  onRecurringDelete?: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  hasSorts: boolean;
  onUpdatePageProperties: (pageId: string, properties: Record<string, any>) => void;
  onCreatePage?: (initialProperties?: Record<string, any>) => void;
  filters: ViewFilter[];
  sorts: ViewSort[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  onSortsChange: (sorts: ViewSort[]) => void;
  onToggleHideColumn: (colId: string) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onPageIconChange?: (pageId: string, icon: string | null, iconColor: string | null) => void;
  disableRowDrag?: boolean;
  showToggleColumnsButton?: boolean;
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const locale = useLocale();
  const zoom = useZoom();
  const router = useRouter();
  const schema: any[] = database.schema ?? [];
  const visibleCols = getVisibleColumns(schema, columnOrder, hiddenColumns);

  const [localWidths, setLocalWidths] = useState<Record<string, number>>(() => columnWidths ?? {});
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


  // Floating action bar — tracked via mouse position at row hover
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);
  const [actionPos, setActionPos] = useState<{ top: number; left: number; height: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notion-style right-click menu for rows; the grip's click opens the same one.
  // Closing it also drops the floating grip, whose row the mouse has usually left.
  const rowMenu = useContextMenu(() => {
    setHoveredPageId(null);
    setActionPos(null);
  });
  const buildRowMenu = (pageId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onRowClick(pageId) },
    { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
    { kind: 'separator' },
    { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
    { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => requestDelete(pageId) },
  ];

  useEffect(() => {
    setLocalWidths(columnWidths ?? {});
  }, [columnWidths]);

  const hasAnyCustomWidth = Object.keys(localWidths).length > 0;
  const totalCalculatedWidth = visibleCols.reduce((sum, col) => {
    return sum + (localWidths[col.id] ?? (col.id === 'title' ? 180 : 100));
  }, 0);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const thElement = (e.currentTarget as HTMLElement).closest('th');
    const startX = e.clientX;
    const startWidth = thElement
      ? thElement.getBoundingClientRect().width
      : (localWidths[colId] ?? (colId === 'title' ? 180 : 100));

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const minWidth = colId === 'title' ? 180 : 100;
      const newWidth = Math.max(minWidth, startWidth + deltaX);
      setLocalWidths((prev) => ({
        ...prev,
        [colId]: newWidth,
      }));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setLocalWidths((currentWidths) => {
        const deltaX = upEvent.clientX - startX;
        const minWidth = colId === 'title' ? 180 : 100;
        const newWidth = Math.max(minWidth, startWidth + deltaX);
        const updatedWidths = {
          ...currentWidths,
          [colId]: newWidth,
        };
        onColumnWidthsChange?.(updatedWidths);
        return updatedWidths;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetColWidth = (colId: string) => {
    const updatedWidths = { ...localWidths };
    delete updatedWidths[colId];
    setLocalWidths(updatedWidths);
    onColumnWidthsChange?.(updatedWidths);
    closeHeaderMenu();
  };

  const [editingCell, setEditingCell] = useState<{ pageId: string; colId: string } | null>(null);
  const [activeIconPickerPageId, setActiveIconPickerPageId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // On touch / no-hover devices a cell tap should open the row (peek modal)
  // instead of starting inline editing — editing happens inside the page there.
  const isCoarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    getCoarsePointerServerSnapshot,
  );

  const handleTableIconSelect = (pageId: string, newIcon: string | null, newColor: string | null) => {
    onPageIconChange?.(pageId, newIcon, newColor);
    updatePageIcon(pageId, newIcon, newColor);
  };

  // Header menu state
  const [activeHeaderMenuColId, setActiveHeaderMenuColId] = useState<string | null>(null);
  const [headerMenuPos, setHeaderMenuPos] = useState<{ x: number; y: number } | null>(null);

  const OPERATORS = useFilterOperators();

  const handleHeaderClick = (e: React.MouseEvent, colId: string) => {
    e.stopPropagation();
    if (activeHeaderMenuColId === colId) {
      closeHeaderMenu();
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const menuWidth = 240; // w-60 width of dropdown is 240px
      let x = rect.left;
      if (typeof window !== 'undefined' && x + menuWidth > window.innerWidth) {
        x = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setHeaderMenuPos({ x, y: rect.bottom + 4 });
      setActiveHeaderMenuColId(colId);
    }
  };

  const closeHeaderMenu = () => {
    setActiveHeaderMenuColId(null);
    setHeaderMenuPos(null);
  };

  // Toggle columns menu state (for the "+" button at the end of headers)
  const [toggleMenuOpen, setToggleMenuOpen] = useState(false);
  const [toggleMenuPos, setToggleMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleToggleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggleMenuOpen) {
      closeToggleMenu();
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const menuWidth = 240; // w-60
      let x = rect.left;
      if (typeof window !== 'undefined' && x + menuWidth > window.innerWidth) {
        x = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setToggleMenuPos({ x, y: rect.bottom + 4 });
      setToggleMenuOpen(true);
    }
  };

  const closeToggleMenu = () => {
    setToggleMenuOpen(false);
    setToggleMenuPos(null);
  };

  const handleSortCol = (colId: string, direction: 'asc' | 'desc') => {
    const existing = sorts.find((s) => s.columnId === colId);
    let nextSorts: ViewSort[];
    if (existing) {
      nextSorts = sorts.map((s) => s.columnId === colId ? { ...s, direction } : s);
    } else {
      nextSorts = [...sorts, { id: crypto.randomUUID().slice(0, 8), columnId: colId, direction }];
    }
    onSortsChange(nextSorts);
    closeHeaderMenu();
  };

  const handleRemoveSort = (colId: string) => {
    onSortsChange(sorts.filter((s) => s.columnId !== colId));
    closeHeaderMenu();
  };

  const handleAddFilter = (colId: string) => {
    onFiltersChange([...filters, { id: crypto.randomUUID().slice(0, 8), columnId: colId, operator: 'contains', value: '' }]);
  };

  const handleUpdateFilter = (filterId: string, patch: Partial<ViewFilter>) => {
    onFiltersChange(filters.map((f) => f.id === filterId ? { ...f, ...patch } : f));
  };

  const handleDeleteFilter = (filterId: string) => {
    onFiltersChange(filters.filter((f) => f.id !== filterId));
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

  // Column DnD
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Row DnD — only the grip button is draggable; <tr> elements are drop targets
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // ── Column drag ────────────────────────────────────────────────────────────
  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggedColId !== colId) setDragOverColId(colId);
  };
  const handleColDragLeave = (colId: string) => {
    if (dragOverColId === colId) setDragOverColId(null);
  };
  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null); setDragOverColId(null); return;
    }
    const fromIdx = visibleCols.findIndex((c) => c.id === draggedColId);
    const toIdx   = visibleCols.findIndex((c) => c.id === targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const newOrder = visibleCols.map((c) => c.id);
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);
      onColumnOrderChange(newOrder);
    }
    setDraggedColId(null); setDragOverColId(null);
  };
  const handleColDragEnd = () => { setDraggedColId(null); setDragOverColId(null); };

  // ── Row drag (initiated only from grip button) ─────────────────────────────
  const handleGripDragStart = (e: React.DragEvent, pageId: string) => {
    if (hasSorts || disableRowDrag) { e.preventDefault(); return; }
    const rowEl = rowRefs.current.get(pageId);
    if (rowEl) e.dataTransfer.setDragImage(rowEl, 24, rowEl.offsetHeight / 2);
    setDraggedRowId(pageId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleRowDragOver = (e: React.DragEvent, rowId: string) => {
    e.preventDefault();
    if (!draggedRowId || draggedRowId === rowId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    setDragOverRowId(rowId);
  };
  const handleRowDragLeave = (rowId: string) => {
    if (dragOverRowId === rowId) setDragOverRowId(null);
  };
  const handleRowDrop = (e: React.DragEvent, targetRowId: string) => {
    e.preventDefault();
    if (!draggedRowId || draggedRowId === targetRowId) {
      setDraggedRowId(null); setDragOverRowId(null); return;
    }
    const fromIdx = pages.findIndex((p) => p.id === draggedRowId);
    if (fromIdx !== -1) {
      // Remove the dragged item first, then find target's new position
      const newOrder = pages.map((p) => p.id);
      const [moved] = newOrder.splice(fromIdx, 1);
      let insertIdx = newOrder.findIndex((id) => id === targetRowId);
      if (insertIdx !== -1) {
        if (dropPosition === 'after') insertIdx += 1;
        newOrder.splice(insertIdx, 0, moved);
        onRowReorder(newOrder);
      }
    }
    setDraggedRowId(null); setDragOverRowId(null);
  };
  const handleRowDragEnd = () => {
    setDraggedRowId(null);
    setDragOverRowId(null);
    // Hide action bar after drag completes (mouse position is stale)
    setHoveredPageId(null);
    setActionPos(null);
  };

  // ── Hover tracking for floating action bar ─────────────────────────────────
  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setHoveredPageId(null);
      setActionPos(null);
      hideTimerRef.current = null;
    }, 120);
  };

  const handleRowMouseEnter = (e: React.MouseEvent, pageId: string) => {
    cancelHide();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Divide by zoom: visual-viewport coords → fixed-ancestor local coords.
    setHoveredPageId(pageId);
    setActionPos({
      top: rect.top / zoom,
      left: (rect.left - ACTION_BAR_WIDTH + 4) / zoom,
      height: rect.height / zoom,
    });
  };

  const handleRowMouseLeave = () => {
    if (draggedRowId || rowMenu.isOpen) return;
    scheduleHide();
  };

  const handleActionBarMouseLeave = () => {
    if (draggedRowId || rowMenu.isOpen) return;
    scheduleHide();
  };

  const showActionBar = hoveredPageId !== null && actionPos !== null;

  // Only a select or status can mark a row (a dot needs an option colour).
  const markColumn = rowColorCol
    ? schema.find((c) => c.id === rowColorCol && ['select', 'multi_select', 'status'].includes(c.type))
    : undefined;

  // The hand-placed column menus close on Escape like every other menu.
  useEffect(() => {
    if (!activeHeaderMenuColId && !toggleMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setActiveHeaderMenuColId(null);
      setHeaderMenuPos(null);
      setToggleMenuOpen(false);
      setToggleMenuPos(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeHeaderMenuColId, toggleMenuOpen]);

  return (
    <>
      <div className="flex-1 overflow-x-auto relative">
        {/* Floating Toggle Columns Button */}
        {showToggleColumnsButton && (
        <div className="absolute right-1 top-1 z-20">
          <Tooltip content={t('toggleColumns')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleToggleMenuClick}
              aria-label={t('toggleColumns')}
              aria-expanded={toggleMenuOpen}
            >
              <Plus />
            </Button>
          </Tooltip>
        </div>
        )}

        <table
          className="text-left text-ui border-collapse"
          style={{
            tableLayout: hasAnyCustomWidth ? 'fixed' : 'auto',
            width: hasAnyCustomWidth ? totalCalculatedWidth : '100%',
            minWidth: '100%'
          }}
        >
          <thead className="border-b border-line sticky top-0 z-10">
            <tr>
              {visibleCols.map((col, idx) => {
                const isOver = dragOverColId === col.id;
                const isDraggingThis = draggedColId === col.id;
                const isLast = idx === visibleCols.length - 1;
                return (
                  <th
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleColDragStart(e, col.id)}
                    onDragOver={(e) => handleColDragOver(e, col.id)}
                    onDragLeave={() => handleColDragLeave(col.id)}
                    onDrop={(e) => handleColDrop(e, col.id)}
                    onDragEnd={handleColDragEnd}
                    style={{
                      width: localWidths[col.id],
                      minWidth: col.id === 'title' ? 180 : 100
                    }}
                    className={`group py-1.5 px-2 font-normal whitespace-nowrap cursor-grab active:cursor-grabbing transition-colors relative
                      ${!isLast ? 'border-r border-line/60' : ''}
                      ${isOver ? 'border-l-2 border-l-signal' : ''}
                      ${isDraggingThis ? 'opacity-25' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => handleHeaderClick(e, col.id)}
                        className={`flex min-w-0 items-center gap-1.5 overflow-hidden rounded px-1.5 py-0.5 transition-colors cursor-pointer hover:bg-hover ${
                          activeHeaderMenuColId === col.id ? 'bg-hover' : ''
                        }`}
                        title={t('columnOptions')}
                        aria-haspopup="menu"
                        aria-expanded={activeHeaderMenuColId === col.id}
                      >
                        {getPropertyIcon(col.type)}
                        <span className="truncate text-xs text-fg-3 transition-colors group-hover:text-fg-2">
                          {col.name}
                        </span>
                        {(filters ?? []).some((f) => f.columnId === col.id) && (
                          <Filter size={12} className="text-signal-text shrink-0" aria-label={t('filter')} />
                        )}
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 text-fg-4 cursor-grab transition-opacity pl-1" aria-hidden>
                        <GripHorizontal size={12} />
                      </div>
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-signal/40 active:bg-signal cursor-col-resize z-20 transition-colors"
                      title={t('resizePanel')}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="py-16 text-center text-fg-3 text-sm">
                  {t('noPages')}
                </td>
              </tr>
            ) : (
              pages.map((page) => {
                const isRowEditing = editingCell?.pageId === page.id;
                return (
                <tr
                  key={page.id}
                  data-row-id={page.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(page.id, el);
                    else rowRefs.current.delete(page.id);
                  }}
                  onClick={() => onRowClick(page.id)}
                  onContextMenu={(e) => rowMenu.open(e, buildRowMenu(page.id))}
                  onMouseEnter={(e) => handleRowMouseEnter(e, page.id)}
                  onMouseLeave={handleRowMouseLeave}
                  onDragOver={(e) => handleRowDragOver(e, page.id)}
                  onDragLeave={() => handleRowDragLeave(page.id)}
                  onDrop={(e) => handleRowDrop(e, page.id)}
                  // A plain row: no status tint. The row's mark (if the view sets one)
                  // is a dot or status ring before the title.
                  className={[
                    'hover:bg-hover/50 cursor-pointer transition-colors group',
                    isRowEditing ? 'relative z-20' : '',
                    draggedRowId === page.id ? 'opacity-25' : '',
                    dragOverRowId === page.id && dropPosition === 'before'
                      ? 'border-t-2 border-t-signal border-b border-line'
                      : dragOverRowId === page.id && dropPosition === 'after'
                      ? 'border-b-2 border-b-signal'
                      : 'border-b border-line',
                  ].join(' ')}
                >
                  {visibleCols.map((col, idx) => {
                    const val = page.properties[col.id];
                    const isLast = idx === visibleCols.length - 1;
                    const isEditing = editingCell?.pageId === page.id && editingCell?.colId === col.id;
                    const isChecked = val === true || val === 'true';
                    const handleCellClick = (e: React.MouseEvent) => {
                      // Touch: let the click bubble to the row → opens the peek modal.
                      // `id` columns show the row's real (immutable) primary key — never editable.
                      if (col.id === 'title' || col.type === 'id' || isCoarsePointer) return;
                      e.stopPropagation();
                      // A checkbox needs no editor: the cell is the toggle.
                      if (col.type === 'checkbox') {
                        handleCellSave(page.id, col.id, !isChecked);
                        return;
                      }
                      setEditingCell({ pageId: page.id, colId: col.id });
                    };
                    return (
                      <td
                        key={col.id}
                        onClick={handleCellClick}
                        className={`py-1.5 px-2.5 whitespace-nowrap overflow-hidden relative text-ellipsis
                          ${isEditing ? 'z-30 overflow-visible' : ''}
                          ${!isLast ? 'border-r border-line/60' : ''}
                        `}
                      >
                        {isEditing ? (
                          <InlineCellEditor
                            column={col}
                            value={val}
                            onSave={(newVal) => handleCellSave(page.id, col.id, newVal)}
                            onClose={() => setEditingCell(null)}
                            onCreateOption={
                              col.type === 'select' || col.type === 'multi_select'
                                ? (v) => handleCreateOption(col.id, v)
                                : undefined
                            }
                          />
                        ) : col.id === 'title' ? (
                          <div className="flex items-center gap-2 overflow-hidden">
                            {markColumn && <MarkDot column={markColumn} value={page.properties[markColumn.id]} />}
                            <div className="relative shrink-0 select-none">
                              <button
                                type="button"
                                ref={(el) => { itemRefs.current[page.id] = el; }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                                }}
                                className="hover:bg-hover p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer"
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
                                  onSelect={(newIcon, newColor) => handleTableIconSelect(page.id, newIcon, newColor)}
                                  onClose={() => setActiveIconPickerPageId(null)}
                                  anchorRef={{ current: itemRefs.current[page.id] }}
                                />
                              )}
                            </div>
                            <span
                              onClick={(e) => {
                                // Touch: don't rename — let it bubble to the row → peek modal.
                                if (isCoarsePointer) return;
                                e.stopPropagation();
                                setEditingCell({ pageId: page.id, colId: col.id });
                              }}
                              className="font-medium text-fg cursor-text hover:underline decoration-line-strong underline-offset-2 truncate"
                            >
                              {val || tPage('untitled')}
                            </span>
                            <RecurringBadge seriesId={page.seriesId} detached={page.seriesDetached} />
                            {page.agentEditedAt && (
                              <AgentEditBadge
                                agentName={page.agentName ?? null}
                                tokenName={page.agentTokenName ?? null}
                                editedAt={page.agentEditedAt}
                                className="shrink-0"
                              />
                            )}
                          </div>
                        ) : col.type === 'id' ? (
                          <span className="text-2xs font-mono text-fg-3 truncate select-text" title={page.id}>{page.id}</span>
                        ) : col.type === 'select' ? (
                          val ? <OptionChip value={val} options={col.options} /> : null
                        ) : col.type === 'multi_select' ? (
                          Array.isArray(val) && val.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                              {val.map((optVal: string) => <OptionChip key={optVal} value={optVal} options={col.options} />)}
                            </span>
                          ) : null
                        ) : col.type === 'status' ? (
                          val ? <StatusChip value={val} options={col.options} /> : null
                        ) : col.type === 'user' ? (
                          val ? <UserChip userId={String(val)} /> : null
                        ) : col.type === 'multi_user' ? (
                          Array.isArray(val) && val.length > 0 ? <UserTags value={val} /> : null
                        ) : (col.type === 'date' || col.type === 'datetime') ? (
                          val ? <span className="text-fg-2">{formatDateValue(val, col.type, col.dateFormat, locale)}</span> : null
                        ) : col.type === 'checkbox' ? (
                          // The cell's own click toggles it; the box only shows the state
                          // (so a touch tap still opens the row, like every other cell).
                          <Checkbox checked={isChecked} aria-label={col.name} tabIndex={-1} className="pointer-events-none align-middle" />
                        ) : col.type === 'url' ? (
                          (() => {
                            const safeHref = typeof val === 'string' && /^https?:\/\//i.test(val) ? val : null;
                            return safeHref ? (
                              <a
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-link hover:underline underline-offset-2 flex items-center gap-1 truncate"
                              >
                                <span className="truncate">{val}</span>
                                <ExternalLink size={12} className="shrink-0" />
                              </a>
                            ) : val ? <span className="text-fg-2 truncate">{val}</span> : null;
                          })()
                        ) : col.type === 'email' ? (
                          val ? (
                            <a
                              href={`mailto:${val}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-link hover:underline underline-offset-2 truncate"
                            >
                              {val}
                            </a>
                          ) : null
                        ) : (
                          <span className="text-fg-2">{val || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
            {/* Only when the caller can actually create a row. The dashboard
                embed passes no handler, and a "New" row that quietly did
                nothing would be worse than no row at all. */}
            {pages.length > 0 && onCreatePage && (
              <tr
                onClick={() => onCreatePage()}
                className="hover:bg-hover/50 cursor-pointer text-fg-3 hover:text-fg transition-colors border-b border-line"
              >
                <td colSpan={visibleCols.length} className="py-1.5 px-2.5 text-ui">
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} />
                    {t('new')}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating grip — position: fixed bypasses all overflow clipping. Drag it
          to reorder; click it for the row menu (the same one as a right-click). */}
      {showActionBar && (
        <div
          data-action-bar
          className="fixed z-30 flex items-center justify-center bg-sheet py-1 px-1"
          style={{
            top: actionPos!.top,
            left: actionPos!.left,
            width: ACTION_BAR_WIDTH,
            height: actionPos!.height,
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={handleActionBarMouseLeave}
        >
          <button
            type="button"
            draggable={!hasSorts && !disableRowDrag}
            onDragStart={(e) => {
              e.stopPropagation();
              if (hoveredPageId) handleGripDragStart(e, hoveredPageId);
            }}
            onDragEnd={handleRowDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              if (hoveredPageId) rowMenu.open(e, buildRowMenu(hoveredPageId));
            }}
            className={`text-fg-3 hover:text-fg hover:bg-hover transition-colors rounded flex items-center justify-center cursor-pointer ${
              hasSorts || disableRowDrag ? '' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{ width: 22, height: 24 }}
            title={hasSorts || disableRowDrag ? t('dragMove') : t('dragReorder')}
            aria-label={hasSorts || disableRowDrag ? t('dragMove') : t('dragReorder')}
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}

      {/* Column menu — hand-placed (it holds form fields, which a Base UI menu
          would steal the keys from), in the DropdownMenu look. */}
      {activeHeaderMenuColId && headerMenuPos && (() => {
        const activeSort = sorts.find((s) => s.columnId === activeHeaderMenuColId);
        const activeFilter = filters.find((f) => f.columnId === activeHeaderMenuColId);
        const opDef = activeFilter ? OPERATORS.find((o) => o.value === activeFilter.operator) : undefined;
        const colSchema = schema.find((c) => c.id === activeHeaderMenuColId);
        return (
        <>
          <div className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={closeHeaderMenu} />
          <div
            role="menu"
            className={`fixed z-50 w-60 text-left animate-scale-in ${MENU_SURFACE}`}
            style={{ left: headerMenuPos.x, top: headerMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" role="menuitemradio" aria-checked={activeSort?.direction === 'asc'} onClick={() => handleSortCol(activeHeaderMenuColId, 'asc')} className={menuItem()}>
              <span className={MENU_ICON}><ArrowUp /></span>
              <span className="flex-1">{t('sortAscending')}</span>
              {activeSort?.direction === 'asc' && <Check size={16} className="text-fg" />}
            </button>
            <button type="button" role="menuitemradio" aria-checked={activeSort?.direction === 'desc'} onClick={() => handleSortCol(activeHeaderMenuColId, 'desc')} className={menuItem()}>
              <span className={MENU_ICON}><ArrowDown /></span>
              <span className="flex-1">{t('sortDescending')}</span>
              {activeSort?.direction === 'desc' && <Check size={16} className="text-fg" />}
            </button>
            {activeSort && (
              <button type="button" role="menuitem" onClick={() => handleRemoveSort(activeHeaderMenuColId)} className={menuItem()}>
                <span className={MENU_ICON}><X /></span>
                {t('removeSort')}
              </button>
            )}

            {(activeHeaderMenuColId !== 'title' || localWidths[activeHeaderMenuColId] !== undefined) && (
              <div className={MENU_SEPARATOR} />
            )}
            {/* The title column can't be hidden — every row needs a name to open by. */}
            {activeHeaderMenuColId !== 'title' && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggleHideColumn(activeHeaderMenuColId);
                  closeHeaderMenu();
                }}
                className={menuItem()}
              >
                <span className={MENU_ICON}><EyeOff /></span>
                {t('hideColumn')}
              </button>
            )}
            {localWidths[activeHeaderMenuColId] !== undefined && (
              <button type="button" role="menuitem" onClick={() => handleResetColWidth(activeHeaderMenuColId)} className={menuItem()}>
                <span className={MENU_ICON}><RotateCcw /></span>
                {t('resetWidth')}
              </button>
            )}

            <div className={MENU_SEPARATOR} />
            {activeFilter ? (
              <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">
                <div className={`${MENU_LABEL} px-1`}>{t('filter')}</div>
                <div className="flex items-center gap-1">
                  <SimpleSelect
                    value={activeFilter.operator}
                    onValueChange={(v) => handleUpdateFilter(activeFilter.id, { operator: v as FilterOperator })}
                    options={OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
                    size="sm"
                    className="min-w-0 flex-1 shrink"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteFilter(activeFilter.id)}
                    aria-label={t('remove')}
                    title={t('remove')}
                    className="shrink-0 hover:text-red-400"
                  >
                    <X />
                  </Button>
                </div>
                {opDef?.needsValue && (
                  <FilterValueField
                    filter={activeFilter}
                    column={colSchema}
                    onChange={(value) => handleUpdateFilter(activeFilter.id, { value })}
                  />
                )}
              </div>
            ) : (
              <button type="button" role="menuitem" onClick={() => handleAddFilter(activeHeaderMenuColId)} className={menuItem()}>
                <span className={MENU_ICON}><Filter /></span>
                {t('addFilter')}
              </button>
            )}
          </div>
        </>
        );
      })()}

      {/* Toggle Columns Popover */}
      {toggleMenuOpen && toggleMenuPos && (
        <>
          <div className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={closeToggleMenu} />
          <div
            className={`fixed z-50 w-60 text-left animate-scale-in ${MENU_SURFACE}`}
            style={{ left: toggleMenuPos.x, top: toggleMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={MENU_LABEL}>{t('toggleColumns')}</div>
            <div className="max-h-64 overflow-y-auto flex flex-col">
              {schema.map((c) => {
                const isHidden = hiddenColumns.includes(c.id);
                const isTitleCol = c.id === 'title';
                return (
                  <label
                    key={c.id}
                    className={`${menuItem()} ${isTitleCol ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className={MENU_ICON}>{getPropertyIcon(c.type)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <Checkbox
                      size="sm"
                      checked={!isHidden}
                      disabled={isTitleCol}
                      onCheckedChange={() => onToggleHideColumn(c.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
      {confirmDeleteId && (
        <ConfirmDialog
          title={t('deletePageConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={() => { onDeletePage(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {rowMenu.node}
    </>
  );
}
