'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPage, getPage, deletePage, reorderPages, updatePageProperties } from '@/lib/actions/page';
import { updateDatabaseViews } from '@/lib/actions/database';
import { Plus, Settings, Columns3, Filter, ArrowUpDown, X, Maximize2, Database } from 'lucide-react';
import TableLayout from './TableLayout';
import KanbanBoard from './KanbanBoard';
import ViewsBar from './ViewsBar';
import DatabasePropertiesSidebar from './DatabasePropertiesSidebar';
import PageEditor from './PageEditor';
import type {
  DatabaseView,
  TableViewConfig,
  KanbanViewConfig,
  ViewFilter,
  ViewSort,
} from '@/lib/types/views';

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

function defaultTableView(name = 'Table'): DatabaseView {
  return {
    id: uid(),
    name,
    config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [] },
  };
}

function defaultKanbanView(schema: any[], name = 'Board'): DatabaseView {
  const firstSelect = schema.find((c: any) => c.type === 'select');
  return {
    id: uid(),
    name,
    config: {
      type: 'kanban',
      groupByCol: firstSelect?.id ?? '',
      groupOrder: [],
      filters: [],
      sorts: [],
    },
  };
}

function applyFilters(pages: any[], filters: ViewFilter[], schema: any[]): any[] {
  if (!filters.length) return pages;
  return pages.filter((page) =>
    filters.every((f) => {
      const raw = page.properties[f.columnId];
      const str =
        raw == null ? '' : Array.isArray(raw) ? raw.join(' ') : String(raw);
      switch (f.operator) {
        case 'equals':       return str === f.value;
        case 'not_equals':   return str !== f.value;
        case 'contains':     return str.toLowerCase().includes(f.value.toLowerCase());
        case 'not_contains': return !str.toLowerCase().includes(f.value.toLowerCase());
        case 'is_empty':     return !raw || str === '' || (Array.isArray(raw) && !raw.length);
        case 'is_not_empty': return !!raw && str !== '' && (!Array.isArray(raw) || raw.length > 0);
        default:             return true;
      }
    })
  );
}

