'use client';

import { useRef, useState } from 'react';
import { getOptionColorByValue, formatDateValue } from '@/lib/types/properties';
import InlineCellEditor from './InlineCellEditor';
import { GripHorizontal, GripVertical, Settings, Trash2, Type, List, Hash, AlignLeft, Calendar, Clock, Tags, Plus, Copy, EyeOff, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import type { ViewFilter, ViewSort, FilterOperator } from '@/lib/types/views';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import { updatePageIcon } from '@/lib/actions/page';
import { useRouter } from 'next/navigation';

function getPropertyIcon(type: string) {
  switch (type) {
    case 'text':         return <Type size={11} className="text-neutral-600" />;
    case 'select':       return <List size={11} className="text-neutral-600" />;
    case 'multi_select': return <Tags size={11} className="text-neutral-600" />;
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
}: {
  database: any;
  pages: any[];
  columnOrder: string[];
  hiddenColumns: string[];
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
}) {
  const schema: any[] = database.schema ?? [];
  const visibleCols = getVisibleColumns(schema, columnOrder, hiddenColumns);
  const router = useRouter();

  const [editingCell, setEditingCell] = useState<{ pageId: string; colId: string } | null>(null);
  const [activeIconPickerPageId, setActiveIconPickerPageId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleTableIconSelect = async (pageId: string, newIcon: string | null, newColor: string | null) => {
    await updatePageIcon(pageId, newIcon, newColor);
    router.refresh();
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
    setHoveredPageId(pageId);
    setActionPos({ top: rect.top, left: rect.left - ACTION_BAR_WIDTH + 4, height: rect.height });
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
      setMenuPos({ x: rect.left, y: rect.bottom + 4 });
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
    if (confirm('Are you sure you want to delete this page?')) {
      onDeletePage(activeMenuRowId);
    }
    closeMenu();
  };

  // Show action bar while dropdown is open even if hover state drifted
  const showActionBar = (hoveredPageId !== null || activeMenuRowId !== null) && actionPos !== null;

  return (
    <>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
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
                    className={`group py-2 px-3 font-medium whitespace-nowrap cursor-grab active:cursor-grabbing transition-colors w-48
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
                        <span className="truncate text-neutral-600 group-hover:text-neutral-400 text-xs uppercase tracking-wider transition-colors">
                          {col.name}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-40 text-neutral-600 cursor-grab transition-opacity pl-1">
                        <GripHorizontal size={11} />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="py-16 text-center text-neutral-600 text-sm">
                  No pages yet. Use &quot;New&quot; to get started.
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
                  onMouseEnter={(e) => handleRowMouseEnter(e, page.id)}
                  onMouseLeave={(e) => handleRowMouseLeave(e, page.id)}
                  onDragOver={(e) => handleRowDragOver(e, page.id)}
                  onDragLeave={() => handleRowDragLeave(page.id)}
                  onDrop={(e) => handleRowDrop(e, page.id)}
                  className={[
                    'hover:bg-neutral-800/20 cursor-pointer transition-colors',
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
                      if (col.id === 'title') return;
                      e.stopPropagation();
                      setEditingCell({ pageId: page.id, colId: col.id });
                    };
                    return (
                      <td
                        key={col.id}
                        onClick={handleCellClick}
                        className={`py-2 px-3 whitespace-nowrap overflow-visible relative text-ellipsis
                          ${isEditing ? 'z-30' : ''}
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
                          <div className="flex items-center gap-2 overflow-visible">
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
                                e.stopPropagation();
                                setEditingCell({ pageId: page.id, colId: col.id });
                              }}
                              className="font-medium text-neutral-200 hover:text-white cursor-text hover:underline truncate"
                            >
                              {val || 'Untitled'}
                            </span>
                          </div>
                        ) : col.type === 'select' ? (
                          val ? (() => {
                            const c = getOptionColorByValue(col.options || [], val);
                            return (
                              <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: c.bg, color: c.text }}>
                                {val}
                              </span>
                            );
                          })() : (
                            <span className="text-neutral-700">—</span>
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
                              <span className="text-neutral-700">—</span>
                            )}
                          </span>
                        ) : (col.type === 'date' || col.type === 'datetime') ? (
                          <span className="text-xs text-neutral-400">{val ? formatDateValue(val, col.type, col.dateFormat) : '—'}</span>
                        ) : (
                          <span className="text-neutral-500">{val || ''}</span>
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
            className={`text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors rounded flex items-center justify-center ${
              hasSorts ? 'cursor-not-allowed opacity-30' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{ width: 22, height: 24 }}
            title={hasSorts ? 'Page actions (Sorting is active — cannot reorder)' : 'Drag to reorder or click for actions'}
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
              <span>Duplicate page</span>
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete page</span>
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
                        Sort Ascending (A → Z)
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
                        Sort Descending (Z → A)
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
                      {opDef?.needsValue && (
                        <input
                          type="text"
                          value={activeFilter.value}
                          onChange={(e) => handleUpdateFilter(activeFilter.id, { value: e.target.value })}
                          placeholder="Filter value…"
                          className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs py-1 px-2 rounded outline-none w-full focus:border-neutral-700 font-sans"
                        />
                      )}
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

            {/* Toggle Columns Visibility section */}
            <div className="px-1 pt-1">
              <div className="px-2 py-1 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Toggle Columns
              </div>
              <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 mt-0.5">
                {schema.map((c) => {
                  const isHidden = hiddenColumns.includes(c.id);
                  const isTitleCol = c.id === 'title';
                  return (
                    <button
                      key={c.id}
                      onClick={() => !isTitleCol && onToggleHideColumn(c.id)}
                      disabled={isTitleCol}
                      className={`w-full px-2 py-1 text-xs flex items-center justify-between text-neutral-300 hover:bg-neutral-800 transition-colors rounded ${
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
    </>
  );
}
