'use client';

import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { getOptionColorByValue, formatDateValue, normalizeOption, type SelectOption } from '@/lib/types/properties';
import { useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';
import InlineCellEditor from './InlineCellEditor';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { StatusChip, UserChip, UserTags } from './PropertyTags';
import { GripHorizontal, GripVertical, Settings, Trash2, Type, List, Hash, AlignLeft, Calendar, Clock, Tags, CircleDashed, User, Users, Plus, Copy, EyeOff, ArrowUp, ArrowDown, Filter, X, RotateCcw, CheckSquare, Square, ExternalLink, ArrowUpRight, Maximize2, Link2 } from 'lucide-react';
import type { ViewFilter, ViewSort, FilterOperator } from '@/lib/types/views';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import { updatePageIcon } from '@/lib/actions/page';
import { ConfirmDialog } from './ConfirmDialog';

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
  switch (type) {
    case 'text':         return <Type size={11} className="text-neutral-600" />;
    case 'select':       return <List size={11} className="text-neutral-600" />;
    case 'multi_select': return <Tags size={11} className="text-neutral-600" />;
    case 'status':       return <CircleDashed size={11} className="text-neutral-600" />;
    case 'user':         return <User size={11} className="text-neutral-600" />;
    case 'multi_user':   return <Users size={11} className="text-neutral-600" />;
    case 'number':       return <Hash size={11} className="text-neutral-600" />;
    case 'date':         return <Calendar size={11} className="text-neutral-600" />;
    case 'datetime':     return <Clock size={11} className="text-neutral-600" />;
    default:             return <AlignLeft size={11} className="text-neutral-600" />;
  }
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
}: {
  database: any;
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
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const zoom = useZoom();
  const router = useRouter();
  const schema: any[] = database.schema ?? [];
  const visibleCols = getVisibleColumns(schema, columnOrder, hiddenColumns);

  const [localWidths, setLocalWidths] = useState<Record<string, number>>(() => columnWidths ?? {});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Notion-style right-click menu for rows
  const rowMenu = useContextMenu();
  const buildRowMenu = (pageId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onRowClick(pageId) },
    { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
    { kind: 'separator' },
    { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
    { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => setConfirmDeleteId(pageId) },
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

  const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
    { value: 'contains',     label: 'contains',        needsValue: true  },
    { value: 'not_contains', label: "doesn't contain", needsValue: true  },
    { value: 'equals',       label: 'is',              needsValue: true  },
    { value: 'not_equals',   label: 'is not',          needsValue: true  },
    { value: 'is_empty',     label: 'is empty',        needsValue: false },
    { value: 'is_not_empty', label: 'is not empty',    needsValue: false },
  ];

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
      const menuWidth = 180;
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

  // Column DnD
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Row DnD — only the grip button is draggable; <tr> elements are drop targets
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Floating action bar — tracked via mouse position at row hover
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);
  const [actionPos, setActionPos] = useState<{ top: number; left: number; height: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings dropdown
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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
    if (hasSorts) { e.preventDefault(); return; }
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

  const handleRowMouseLeave = (_e: React.MouseEvent, pageId: string) => {
    if (draggedRowId) return;
    if (activeMenuRowId === pageId) return;
    scheduleHide();
  };

  const handleActionBarMouseLeave = () => {
    if (draggedRowId || activeMenuRowId) return;
    scheduleHide();
  };

  // ── Settings menu ──────────────────────────────────────────────────────────
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageId = hoveredPageId;
    if (!pageId) return;
    if (activeMenuRowId === pageId) {
      setActiveMenuRowId(null);
      setMenuPos(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuPos({ x: rect.left / zoom, y: rect.bottom / zoom + 4 });
      setActiveMenuRowId(pageId);
    }
  };

  const closeMenu = () => {
    setActiveMenuRowId(null);
    setMenuPos(null);
    setHoveredPageId(null);
    setActionPos(null);
  };

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeMenuRowId) return;
    setConfirmDeleteId(activeMenuRowId);
    closeMenu();
  };

  // Show action bar while dropdown is open even if hover state drifted
  const showActionBar = (hoveredPageId !== null || activeMenuRowId !== null) && actionPos !== null;

  return (
    <>
      <div className="flex-1 overflow-x-auto relative">
        {/* Floating Toggle Columns Button */}
        <div className="absolute right-2 top-1 z-20">
          <button
            onClick={handleToggleMenuClick}
            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 rounded transition-colors cursor-pointer"
            title="Toggle Columns"
          >
            <Plus size={14} />
          </button>
        </div>

        <table
          className="text-left text-sm border-collapse"
          style={{
            tableLayout: hasAnyCustomWidth ? 'fixed' : 'auto',
            width: hasAnyCustomWidth ? totalCalculatedWidth : '100%',
            minWidth: '100%'
          }}
        >
          <thead className="border-b border-neutral-800/60 sticky top-0 z-10">
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
                    className={`group py-2 px-3 font-medium whitespace-nowrap cursor-grab active:cursor-grabbing transition-colors relative
                      ${!isLast ? 'border-r border-neutral-800/40' : ''}
                      ${isOver ? 'border-l-2 border-l-blue-500/60' : ''}
                      ${isDraggingThis ? 'opacity-25' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={(e) => handleHeaderClick(e, col.id)}
                        className="flex items-center gap-1.5 overflow-hidden cursor-pointer hover:bg-neutral-800/30 px-1.5 py-0.5 rounded transition-colors"
                        title="Click for options (sort, filter, hide)"
                      >
                        {getPropertyIcon(col.type)}
                        <span className="truncate text-neutral-400 group-hover:text-neutral-200 text-xs uppercase tracking-wider transition-colors">
                          {col.name}
                        </span>
                        {(filters ?? []).some((f) => f.columnId === col.id) && (
                          <Filter size={10} className="text-blue-500 shrink-0" />
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-40 text-neutral-600 cursor-grab transition-opacity pl-1">
                        <GripHorizontal size={11} />
                      </div>
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-blue-500/40 active:bg-blue-500 cursor-col-resize z-20 transition-colors"
                      title="Drag to resize"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="py-16 text-center text-neutral-600 text-sm">
                  {t('noPages')}
                </td>
              </tr>
            ) : (
              pages.map((page) => {
                const isRowEditing = editingCell?.pageId === page.id;
                const colorColSchema = rowColorCol ? schema.find((c) => c.id === rowColorCol) : null;
                const rowBgColor = colorColSchema ? (() => {
                  const val = page.properties[rowColorCol as string];
                  if (!val) return null;
                  const opts = colorColSchema.options ?? [];
                  if (colorColSchema.type === 'select') {
                    return getOptionColorByValue(opts, val).groupBg;
                  }
                  if (colorColSchema.type === 'multi_select') {
                    if (Array.isArray(val) && val.length > 0) {
                      return getOptionColorByValue(opts, val[0]).groupBg;
                    }
                  }
                  return null;
                })() : null;

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
                  onMouseLeave={(e) => handleRowMouseLeave(e, page.id)}
                  onDragOver={(e) => handleRowDragOver(e, page.id)}
                  onDragLeave={() => handleRowDragLeave(page.id)}
                  onDrop={(e) => handleRowDrop(e, page.id)}
                  style={{ backgroundColor: rowBgColor || undefined }}
                  className={[
                    'hover:bg-neutral-800/20 cursor-pointer transition-colors group',
                    isRowEditing ? 'relative z-20' : '',
                    draggedRowId === page.id ? 'opacity-25' : '',
                    dragOverRowId === page.id && dropPosition === 'before'
                      ? 'border-t-2 border-t-blue-500 border-b border-neutral-800/40'
                      : dragOverRowId === page.id && dropPosition === 'after'
                      ? 'border-b-2 border-b-blue-500'
                      : 'border-b border-neutral-800/40',
                  ].join(' ')}
                >
                  {visibleCols.map((col, idx) => {
                    const val = page.properties[col.id];
                    const isLast = idx === visibleCols.length - 1;
                    const isEditing = editingCell?.pageId === page.id && editingCell?.colId === col.id;
                    const handleCellClick = (e: React.MouseEvent) => {
                      // Touch: let the click bubble to the row → opens the peek modal.
                      if (col.id === 'title' || isCoarsePointer) return;
                      e.stopPropagation();
                      setEditingCell({ pageId: page.id, colId: col.id });
                    };
                    return (
                      <td
                        key={col.id}
                        onClick={handleCellClick}
                        className={`py-2 px-3 whitespace-nowrap overflow-hidden relative text-ellipsis group-hover:bg-neutral-800/10 transition-colors
                          ${isEditing ? 'z-30 overflow-visible' : ''}
                          ${!isLast ? 'border-r border-neutral-800/40' : ''}
                        `}
                      >
                        {isEditing ? (
                          <InlineCellEditor
                            column={col}
                            value={val}
                            onSave={(newVal) => handleCellSave(page.id, col.id, newVal)}
                            onClose={() => setEditingCell(null)}
                          />
                        ) : col.id === 'title' ? (
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="relative shrink-0 select-none">
                              <button
                                ref={(el) => { itemRefs.current[page.id] = el; }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                                }}
                                className="hover:bg-neutral-800 p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer"
                                title="Change icon"
                              >
                                <PageIcon 
                                  icon={page.icon || defaultPageIcon} 
                                  iconColor={page.iconColor || defaultPageIconColor} 
                                  size={14} 
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
                              className="font-medium text-neutral-100 hover:text-white cursor-text hover:underline truncate"
                            >
                              {val || tPage('untitled')}
                            </span>
                            {page.agentEditedAt && (
                              <AgentEditBadge
                                agentName={page.agentName ?? null}
                                tokenName={page.agentTokenName ?? null}
                                editedAt={page.agentEditedAt}
                                className="shrink-0 ml-1.5 p-1 rounded-md"
                              />
                            )}
                          </div>
                        ) : col.type === 'select' ? (
                          val ? (() => {
                            const c = getOptionColorByValue(col.options || [], val);
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                                {val}
                              </span>
                            );
                          })() : (
                            <span className="text-neutral-500">—</span>
                          )
                        ) : col.type === 'multi_select' ? (
                          <span className="flex flex-wrap gap-1">
                            {Array.isArray(val) && val.length > 0 ? (
                              val.map((optVal: string) => {
                                const c = getOptionColorByValue(col.options || [], optVal);
                                return (
                                  <span key={optVal} className="text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: c.bg, color: c.text }}>
                                    {optVal}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </span>
                        ) : col.type === 'status' ? (
                          val ? <StatusChip value={val} options={col.options} /> : <span className="text-neutral-500">—</span>
                        ) : col.type === 'user' ? (
                          val ? <UserChip userId={String(val)} /> : <span className="text-neutral-500">—</span>
                        ) : col.type === 'multi_user' ? (
                          Array.isArray(val) && val.length > 0 ? <UserTags value={val} /> : <span className="text-neutral-500">—</span>
                        ) : (col.type === 'date' || col.type === 'datetime') ? (
                          <span className="text-xs text-neutral-100">{val ? formatDateValue(val, col.type, col.dateFormat) : '—'}</span>
                        ) : col.type === 'checkbox' ? (
                          (val === true || val === 'true')
                            ? <CheckSquare size={14} className="text-blue-400" />
                            : <Square size={14} className="text-neutral-600" />
                        ) : col.type === 'url' ? (
                          (() => {
                            const safeHref = typeof val === 'string' && /^https?:\/\//i.test(val) ? val : null;
                            return safeHref ? (
                              <a
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 truncate"
                              >
                                <span className="truncate">{val}</span>
                                <ExternalLink size={9} className="shrink-0" />
                              </a>
                            ) : val ? <span className="text-neutral-100 truncate">{val}</span> : <span className="text-neutral-500">—</span>;
                          })()
                        ) : col.type === 'email' ? (
                          val ? (
                            <a
                              href={`mailto:${val}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-400 hover:text-blue-300 truncate"
                            >
                              {val}
                            </a>
                          ) : <span className="text-neutral-500">—</span>
                        ) : (
                          <span className="text-neutral-100">{val || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
            {pages.length > 0 && (
              <tr
                onClick={() => onCreatePage?.()}
                className="hover:bg-neutral-800/10 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors border-b border-neutral-800/40 group/newrow"
              >
                <td colSpan={visibleCols.length} className="py-2 px-3 text-xs font-medium">
                  <span className="flex items-center gap-1.5 opacity-60 group-hover/newrow:opacity-100 transition-opacity">
                    <Plus size={13} className="text-neutral-500" />
                    New
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating action bar — position: fixed bypasses all overflow clipping */}
      {showActionBar && (
        <div
          data-action-bar
          className="fixed z-30 flex items-center justify-center bg-neutral-850 rounded-none border-none py-1 px-1"
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
            draggable={!hasSorts}
            onDragStart={(e) => {
              e.stopPropagation();
              const pid = hoveredPageId ?? activeMenuRowId;
              if (pid) handleGripDragStart(e, pid);
            }}
            onDragEnd={handleRowDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              handleMenuToggle(e);
            }}
            className={`text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors rounded flex items-center justify-center cursor-pointer ${
              hasSorts ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{ width: 22, height: 24 }}
            title={hasSorts ? t('dragMove') : t('dragReorder')}
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}

      {/* Dropdown — also fixed to bypass overflow clipping */}
      {activeMenuRowId && menuPos && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={closeMenu} />
          <div
            className="fixed z-50 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-36 rounded overflow-hidden"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={() => {
                onDuplicatePage(activeMenuRowId);
                closeMenu();
              }}
              className="w-full px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
            >
              <Copy size={13} />
              <span>{t('duplicatePage')}</span>
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>{tPage('deletePage')}</span>
            </button>
          </div>
        </>
      )}
      {/* Header Column Menu Dropdown */}
      {activeHeaderMenuColId && headerMenuPos && (
        <>
          <div className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={closeHeaderMenu} />
          <div
            className="fixed z-50 bg-neutral-900 border border-neutral-800 shadow-2xl py-1.5 w-60 rounded overflow-hidden text-left"
            style={{ left: headerMenuPos.x, top: headerMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sorts section */}
            <div className="px-1 pb-1 border-b border-neutral-800/40 flex flex-col gap-0.5">
              {(() => {
                const activeSort = sorts.find((s) => s.columnId === activeHeaderMenuColId);
                return (
                  <>
                    <button
                      onClick={() => handleSortCol(activeHeaderMenuColId, 'asc')}
                      className={`w-full px-2 py-1 text-xs flex items-center justify-between text-neutral-300 hover:bg-neutral-800 transition-colors rounded ${
                        activeSort?.direction === 'asc' ? 'bg-neutral-800 font-semibold' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowUp size={13} className="text-neutral-500" />
                        {t('sortAscending')}
                      </span>
                      {activeSort?.direction === 'asc' && <span className="text-[10px] text-blue-400">✓</span>}
                    </button>
                    <button
                      onClick={() => handleSortCol(activeHeaderMenuColId, 'desc')}
                      className={`w-full px-2 py-1 text-xs flex items-center justify-between text-neutral-300 hover:bg-neutral-800 transition-colors rounded ${
                        activeSort?.direction === 'desc' ? 'bg-neutral-800 font-semibold' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowDown size={13} className="text-neutral-500" />
                        {t('sortDescending')}
                      </span>
                      {activeSort?.direction === 'desc' && <span className="text-[10px] text-blue-400">✓</span>}
                    </button>
                    {activeSort && (
                      <button
                        onClick={() => handleRemoveSort(activeHeaderMenuColId)}
                        className="w-full px-2 py-1 text-xs flex items-center gap-2 text-red-400 hover:bg-neutral-800 transition-colors rounded"
                      >
                        <X size={13} />
                        Remove Sort
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Visibility - Hide column (Only if not Title) */}
            {activeHeaderMenuColId !== 'title' && (
              <div className="px-1 py-1 border-b border-neutral-800/40">
                <button
                  onClick={() => {
                    onToggleHideColumn(activeHeaderMenuColId);
                    closeHeaderMenu();
                  }}
                  className="w-full px-2 py-1 text-xs flex items-center gap-2 text-neutral-300 hover:bg-neutral-800 transition-colors rounded"
                >
                  <EyeOff size={13} className="text-neutral-500" />
                  Hide Column
                </button>
              </div>
            )}

            {/* Reset Width section */}
            {activeHeaderMenuColId && localWidths[activeHeaderMenuColId] !== undefined && (
              <div className="px-1 py-1 border-b border-neutral-800/40">
                <button
                  onClick={() => handleResetColWidth(activeHeaderMenuColId)}
                  className="w-full px-2 py-1 text-xs flex items-center gap-2 text-neutral-300 hover:bg-neutral-800 transition-colors rounded"
                >
                  <RotateCcw size={13} className="text-neutral-500" />
                  Reset Width
                </button>
              </div>
            )}

            {/* Filter section */}
            <div className="px-3 py-2 border-b border-neutral-800/40 flex flex-col gap-1.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                <span>Filter</span>
                <Filter size={10} />
              </div>
              {(() => {
                const activeFilter = filters.find((f) => f.columnId === activeHeaderMenuColId);
                if (activeFilter) {
                  const opDef = OPERATORS.find((o) => o.value === activeFilter.operator);
                  return (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex items-center gap-1">
                        <select
                          value={activeFilter.operator}
                          onChange={(e) => handleUpdateFilter(activeFilter.id, { operator: e.target.value as FilterOperator })}
                          className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs py-1 px-2 rounded outline-none cursor-pointer flex-1 min-w-0"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteFilter(activeFilter.id)}
                          className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer p-0.5"
                          title="Delete Filter"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {opDef?.needsValue && (() => {
                        const colSchema = schema.find((c) => c.id === activeHeaderMenuColId);
                        if (colSchema && (colSchema.type === 'select' || colSchema.type === 'multi_select' || colSchema.type === 'status')) {
                          let selectedList: string[] = [];
                          if (activeFilter.value) {
                            if (activeFilter.value.startsWith('[') && activeFilter.value.endsWith(']')) {
                              try { selectedList = JSON.parse(activeFilter.value); } catch (e) { selectedList = [activeFilter.value]; }
                            } else {
                              selectedList = [activeFilter.value];
                            }
                          }

                          const toggleOption = (optVal: string) => {
                            let next: string[];
                            if (selectedList.includes(optVal)) {
                              next = selectedList.filter(v => v !== optVal);
                            } else {
                              next = [...selectedList, optVal];
                            }
                            handleUpdateFilter(activeFilter.id, { value: JSON.stringify(next) });
                          };

                          return (
                            <div className="flex flex-col gap-1 border border-neutral-800 bg-neutral-950/40 p-2 rounded max-h-36 overflow-y-auto">
                              <span className="text-[10px] text-neutral-500 font-semibold mb-1">Select Options:</span>
                              {(colSchema.options || []).map((rawOpt: string | SelectOption) => {
                                const opt = normalizeOption(rawOpt);
                                const isChecked = selectedList.includes(opt.value);
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => toggleOption(opt.value)}
                                    className="flex items-center gap-2 text-left text-xs text-neutral-300 hover:bg-neutral-800/40 px-1.5 py-1 rounded cursor-pointer transition-colors"
                                  >
                                    <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 rounded-sm transition-colors ${
                                      isChecked ? 'bg-blue-500 border-blue-500' : 'border-neutral-700'
                                    }`}>
                                      {isChecked && <span className="text-[9px] font-bold text-white leading-none">✓</span>}
                                    </span>
                                    <span className="truncate">{opt.value}</span>
                                  </button>
                                );
                              })}
                              {(colSchema.options || []).length === 0 && (
                                  <span className="text-[10px] text-neutral-600 italic">{t('noOptionsDefined')}</span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <input
                            type="text"
                            value={activeFilter.value}
                            onChange={(e) => handleUpdateFilter(activeFilter.id, { value: e.target.value })}
                            placeholder="Filter value…"
                            className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs py-1 px-2 rounded outline-none w-full focus:border-neutral-700 font-sans"
                          />
                        );
                      })()}
                    </div>
                  );
                } else {
                  return (
                    <button
                      onClick={() => handleAddFilter(activeHeaderMenuColId)}
                      className="w-full mt-1 py-1 text-xs flex items-center justify-center gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-neutral-800/40 border border-dashed border-neutral-800/80 rounded transition-colors"
                    >
                      <Plus size={11} />
                      Add Filter
                    </button>
                  );
                }
              })()}
            </div>



          </div>
        </>
      )}

      {/* Toggle Columns Popover */}
      {toggleMenuOpen && toggleMenuPos && (
        <>
          <div className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={closeToggleMenu} />
          <div
            className="fixed z-50 bg-neutral-900 border border-neutral-800 shadow-2xl py-1.5 w-48 rounded overflow-hidden text-left"
            style={{ left: toggleMenuPos.x, top: toggleMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-1 py-1">
              <div className="px-2 py-1 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Toggle Columns
              </div>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 mt-0.5">
                {schema.map((c) => {
                  const isHidden = hiddenColumns.includes(c.id);
                  const isTitleCol = c.id === 'title';
                  return (
                    <button
                      key={c.id}
                      onClick={() => !isTitleCol && onToggleHideColumn(c.id)}
                      disabled={isTitleCol}
                      className={`w-full px-2 py-1.5 text-xs flex items-center justify-between text-neutral-300 hover:bg-neutral-800 transition-colors rounded ${
                        isTitleCol ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {getPropertyIcon(c.type)}
                        <span className="truncate text-neutral-400">{c.name}</span>
                      </div>
                      <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 rounded-sm transition-colors ${
                        !isHidden ? 'bg-blue-500 border-blue-500' : 'border-neutral-700'
                      }`}>
                        {!isHidden && <span className="text-[9px] font-bold text-white leading-none">✓</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
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