function applySorts(pages: any[], sorts: ViewSort[]): any[] {
  if (!sorts.length) return pages;
  return [...pages].sort((a, b) => {
    for (const s of sorts) {
      const aV = a.properties[s.columnId];
      const bV = b.properties[s.columnId];
      const aStr = aV == null ? '' : String(aV);
      const bStr = bV == null ? '' : String(bV);
      const cmp = aStr.localeCompare(bStr, 'en');
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

export default function DatabaseView({
  database,
  initialPages,
}: {
  database: any;
  initialPages: any[];
}) {
  const schema: any[] = database.schema ?? [];
  const router = useRouter();

  // Local pages state so that we can update them instantly in the UI when they are updated in peek mode
  const [localPages, setLocalPages] = useState<any[]>(() => initialPages);

  useEffect(() => {
    setLocalPages(initialPages);
  }, [initialPages]);

  // Peek states
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekPage, setPeekPage] = useState<any | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [views, setViews] = useState<DatabaseView[]>(() => {
    const saved = database.views as DatabaseView[] | null | undefined;
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return [defaultTableView()];
  });

  const [activeViewId, setActiveViewId] = useState(() => views[0].id);
  const [isAdding, setIsAdding] = useState(false);

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'properties' | 'layout'>('properties');

  const saveTimer = useRef<any>(null);

  const persistViews = useCallback(
    (next: DatabaseView[]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateDatabaseViews(database.id, next);
      }, 400);
    },
    [database.id]
  );

  const mutateViews = useCallback(
    (fn: (vs: DatabaseView[]) => DatabaseView[]) => {
      setViews((prev) => {
        const next = fn(prev);
        persistViews(next);
        return next;
      });
    },
    [persistViews]
  );

  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];
  const config = activeView.config;

  const mutateConfig = useCallback(
    (fn: (cfg: typeof config) => typeof config) => {
      mutateViews((vs) =>
        vs.map((v) =>
          v.id === activeView.id ? { ...v, config: fn(v.config) as any } : v
        )
      );
    },
    [mutateViews, activeView.id]
  );

  const processedPages = useMemo(
    () => applySorts(applyFilters(localPages, config.filters, schema), config.sorts),
    [localPages, config.filters, config.sorts, schema]
  );

  // Fetch page content when peeking a page
  useEffect(() => {
    if (!peekPageId) {
      setPeekPage(null);
      return;
    }

    let active = true;
    setIsPageLoading(true);
    getPage(peekPageId)
      .then((page) => {
        if (active) {
          setPeekPage(page);
          setIsPageLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching page:', err);
        if (active) setIsPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [peekPageId]);

  const handlePageUpdated = (updatedPage: any) => {
    // Update local state instantly so Table and Kanban update in the background
    setLocalPages((prev) =>
      prev.map((p) => (p.id === updatedPage.id ? updatedPage : p))
    );
    // Also, if the active peeked page is this page, update its cache
    setPeekPage((prev: any) => {
      if (prev && prev.id === updatedPage.id) {
        return { ...prev, ...updatedPage };
      }
      return prev;
    });
  };

  const handlePageClick = (pageId: string) => {
    const openBehavior = config.openBehavior ?? 'full';
    if (openBehavior === 'full') {
      router.push(`/db/${database.id}/${pageId}`);
    } else {
      setPeekPageId(pageId);
    }
  };

  const handleAddRow = async () => {
    setIsAdding(true);
    await createPage(database.id, 'New Page');
    setIsAdding(false);
  };

  const handleDeletePage = async (pageId: string) => {
    // Optimistic delete
    setLocalPages((prev) => prev.filter((p) => p.id !== pageId));
    // Persist
    await deletePage(pageId, database.id);
  };

  const handleRowReorder = async (orderedIds: string[]) => {
    const idMap = new Map(orderedIds.map((id, index) => [id, index]));
    const reordered = [...localPages].sort((a, b) => {
      const aIdx = idMap.has(a.id) ? idMap.get(a.id)! : Infinity;
      const bIdx = idMap.has(b.id) ? idMap.get(b.id)! : Infinity;
      return aIdx - bIdx;
    });
    setLocalPages(reordered);
    await reorderPages(database.id, orderedIds);
  };

  const handleCardReorder = async (pageId: string, targetGroupId: string, targetPageId?: string) => {
    const page = localPages.find((p) => p.id === pageId);
    if (!page) return;

    const oldVal = page.properties[kanbanConfig?.groupByCol ?? ''];
    const newVal = targetGroupId === 'Uncategorized' ? null : targetGroupId;
    const isGroupChanged = oldVal !== newVal;

    let nextPages = [...localPages];

    // 1. If group changed, update properties local state
    if (isGroupChanged) {
      nextPages = nextPages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            properties: {
              ...p.properties,
              [kanbanConfig?.groupByCol ?? '']: newVal,
            },
          };
        }
        return p;
      });
    }

    // 2. Reorder within the list if sorting is NOT active
    const hasSorts = config.sorts && config.sorts.length > 0;
    if (!hasSorts) {
      const fromIdx = nextPages.findIndex((p) => p.id === pageId);
      if (fromIdx !== -1) {
        const [moved] = nextPages.splice(fromIdx, 1);
        if (targetPageId) {
          const toIdx = nextPages.findIndex((p) => p.id === targetPageId);
          if (toIdx !== -1) {
            nextPages.splice(toIdx, 0, moved);
          } else {
            nextPages.push(moved);
          }
        } else {
          // Drop on column empty area: place at the end of the group
          const lastInGroupIdx = [...nextPages].reverse().findIndex((p) => {
            const val = p.properties[kanbanConfig?.groupByCol ?? ''];
            const group = val || 'Uncategorized';
            return group === targetGroupId;
          });
          if (lastInGroupIdx !== -1) {
            const actualIdx = nextPages.length - 1 - lastInGroupIdx;
            nextPages.splice(actualIdx + 1, 0, moved);
          } else {
            nextPages.push(moved);
          }
        }
      }
    }

    // Apply optimistic updates
    setLocalPages(nextPages);

    // 3. Persist to backend
    if (isGroupChanged) {
      const targetPage = nextPages.find((p) => p.id === pageId);
      if (targetPage) {
        await updatePageProperties(pageId, targetPage.properties);
      }
    }
    if (!hasSorts) {
      await reorderPages(database.id, nextPages.map((p) => p.id));
    }
  };

  // --- View management ---
  const handleActivate = (id: string) => setActiveViewId(id);

  const handleAddView = (type: 'table' | 'kanban') => {
    const count = views.filter((v) => v.config.type === type).length;
    const base = type === 'table' ? 'Table' : 'Board';
    const name = count === 0 ? base : `${base} ${count + 1}`;
    const newView = type === 'table' ? defaultTableView(name) : defaultKanbanView(schema, name);
    mutateViews((vs) => [...vs, newView]);
    setActiveViewId(newView.id);
  };

  const handleRenameView = (id: string, name: string) => {
    mutateViews((vs) => vs.map((v) => (v.id === id ? { ...v, name } : v)));
  };

  const handleDeleteView = (id: string) => {
    mutateViews((vs) => {
      const next = vs.filter((v) => v.id !== id);
      if (activeViewId === id) setActiveViewId(next[0]?.id ?? '');
      return next;
    });
  };

  const handleReorderViews = (nextViews: DatabaseView[]) => {
    mutateViews(() => nextViews);
  };

  // --- Config mutations ---
  const handleFiltersChange = (filters: ViewFilter[]) =>
    mutateConfig((cfg) => ({ ...cfg, filters }));

  const handleSortsChange = (sorts: ViewSort[]) =>
    mutateConfig((cfg) => ({ ...cfg, sorts }));

  const handleColumnOrderChange = (columnOrder: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, columnOrder }));

  const handleGroupByChange = (groupByCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, groupByCol }));

  const handleGroupOrderChange = (groupOrder: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, groupOrder }));

  const toggleHideColumn = (colId: string) => {
    const tc = config as TableViewConfig;
    const hidden = tc.hiddenColumns ?? [];
    const next = hidden.includes(colId)
      ? hidden.filter((c) => c !== colId)
      : [...hidden, colId];
    mutateConfig((cfg) => ({ ...cfg, hiddenColumns: next }));
  };

  const isTableView = config.type === 'table';
  const tableConfig = isTableView ? (config as TableViewConfig) : null;
  const kanbanConfig = !isTableView ? (config as KanbanViewConfig) : null;
  const selectColumns = schema.filter((c: any) => c.type === 'select');

  const handleToggleSidebar = (tab: typeof sidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setSidebarOpen(true);
    }
  };

  const handleHiddenColumnsChange = (nextHidden: string[]) => {
    mutateConfig((cfg) => ({ ...cfg, hiddenColumns: nextHidden }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-end justify-between border-b border-neutral-800">
        <ViewsBar
          views={views}
          activeViewId={activeView.id}
          onActivate={handleActivate}
          onAdd={handleAddView}
          onRename={handleRenameView}
          onDelete={handleDeleteView}
          onReorder={handleReorderViews}
        />

        <div className="flex items-center gap-0 pb-1.5">
          {/* Settings Button */}
          <button
            onClick={() => handleToggleSidebar(sidebarTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              sidebarOpen
                ? 'text-blue-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-200'
            }`}
          >
            <Settings size={13} /> Settings
          </button>

          {/* New Page button */}
          <button
            onClick={handleAddRow}
            disabled={isAdding}
            className="flex items-center gap-1.5 bg-neutral-100 text-neutral-900 hover:bg-white px-4 py-1.5 transition-colors text-sm font-medium disabled:opacity-50 ml-1 cursor-pointer"
          >
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {/* Content + Sidebar Area */}
      <div className="flex-1 flex gap-4 min-h-0 relative pt-4">
        <div className="flex-1 min-h-0 overflow-hidden">
          {isTableView && tableConfig ? (
            <TableLayout
              database={database}
              pages={processedPages}
              columnOrder={tableConfig.columnOrder}
              hiddenColumns={tableConfig.hiddenColumns}
              onColumnOrderChange={handleColumnOrderChange}
              onRowClick={handlePageClick}
              onRowReorder={handleRowReorder}
              onDeletePage={handleDeletePage}
              hasSorts={(config.sorts?.length ?? 0) > 0}
            />
          ) : kanbanConfig ? (
            <KanbanBoard
              database={database}
              pages={processedPages}
              groupByCol={kanbanConfig.groupByCol}
              groupOrder={kanbanConfig.groupOrder}
              onGroupOrderChange={handleGroupOrderChange}
              onCardClick={handlePageClick}
              onCardMove={handleCardReorder}
              onDeletePage={handleDeletePage}
              hasSorts={(config.sorts?.length ?? 0) > 0}
            />
          ) : null}
        </div>

        {/* Backdrop overlay for closing the sidebar when clicking outside */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 bg-transparent z-20 cursor-default"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Panel Overlay */}
        {sidebarOpen && (
          <div className="absolute top-0 right-0 h-full z-30 shadow-2xl flex">
            <DatabasePropertiesSidebar
              database={database}
              activeView={activeView}
              activeTab={sidebarTab}
              setActiveTab={setSidebarTab}
              onClose={() => setSidebarOpen(false)}
              columnOrder={tableConfig?.columnOrder ?? []}
              hiddenColumns={tableConfig?.hiddenColumns ?? []}
              onToggleHideColumn={toggleHideColumn}
              onHiddenColumnsChange={handleHiddenColumnsChange}
              filters={config.filters}
              sorts={config.sorts}
              onFiltersChange={handleFiltersChange}
              onSortsChange={handleSortsChange}
              openBehavior={config.openBehavior ?? 'full'}
              onOpenBehaviorChange={(behavior) =>
                mutateConfig((cfg) => ({ ...cfg, openBehavior: behavior }))
              }
              groupByCol={kanbanConfig?.groupByCol}
              onGroupByColChange={handleGroupByChange}
            />
          </div>
        )}
      </div>

      {/* Peek Overlay & Container (Center / Side Peek) */}
      {peekPageId && (
        <>
          {/* Dark Glassmorphism Backdrop */}
          <div
            onClick={() => setPeekPageId(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-fade-in transition-opacity cursor-pointer animate-duration-200"
          />

          {/* Center Peek Modal */}
          {(config.openBehavior ?? 'full') === 'center' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
              <div className="relative w-full max-w-4xl max-h-[85vh] md:max-h-[90vh] bg-neutral-950 border border-neutral-800 flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden rounded-none pointer-events-auto animate-scale-in">
                {/* Peek Sticky Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-850 shrink-0 bg-neutral-900/30">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPeekPageId(null)}
                      className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                    <span className="text-[11px] bg-neutral-800 text-neutral-400 font-medium py-0.5 px-2 border border-neutral-700/40 uppercase tracking-wider rounded-none">
                      Center Peek
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        router.push(`/db/${database.id}/${peekPageId}`);
                        setPeekPageId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-2.5 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded-none"
                    >
                      <Maximize2 size={12} />
                      <span>Open in full page</span>
                    </button>
                  </div>
                </div>

                {/* Peek Editor Scrollable Content */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-950">
                  {isPageLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-2 animate-fade-in">
                      <div className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" />
                      <span className="text-xs">Loading page...</span>
                    </div>
                  ) : (
                    peekPage && (
                      <PageEditor
                        database={database}
                        initialPage={peekPage}
                        isPeek={true}
                        onClose={() => setPeekPageId(null)}
                        onPageUpdated={handlePageUpdated}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Side Peek Drawer */}
          {(config.openBehavior ?? 'full') === 'side' && (
            <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-neutral-950 border-l border-neutral-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden rounded-none animate-slide-in-right">
              {/* Peek Sticky Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-850 shrink-0 bg-neutral-900/30">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPeekPageId(null)}
                    className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                  <span className="text-[11px] bg-neutral-800 text-neutral-400 font-medium py-0.5 px-2 border border-neutral-700/40 uppercase tracking-wider rounded-none">
                    Side Peek
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      router.push(`/db/${database.id}/${peekPageId}`);
                      setPeekPageId(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-2.5 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded-none"
                  >
                    <Maximize2 size={12} />
                    <span>Open in full page</span>
                  </button>
                </div>
              </div>

              {/* Peek Editor Scrollable Content */}
              <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-950">
                {isPageLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-2 animate-fade-in">
                    <div className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" />
                    <span className="text-xs">Loading page...</span>
                  </div>
                ) : (
                  peekPage && (
                    <PageEditor
                      database={database}
                      initialPage={peekPage}
                      isPeek={true}
                      onClose={() => setPeekPageId(null)}
                      onPageUpdated={handlePageUpdated}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
