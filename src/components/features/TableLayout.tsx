'use client';

import { useRef, useState } from 'react';
import { GripHorizontal, GripVertical, Settings, Trash2, Type, List, Hash, AlignLeft, Calendar, Clock, Tags } from 'lucide-react';

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

function formatDate(val: string) {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDatetime(val: string) {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime())
    ? val
    : d.toLocaleString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
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

const ACTION_BAR_WIDTH = 58;

export default function TableLayout({
  database,
  pages,
  columnOrder,
  hiddenColumns,
  onColumnOrderChange,
  onRowClick,
  onRowReorder,
  onDeletePage,
  hasSorts,
}: {
  database: any;
  pages: any[];
  columnOrder: string[];
  hiddenColumns: string[];
  onColumnOrderChange: (order: string[]) => void;
  onRowClick: (pageId: string) => void;
  onRowReorder: (orderedIds: string[]) => void;
  onDeletePage: (pageId: string) => void;
  hasSorts: boolean;
}) {
  const schema: any[] = database.schema ?? [];
  const visibleCols = getVisibleColumns(schema, columnOrder, hiddenColumns);

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
    setActionPos({ top: rect.top, left: rect.left - ACTION_BAR_WIDTH, height: rect.height });
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
                      <div className="flex items-center gap-1.5 overflow-hidden">
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
              pages.map((page) => (
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
                    return (
                      <td
                        key={col.id}
                        className={`py-2 px-3 whitespace-nowrap overflow-hidden text-ellipsis
                          ${!isLast ? 'border-r border-neutral-800/40' : ''}
                        `}
                      >
                        {col.id === 'title' ? (
                          <span className="font-medium text-neutral-200">{val || 'Untitled'}</span>
                        ) : col.type === 'select' ? (
                          <span className={`text-xs ${val ? 'text-neutral-400' : 'text-neutral-700'}`}>
                            {val || '—'}
                          </span>
                        ) : col.type === 'multi_select' ? (
                          <span className="flex flex-wrap gap-1">
                            {Array.isArray(val) && val.length > 0 ? (
                              val.map((opt: string) => (
                                <span key={opt} className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700/50">
                                  {opt}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-700">—</span>
                            )}
                          </span>
                        ) : col.type === 'date' ? (
                          <span className="text-xs text-neutral-400">{val ? formatDate(val) : '—'}</span>
                        ) : col.type === 'datetime' ? (
                          <span className="text-xs text-neutral-400">{val ? formatDatetime(val) : '—'}</span>
                        ) : (
                          <span className="text-neutral-500">{val || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Floating action bar — position: fixed bypasses all overflow clipping */}
      {showActionBar && (
        <div
          data-action-bar
          className="fixed z-30 flex items-center justify-end gap-0.5 pr-1"
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
            onClick={handleMenuToggle}
            className="p-1 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded-sm"
            title="Page actions"
          >
            <Settings size={12} />
          </button>
          <button
            draggable={!hasSorts}
            onDragStart={(e) => {
              e.stopPropagation();
              const pid = hoveredPageId ?? activeMenuRowId;
              if (pid) handleGripDragStart(e, pid);
            }}
            onDragEnd={handleRowDragEnd}
            className={`p-1 text-neutral-600 hover:text-neutral-400 transition-colors rounded-sm ${
              hasSorts ? 'cursor-not-allowed opacity-30' : 'cursor-grab active:cursor-grabbing'
            }`}
            title={hasSorts ? 'Sorting is active — cannot reorder' : 'Drag to reorder'}
          >
            <GripVertical size={12} />
          </button>
        </div>
      )}

      {/* Dropdown — also fixed to bypass overflow clipping */}
      {activeMenuRowId && menuPos && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={closeMenu} />
          <div
            className="fixed z-50 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-36"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
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
    </>
  );
}
