'use client';

import { useState, useMemo, useRef, useCallback, useEffect, useTransition, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createPage, getPage, deletePage, duplicatePage, reorderPages, updatePageProperties } from '@/lib/actions/page';
import { updateDatabaseViews } from '@/lib/actions/database';
import { updateWorkspaceItemIcon, updateWorkspaceItemTitle } from '@/lib/actions/workspace';
import { Plus, Settings, Columns3, Filter, ArrowUpDown, X, Maximize2, Database, ArrowLeftRight, MoreHorizontal, Trash2, Copy, ChevronLeft, RefreshCw } from 'lucide-react';
import TableLayout from './TableLayout';
import GroupedTableLayout from './GroupedTableLayout';
import { ConfirmDialog } from './ConfirmDialog';
import KanbanBoard from './KanbanBoard';
import CalendarView from './CalendarView';
import ViewsBar from './ViewsBar';
import DatabasePropertiesSidebar from './DatabasePropertiesSidebar';
import PageEditor from './PageEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import { MembersProvider, type WorkspaceMember } from './MembersContext';
import { useTabNav } from '@/components/providers/TabsContext';
import type {
  DatabaseView,
  TableViewConfig,
  KanbanViewConfig,
  CalendarViewConfig,
  ViewFilter,
  ViewSort,
} from '@/lib/types/views';
import { isTableGroupableColumn } from '@/lib/tableGrouping';

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

function formatYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Side peek drawer only gets an explicit resizable width at the `sm` breakpoint
// (640px) and up — below that it's a full-width bottom sheet. Read via
// useSyncExternalStore (not useEffect+useState) so the client value is
// available on the very first render, avoiding a one-frame width flash.
const DESKTOP_VIEWPORT_QUERY = '(min-width: 640px)';
function subscribeDesktopViewport(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(DESKTOP_VIEWPORT_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
function getDesktopViewportSnapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches;
}
function getDesktopViewportServerSnapshot() {
  return false;
}

const SIDE_PEEK_MIN_WIDTH = 420;
const SIDE_PEEK_MAX_WIDTH = 1100;
const SIDE_PEEK_DEFAULT_WIDTH = 772; // previous fixed max-w-2xl (672px) + 100px
const SIDE_PEEK_WIDTH_STORAGE_KEY = 'remnus_side_peek_width';

function defaultTableView(name = 'Table'): DatabaseView {
  return {
    id: uid(),
    name,
    config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center' },
  };
}

function defaultKanbanView(schema: any[], name = 'Board'): DatabaseView {
  const firstSelect = schema.find((c: any) => c.type === 'status') ?? schema.find((c: any) => c.type === 'select');
  return {
    id: uid(),
    name,
    config: {
      type: 'kanban',
      groupByCol: firstSelect?.id ?? '',
      groupOrder: [],
      filters: [],
      sorts: [],
      openBehavior: 'center',
    },
  };
}

function defaultCalendarView(schema: any[], name = 'Calendar'): DatabaseView {
  const firstDate = schema.find((c: any) => c.type === 'date' || c.type === 'datetime');
  return {
    id: uid(),
    name,
    config: {
      type: 'calendar',
      dateCol: firstDate?.id ?? '',
      viewMode: 'month',
      filters: [],
      sorts: [],
      openBehavior: 'center',
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

      if (f.operator === 'is_empty') {
        return !raw || str === '' || (Array.isArray(raw) && !raw.length);
      }
      if (f.operator === 'is_not_empty') {
        return !!raw && str !== '' && (!Array.isArray(raw) || raw.length > 0);
      }

      let targetValues: string[] = [];
      if (f.value) {
        if (f.value.startsWith('[') && f.value.endsWith(']')) {
          try {
            targetValues = JSON.parse(f.value);
          } catch (e) {
            targetValues = [f.value];
          }
        } else {
          targetValues = [f.value];
        }
      }

      if (targetValues.length === 0) {
        // Empty filters should usually not filter out everything, but for select lists we want it to match nothing
        return false;
      }

      switch (f.operator) {
        case 'equals': {
          if (Array.isArray(raw)) {
            return raw.some(v => targetValues.includes(String(v)));
          }
          return targetValues.includes(String(raw));
        }
        case 'not_equals': {
          if (Array.isArray(raw)) {
            return !raw.some(v => targetValues.includes(String(v)));
          }
          return !targetValues.includes(String(raw));
        }
        case 'contains': {
          if (Array.isArray(raw)) {
            return raw.some(v => targetValues.some(tv => String(v).toLowerCase().includes(tv.toLowerCase())));
          }
          return targetValues.some(tv => String(raw).toLowerCase().includes(tv.toLowerCase()));
        }
        case 'not_contains': {
          if (Array.isArray(raw)) {
            return !raw.some(v => targetValues.some(tv => String(v).toLowerCase().includes(tv.toLowerCase())));
          }
          return !targetValues.some(tv => String(raw).toLowerCase().includes(tv.toLowerCase()));
        }
        default:
          return true;
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

function getDefaultPropertiesFromFilters(filters: ViewFilter[], schema: any[]): Record<string, any> {
  const props: Record<string, any> = {};

  if (!filters || !filters.length) return props;

  // Group filters by columnId for easier merging
  const filtersByColumn: Record<string, ViewFilter[]> = {};
  for (const f of filters) {
    if (!filtersByColumn[f.columnId]) {
      filtersByColumn[f.columnId] = [];
    }
    filtersByColumn[f.columnId].push(f);
  }

  for (const [columnId, colFilters] of Object.entries(filtersByColumn)) {
    const colSchema = schema.find((c) => c.id === columnId);
    if (!colSchema) continue;

    // Find the best filter to use for default value
    // Prioritize 'equals', then 'contains'
    const equalsFilter = colFilters.find((f) => f.operator === 'equals');
    const containsFilter = colFilters.find((f) => f.operator === 'contains');
    const activeFilter = equalsFilter || containsFilter;

    if (!activeFilter) continue;

    let targetValues: string[] = [];
    if (activeFilter.value) {
      if (activeFilter.value.startsWith('[') && activeFilter.value.endsWith(']')) {
        try {
          targetValues = JSON.parse(activeFilter.value);
        } catch {
          targetValues = [activeFilter.value];
        }
      } else {
        targetValues = [activeFilter.value];
      }
    }

    if (targetValues.length === 0) continue;

    if (colSchema.type === 'multi_select') {
      // Merge all equal/contains values for multi-select
      const allVals = new Set<string>();
      colFilters.forEach((f) => {
        if (f.operator === 'equals' || f.operator === 'contains') {
          let vals: string[] = [];
          if (f.value.startsWith('[') && f.value.endsWith(']')) {
            try { vals = JSON.parse(f.value); } catch { vals = [f.value]; }
          } else {
            vals = [f.value];
          }
          vals.forEach(v => allVals.add(v));
        }
      });
      props[columnId] = Array.from(allVals);
    } else if (colSchema.type === 'select') {
      props[columnId] = targetValues[0];
    } else if (colSchema.type === 'number') {
      const num = Number(targetValues[0]);
      if (!isNaN(num)) {
        props[columnId] = num;
      }
    } else if (colSchema.type === 'date' || colSchema.type === 'datetime') {
      props[columnId] = targetValues[0];
    } else {
      // text or other types
      props[columnId] = targetValues[0];
    }
  }

  return props;
}


export default function DatabaseView({
  database,
  initialPages,
  members = [],
  currentUserId,
}: {
  database: any;
  initialPages: any[];
  members?: WorkspaceMember[];
  currentUserId?: string;
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const tWs = useTranslations('Workspace');
  const schema: any[] = database.schema ?? [];
  const router = useRouter();
  const tabNav = useTabNav();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    tabNav.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [tabNav]);

  // Local pages state so that we can update them instantly in the UI when they are updated in peek mode
  const [localPages, setLocalPages] = useState<any[]>(() => initialPages);

  useEffect(() => {
    setLocalPages(initialPages);
  }, [initialPages]);

  // Peek states
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekPage, setPeekPage] = useState<any | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  // True once the peek content is scrolled past the page title, so the header
  // bar can reveal the title and keep it visible.
  const [peekScrolled, setPeekScrolled] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const dbButtonRef = useRef<HTMLButtonElement>(null);
  const [dbName, setDbName] = useState<string>(database.name ?? '');
  const savedDbName = useRef<string>(database.name ?? '');

  // Side peek drawer width — resizable, persisted across sessions.
  const isDesktopViewport = useSyncExternalStore(subscribeDesktopViewport, getDesktopViewportSnapshot, getDesktopViewportServerSnapshot);
  const [sidePeekWidth, setSidePeekWidth] = useState(SIDE_PEEK_DEFAULT_WIDTH);
  useEffect(() => {
    const saved = Number(localStorage.getItem(SIDE_PEEK_WIDTH_STORAGE_KEY));
    if (saved && !isNaN(saved)) {
      setSidePeekWidth(Math.min(SIDE_PEEK_MAX_WIDTH, Math.max(SIDE_PEEK_MIN_WIDTH, saved)));
    }
  }, []);
  const handleSidePeekResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    // Stop the mousedown from reaching the peek editor's block-selection marquee
    // listener (belt-and-suspenders alongside the [data-no-block-marquee] guard).
    e.stopPropagation();
    document.body.classList.add('resize-drag-active');
    const startX = e.clientX;
    const startWidth = sidePeekWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // The drawer is anchored to the right edge, so dragging left grows it.
      const deltaX = startX - moveEvent.clientX;
      setSidePeekWidth(Math.min(SIDE_PEEK_MAX_WIDTH, Math.max(SIDE_PEEK_MIN_WIDTH, startWidth + deltaX)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resize-drag-active');
      setSidePeekWidth((w) => {
        localStorage.setItem(SIDE_PEEK_WIDTH_STORAGE_KEY, String(w));
        return w;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (dbName === savedDbName.current) return;
    const timer = setTimeout(() => {
      if (database.itemId) updateWorkspaceItemTitle(database.itemId, dbName);
      savedDbName.current = dbName;
    }, 800);
    return () => clearTimeout(timer);
  }, [dbName, database.itemId]);

  const handleIconSelect = (newIcon: string | null, newColor: string | null) => {
    if (database.itemId) {
      updateWorkspaceItemIcon(database.itemId, newIcon, newColor);
    }
  };

  const handlePageIconChange = (pageId: string, newIcon: string | null, newColor: string | null) => {
    setLocalPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, icon: newIcon, iconColor: newColor } : p)
    );
  };

  const [views, setViews] = useState<DatabaseView[]>(() => {
    const saved = database.views as DatabaseView[] | null | undefined;
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return [defaultTableView()];
  });

  const [activeViewId, setActiveViewId] = useState(() => views[0].id);
  const [pendingPageIds, setPendingPageIds] = useState<Set<string>>(() => new Set());
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Sync activeViewId with URL query parameter
  useEffect(() => {
    const v = searchParams.get('v');
    if (v && views.some((vw) => vw.id === v) && v !== activeViewId) {
      setActiveViewId(v);
    }
  }, [searchParams, views, activeViewId]);



  type WidthMode = 'narrow' | 'wide' | 'full';
  const [widthMode, setWidthMode] = useState<WidthMode>('full');

  useEffect(() => {
    const saved = localStorage.getItem(`db-width-${database.id}`) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
    else if (saved === 'true') setWidthMode('full'); // migrate old boolean
  }, [database.id]);

  const cycleWidth = () => {
    const next: WidthMode = widthMode === 'narrow' ? 'wide' : widthMode === 'wide' ? 'full' : 'narrow';
    setWidthMode(next);
    localStorage.setItem(`db-width-${database.id}`, next);
  };

  const widthLabels: Record<WidthMode, string> = { narrow: tPage('narrow'), wide: tPage('wide'), full: tPage('full') };

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'properties' | 'layout'>('layout');

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

  // Synchronize document title
  useEffect(() => {
    if (database && activeView) {
      document.title = `${dbName || database.name} - ${activeView.name} | Remnus`;
    }
  }, [dbName, database?.name, activeView?.name]);

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
    setPeekScrolled(false);
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
    // Update local state instantly so Table and Kanban update in the background.
    // Merge (not replace) so a partial/older payload can never drop fields that
    // a more recent edit already set on the local row.
    setLocalPages((prev) =>
      prev.map((p) => (p.id === updatedPage.id ? { ...p, ...updatedPage } : p))
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
    if (pendingPageIds.has(pageId)) return;
    const openBehavior = config.openBehavior ?? 'center';
    if (openBehavior === 'full') {
      router.push(`/db/${database.id}/${pageId}`);
    } else {
      setPeekPageId(pageId);
    }
  };

  const handleAddRow = (initialProperties?: Record<string, any>, opts?: { openAfterCreate?: boolean }) => {
    const filterProps = getDefaultPropertiesFromFilters(config.filters || [], schema || []);
    const mergedProperties = { ...filterProps, ...initialProperties };

    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const defaultIcon = config.defaultPageIcon || null;
    const defaultIconColor = config.defaultPageIconColor || null;

    const maxSort = localPages.length > 0
      ? Math.max(...localPages.map((p) => p.sortOrder ?? 0))
      : 0;

    const optimisticPage = {
      id: tempId,
      databaseId: database.id,
      title: 'New Page',
      content: '',
      properties: { title: 'New Page', ...mergedProperties },
      sortOrder: maxSort + 1,
      icon: defaultIcon,
      iconColor: defaultIconColor,
      createdAt: now,
      updatedAt: now,
    };

    setLocalPages((prev) => [...prev, optimisticPage]);
    setPendingPageIds((prev) => new Set(prev).add(tempId));

    startTransition(async () => {
      try {
        const realId = await createPage(
          database.id,
          'New Page',
          mergedProperties,
          defaultIcon,
          defaultIconColor,
        );
        setLocalPages((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: realId } : p))
        );
        if (opts?.openAfterCreate) handlePageClick(realId);
      } catch {
        setLocalPages((prev) => prev.filter((p) => p.id !== tempId));
      } finally {
        setPendingPageIds((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
      }
    });
  };

  // The header "New" button (unlike each view's own inline add-row trigger)
  // has no surrounding context — no day cell, no kanban column — so without a
  // date it was landing rows nowhere obvious (invisible on a Calendar view
  // until opened directly). Prefill today's date when the schema has one
  // (the active Calendar view's own dateCol, else the first date/datetime
  // column) and always open the new row right after creation.
  const handleHeaderNewClick = () => {
    const dateColId = calendarConfig
      ? calendarConfig.dateCol
      : schema.find((c: any) => c.type === 'date' || c.type === 'datetime')?.id;
    const initialProperties = dateColId ? { [dateColId]: formatYYYYMMDD(new Date()) } : undefined;
    handleAddRow(initialProperties, { openAfterCreate: true });
  };

  const handleDeletePage = async (pageId: string) => {
    // Optimistic delete
    setLocalPages((prev) => prev.filter((p) => p.id !== pageId));
    // Persist
    await deletePage(pageId, database.id);
  };

  const handleDuplicatePage = async (pageId: string): Promise<string | undefined> => {
    // Optimistically insert the copy so it shows up immediately in Table/Kanban/Calendar
    // instead of only appearing after a manual refresh (revalidatePath alone doesn't
    // update this client component's already-rendered localPages state).
    const source = localPages.find((p) => p.id === pageId);
    const tempId = `temp-${uid()}`;

    if (source) {
      const now = new Date();
      const copiedProperties = { ...(source.properties || {}) };
      if (copiedProperties.title) copiedProperties.title = `${copiedProperties.title} (Copy)`;
      const maxSort = localPages.length > 0
        ? Math.max(...localPages.map((p) => p.sortOrder ?? 0))
        : 0;

      setLocalPages((prev) => [
        ...prev,
        {
          ...source,
          id: tempId,
          title: `${source.title} (Copy)`,
          properties: copiedProperties,
          sortOrder: maxSort + 1,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    try {
      const realId = await duplicatePage(pageId, database.id);
      if (source) {
        if (realId) {
          setLocalPages((prev) => prev.map((p) => (p.id === tempId ? { ...p, id: realId } : p)));
        } else {
          setLocalPages((prev) => prev.filter((p) => p.id !== tempId));
        }
      }
      return realId;
    } catch (err) {
      if (source) setLocalPages((prev) => prev.filter((p) => p.id !== tempId));
      throw err;
    }
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
  const handleActivate = (id: string) => {
    setActiveViewId(id);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('v', id);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  const handleAddView = (type: 'table' | 'kanban' | 'calendar') => {
    const count = views.filter((v) => v.config.type === type).length;
    let base = 'Table';
    if (type === 'kanban') base = 'Board';
    else if (type === 'calendar') base = 'Calendar';
    const name = count === 0 ? base : `${base} ${count + 1}`;
    
    let newView: DatabaseView;
    if (type === 'table') {
      newView = defaultTableView(name);
    } else if (type === 'kanban') {
      newView = defaultKanbanView(schema, name);
    } else {
      newView = defaultCalendarView(schema, name);
    }
    
    mutateViews((vs) => [...vs, newView]);
    handleActivate(newView.id);
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

  const handleDuplicateView = (id: string) => {
    const original = views.find((v) => v.id === id);
    if (!original) return;

    const clonedConfig = JSON.parse(JSON.stringify(original.config));

    if (Array.isArray(clonedConfig.filters)) {
      clonedConfig.filters = clonedConfig.filters.map((f: any) => ({
        ...f,
        id: uid(),
      }));
    }
    if (Array.isArray(clonedConfig.sorts)) {
      clonedConfig.sorts = clonedConfig.sorts.map((s: any) => ({
        ...s,
        id: uid(),
      }));
    }

    const newView: DatabaseView = {
      id: uid(),
      name: `${original.name} (${tWs('duplicate')})`,
      config: clonedConfig,
      icon: original.icon,
      iconColor: original.iconColor,
    };

    mutateViews((vs) => {
      const idx = vs.findIndex((v) => v.id === id);
      if (idx !== -1) {
        const next = [...vs];
        next.splice(idx + 1, 0, newView);
        return next;
      }
      return [...vs, newView];
    });

    handleActivate(newView.id);
  };

  const handleReorderViews = (nextViews: DatabaseView[]) => {
    mutateViews(() => nextViews);
  };

  const handleUpdateViewIcon = (id: string, icon: string | null, iconColor: string | null) => {
    mutateViews((vs) =>
      vs.map((v) =>
        v.id === id
          ? {
              ...v,
              icon: icon || undefined,
              iconColor: iconColor || undefined,
            }
          : v
      )
    );
  };

  // --- Config mutations ---
  const handleFiltersChange = (filters: ViewFilter[]) =>
    mutateConfig((cfg) => ({ ...cfg, filters }));

  const handleSortsChange = (sorts: ViewSort[]) =>
    mutateConfig((cfg) => ({ ...cfg, sorts }));

  const handleColumnOrderChange = (columnOrder: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, columnOrder }));

  const handleColumnWidthsChange = (columnWidths: Record<string, number>) =>
    mutateConfig((cfg) => ({ ...cfg, columnWidths }));

  const handleGroupByChange = (groupByCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, groupByCol }));

  const handleGroupOrderChange = (groupOrder: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, groupOrder }));

  const handleCardPropertiesChange = (cardProperties: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, cardProperties }));

  const handleShowPropertyLabelsChange = (showPropertyLabels: boolean) =>
    mutateConfig((cfg) => ({ ...cfg, showPropertyLabels }));

  const handlePropertyTextClampChange = (propertyTextClamp: 'truncate' | 'wrap') =>
    mutateConfig((cfg) => ({ ...cfg, propertyTextClamp }));

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
  const kanbanConfig = config.type === 'kanban' ? (config as KanbanViewConfig) : null;
  const calendarConfig = config.type === 'calendar' ? (config as CalendarViewConfig) : null;
  const tableGroupColumn = tableConfig?.groupByCol
    ? schema.find((col: any) => col.id === tableConfig.groupByCol)
    : null;
  const isGroupedTableView = !!tableConfig?.groupByCol && isTableGroupableColumn(tableGroupColumn);

  const handleDateColChange = (dateCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, dateCol }));

  const handleViewModeChange = (viewMode: 'month' | 'week') =>
    mutateConfig((cfg) => ({ ...cfg, viewMode }));

  const handleFirstDayOfWeekChange = (firstDayOfWeek: 'sunday' | 'monday') =>
    mutateConfig((cfg) => ({ ...cfg, firstDayOfWeek }));

  const handleCardColorColChange = (cardColorCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, cardColorCol: cardColorCol || undefined }));

  const handleCardBorderSideChange = (side: 'left' | 'top' | 'right' | 'bottom') =>
    mutateConfig((cfg) => ({ ...cfg, cardBorderSide: side }));

  const handleCardBgColChange = (cardBgCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, cardBgCol: cardBgCol || undefined }));

  const handleRowColorColChange = (rowColorCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, rowColorCol: rowColorCol || undefined }));

  const handleGroupColBgChange = (groupColBg: boolean) =>
    mutateConfig((cfg) => ({ ...cfg, groupColBg }));

  const handleCardDateChange = async (pageId: string, newDate: string | null) => {
    const page = localPages.find((p) => p.id === pageId);
    if (!page || !calendarConfig) return;

    const nextPages = localPages.map((p) => {
      if (p.id === pageId) {
        return {
          ...p,
          properties: {
            ...p.properties,
            [calendarConfig.dateCol]: newDate,
          },
        };
      }
      return p;
    });

    setLocalPages(nextPages);

    const targetPage = nextPages.find((p) => p.id === pageId);
    if (targetPage) {
      await updatePageProperties(pageId, targetPage.properties);
    }
  };

  const handleUpdatePageProperties = async (pageId: string, newProps: Record<string, any>) => {
    setLocalPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, properties: newProps } : p))
    );
    setPeekPage((prev: any) => {
      if (prev && prev.id === pageId) {
        return { ...prev, properties: newProps };
      }
      return prev;
    });
    await updatePageProperties(pageId, newProps);
  };


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
    <MembersProvider members={members}>
    <div className="relative flex-1 flex flex-col overflow-hidden min-w-0 h-full">
      <div className={`flex-1 flex flex-col w-full min-w-0 max-w-full overflow-hidden pt-6 sm:pt-8 ${widthMode === 'full' ? 'px-4 sm:px-8 lg:px-16' : 'px-4 sm:px-8'} ${widthMode === 'full' ? '' : widthMode === 'wide' ? 'max-w-screen-2xl mx-auto' : 'max-w-6xl mx-auto'}`}>
      {/* Back button for nested databases */}
      {database.parentId && (
        <div className="mb-4 shrink-0">
          <Link
            href={`/page/${database.parentId}`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <ChevronLeft size={14} />
            {tPage('back')}
          </Link>
        </div>
      )}

      {/* Unified Page Header: Icon + Title */}
      <div className="flex items-center gap-3 mb-8 group/icon-header relative select-none shrink-0">
        <div className="relative shrink-0 flex items-center group/icon-wrapper">
          <div className="relative flex items-center">
            <button
              ref={dbButtonRef}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1 hover:bg-neutral-800 rounded transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={database.icon ? "Change icon" : "Add icon"}
            >
              <PageIcon icon={database.icon} iconColor={database.iconColor} size={40} fallbackType="database" />
            </button>
            {database.icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 px-1.5 py-0.5 text-[9px] bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white rounded transition-all cursor-pointer font-medium whitespace-nowrap shadow-xl z-20"
              >
                Remove
              </button>
            )}
          </div>

          {showIconPicker && (
            <IconPicker
              currentIcon={database.icon}
              currentIconColor={database.iconColor}
              onSelect={handleIconSelect}
              onClose={() => setShowIconPicker(false)}
              anchorRef={dbButtonRef}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder={tPage('untitled')}
            className="w-full bg-transparent text-neutral-100 font-bold text-2xl sm:text-3xl focus:outline-none placeholder:text-neutral-700 tracking-tight leading-none py-1"
          />
        </div>
      </div>

      {/* Top bar */}
      <div className="flex items-end justify-between border-b border-neutral-800">
        <ViewsBar
          views={views}
          activeViewId={activeView.id}
          onActivate={handleActivate}
          onAdd={handleAddView}
          onRename={handleRenameView}
          onDelete={handleDeleteView}
          onDuplicate={handleDuplicateView}
          onReorder={handleReorderViews}
          onUpdateIcon={handleUpdateViewIcon}
        />

        <div className="flex items-center gap-0 pb-1.5">
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded"
            title={tWs('refresh') || 'Refresh'}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
            {tWs('refresh')}
          </button>

          {/* Full Width Toggle — hidden on mobile */}
          <button
            onClick={cycleWidth}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded"
          >
            <ArrowLeftRight size={13} />
            {widthLabels[widthMode]}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => handleToggleSidebar(sidebarTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors cursor-pointer rounded ${
              sidebarOpen
                ? 'text-blue-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-200'
            }`}
          >
            <Settings size={13} /> {t('settings')}
          </button>

          {/* New Page button — hidden on mobile (available via bottom nav) */}
          <button
            onClick={handleHeaderNewClick}
            disabled={pendingPageIds.size > 0}
            className="hidden sm:flex items-center gap-1.5 bg-neutral-100 text-neutral-900 hover:bg-white px-4 py-1.5 transition-colors text-sm font-medium disabled:opacity-50 ml-1 cursor-pointer rounded"
          >
            <Plus size={14} /> {t('new')}
          </button>
        </div>
      </div>

      {/* Content + Sidebar Area */}
      <div className="flex-1 flex gap-4 relative pt-4 pb-8 min-w-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden h-full pr-1">
          {isTableView && tableConfig ? (
            isGroupedTableView ? (
              <GroupedTableLayout
                database={database}
                pages={processedPages}
                groupByCol={tableConfig.groupByCol!}
                groupOrder={tableConfig.groupOrder ?? []}
                hiddenGroups={tableConfig.hiddenGroups ?? []}
                groupColBg={tableConfig.groupColBg ?? false}
                onGroupOrderChange={handleGroupOrderChange}
                columnOrder={tableConfig.columnOrder}
                hiddenColumns={tableConfig.hiddenColumns}
                columnWidths={tableConfig.columnWidths ?? {}}
                onColumnWidthsChange={handleColumnWidthsChange}
                rowColorCol={tableConfig.rowColorCol}
                onColumnOrderChange={handleColumnOrderChange}
                onRowClick={handlePageClick}
                onRowReorder={handleRowReorder}
                onDeletePage={handleDeletePage}
                onDuplicatePage={handleDuplicatePage}
                hasSorts={(config.sorts?.length ?? 0) > 0}
                onUpdatePageProperties={handleUpdatePageProperties}
                onCreatePage={handleAddRow}
                filters={config.filters}
                sorts={config.sorts}
                onFiltersChange={handleFiltersChange}
                onSortsChange={handleSortsChange}
                onToggleHideColumn={toggleHideColumn}
                defaultPageIcon={config.defaultPageIcon}
                defaultPageIconColor={config.defaultPageIconColor}
                onPageIconChange={handlePageIconChange}
              />
            ) : (
              <TableLayout
                database={database}
                pages={processedPages}
                columnOrder={tableConfig.columnOrder}
                hiddenColumns={tableConfig.hiddenColumns}
                columnWidths={tableConfig.columnWidths ?? {}}
                onColumnWidthsChange={handleColumnWidthsChange}
                rowColorCol={tableConfig.rowColorCol}
                onColumnOrderChange={handleColumnOrderChange}
                onRowClick={handlePageClick}
                onRowReorder={handleRowReorder}
                onDeletePage={handleDeletePage}
                onDuplicatePage={handleDuplicatePage}
                hasSorts={(config.sorts?.length ?? 0) > 0}
                onUpdatePageProperties={handleUpdatePageProperties}
                onCreatePage={handleAddRow}
                filters={config.filters}
                sorts={config.sorts}
                onFiltersChange={handleFiltersChange}
                onSortsChange={handleSortsChange}
                onToggleHideColumn={toggleHideColumn}
                defaultPageIcon={config.defaultPageIcon}
                defaultPageIconColor={config.defaultPageIconColor}
                onPageIconChange={handlePageIconChange}
              />
            )
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
              onDuplicatePage={handleDuplicatePage}
              hasSorts={(config.sorts?.length ?? 0) > 0}
              cardProperties={kanbanConfig.cardProperties}
              showPropertyLabels={kanbanConfig.showPropertyLabels ?? true}
              propertyTextClamp={kanbanConfig.propertyTextClamp ?? 'truncate'}
              cardColorCol={kanbanConfig.cardColorCol}
              cardBorderSide={kanbanConfig.cardBorderSide ?? 'left'}
              cardBgCol={kanbanConfig.cardBgCol}
              groupColBg={kanbanConfig.groupColBg ?? false}
              onUpdatePageProperties={handleUpdatePageProperties}
              onCreatePage={(initialProperties) => handleAddRow(initialProperties, { openAfterCreate: true })}
              defaultPageIcon={config.defaultPageIcon}
              defaultPageIconColor={config.defaultPageIconColor}
              onPageIconChange={handlePageIconChange}
              hiddenGroups={kanbanConfig.hiddenGroups ?? []}
            />
          ) : calendarConfig ? (
            <CalendarView
              database={database}
              currentUserId={currentUserId}
              pages={processedPages}
              dateCol={calendarConfig.dateCol}
              viewMode={calendarConfig.viewMode}
              firstDayOfWeek={calendarConfig.firstDayOfWeek || 'sunday'}
              onCardClick={handlePageClick}
              onCardDateChange={handleCardDateChange}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              cardColorCol={calendarConfig.cardColorCol}
              cardBorderSide={calendarConfig.cardBorderSide ?? 'left'}
              cardBgCol={calendarConfig.cardBgCol}
              cardProperties={calendarConfig.cardProperties}
              showPropertyLabels={calendarConfig.showPropertyLabels ?? true}
              propertyTextClamp={calendarConfig.propertyTextClamp ?? 'truncate'}
              onUpdatePageProperties={handleUpdatePageProperties}
              onCreatePage={(initialProperties) => handleAddRow(initialProperties, { openAfterCreate: true })}
              defaultPageIcon={config.defaultPageIcon}
              defaultPageIconColor={config.defaultPageIconColor}
              onPageIconChange={handlePageIconChange}
            />
          ) : null}
        </div>

        {/* Backdrop — desktop: transparent click-to-close, mobile: dark overlay */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 sm:bg-transparent bg-black/40 z-20 cursor-default sm:pointer-events-auto"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Panel — desktop: right panel, mobile: bottom sheet */}
        {sidebarOpen && (
          <div className="
            z-30 flex flex-col overflow-hidden
            fixed inset-x-0 bottom-14 max-h-[85vh] rounded-t-2xl border-t border-neutral-800
            sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-0 sm:right-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-t-0 sm:flex-row sm:overflow-visible
          ">
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
              openBehavior={config.openBehavior ?? 'center'}
              onOpenBehaviorChange={(behavior) =>
                mutateConfig((cfg) => ({ ...cfg, openBehavior: behavior }))
              }
              groupByCol={tableConfig?.groupByCol ?? kanbanConfig?.groupByCol}
              onGroupByColChange={handleGroupByChange}
              cardProperties={kanbanConfig?.cardProperties ?? calendarConfig?.cardProperties}
              onCardPropertiesChange={handleCardPropertiesChange}
              showPropertyLabels={(kanbanConfig?.showPropertyLabels ?? calendarConfig?.showPropertyLabels) ?? true}
              onShowPropertyLabelsChange={handleShowPropertyLabelsChange}
              propertyTextClamp={(kanbanConfig?.propertyTextClamp ?? calendarConfig?.propertyTextClamp) ?? 'truncate'}
              onPropertyTextClampChange={handlePropertyTextClampChange}
              dateCol={calendarConfig?.dateCol}
              onDateColChange={handleDateColChange}
              viewMode={calendarConfig?.viewMode}
              onViewModeChange={handleViewModeChange}
              firstDayOfWeek={calendarConfig?.firstDayOfWeek}
              onFirstDayOfWeekChange={handleFirstDayOfWeekChange}
              cardColorCol={kanbanConfig?.cardColorCol ?? calendarConfig?.cardColorCol}
              onCardColorColChange={handleCardColorColChange}
              cardBorderSide={kanbanConfig?.cardBorderSide ?? calendarConfig?.cardBorderSide}
              onCardBorderSideChange={handleCardBorderSideChange}
              cardBgCol={kanbanConfig?.cardBgCol ?? calendarConfig?.cardBgCol}
              onCardBgColChange={handleCardBgColChange}
              rowColorCol={(config as TableViewConfig).rowColorCol}
              onRowColorColChange={handleRowColorColChange}
              groupColBg={tableConfig?.groupColBg ?? kanbanConfig?.groupColBg ?? false}
              onGroupColBgChange={handleGroupColBgChange}
              defaultPageIcon={config.defaultPageIcon}
              defaultPageIconColor={config.defaultPageIconColor}
              onDefaultPageIconChange={(icon, color) =>
                mutateViews((vs) =>
                  vs.map((v) => ({
                    ...v,
                    config: {
                      ...v.config,
                      defaultPageIcon: icon || undefined,
                      defaultPageIconColor: color || undefined,
                    },
                  }))
                )
              }
              hiddenGroups={tableConfig?.hiddenGroups ?? kanbanConfig?.hiddenGroups}
              onHiddenGroupsChange={(hidden) =>
                mutateConfig((cfg) => ({ ...cfg, hiddenGroups: hidden }))
              }
            />
          </div>
        )}
      </div>
      </div>

      {/* Peek Overlay & Container (Center / Side Peek) */}
      {peekPageId && (
        <>
          {/* Dark Glassmorphism Backdrop */}
          <div
            onClick={() => setPeekPageId(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs z-50 animate-fade-in transition-opacity cursor-pointer animate-duration-200"
          />

          {/* Center Peek Modal */}
          {(config.openBehavior ?? 'center') === 'center' && (
            <div className="absolute z-50 inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4 md:p-10 sm:pointer-events-none">
              <div className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] bg-neutral-850 border-t sm:border border-neutral-800 flex flex-col sm:modal-shadow overflow-hidden rounded-t-2xl sm:rounded-lg pointer-events-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                {/* Peek Sticky Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-850 shrink-0 bg-neutral-900/30">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPeekPageId(null)}
                      className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer rounded"
                    >
                      <X size={16} />
                    </button>
                    <span className={`hidden sm:inline-block text-[11px] bg-neutral-800 text-neutral-400 font-medium py-0.5 px-2 border border-neutral-700/40 uppercase tracking-wider rounded transition-opacity ${peekScrolled ? 'opacity-0 sm:hidden' : ''}`}>
                      {t('openCenter')}
                    </span>
                    {peekScrolled && peekPage && (
                      <span className="text-sm font-medium text-neutral-200 truncate max-w-[50vw] sm:max-w-xs animate-fade-in">
                        {peekPage.properties?.title || tPage('untitled')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        router.push(`/db/${database.id}/${peekPageId}`);
                        setPeekPageId(null);
                      }}
                      className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-2.5 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded"
                    >
                      <Maximize2 size={12} />
                      <span>{t('openInFullPage')}</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === peekPageId ? null : peekPageId);
                        }}
                        className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {openMenuId === peekPageId && (
                        <>
                          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1.5 z-50 bg-neutral-850 border border-neutral-800 shadow-xl py-1 w-36 rounded overflow-hidden text-left animate-fade-in animate-duration-100">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                const newId = await handleDuplicatePage(peekPageId!);
                                if (newId) {
                                  setPeekPageId(newId);
                                }
                              }}
                              className="w-full px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
                            >
                              <Copy size={13} />
                              <span>{t('duplicatePage')}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setConfirmDeletePageId(peekPageId!);
                              }}
                              className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} />
                              <span>{tPage('deletePage')}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Peek Editor Scrollable Content */}
                <div
                  className="flex-1 overflow-y-auto min-h-0 bg-neutral-850"
                  onScroll={(e) => setPeekScrolled(e.currentTarget.scrollTop > 40)}
                >
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
          {(config.openBehavior ?? 'center') === 'side' && (
            <div
              className="absolute z-50 flex flex-col overflow-hidden bg-neutral-850 inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t border-neutral-800 sm:left-auto sm:top-0 sm:right-0 sm:bottom-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-l sm:modal-shadow animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
              style={isDesktopViewport ? { width: sidePeekWidth, maxWidth: '95vw' } : undefined}
            >
              {isDesktopViewport && (
                <div
                  data-no-block-marquee
                  onMouseDown={handleSidePeekResizeStart}
                  className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors z-20"
                  title={t('resizePanel')}
                />
              )}
              {/* Peek Sticky Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-850 shrink-0 bg-neutral-900/30">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPeekPageId(null)}
                    className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer rounded"
                  >
                    <X size={16} />
                  </button>
                  <span className={`text-[11px] bg-neutral-800 text-neutral-400 font-medium py-0.5 px-2 border border-neutral-700/40 uppercase tracking-wider rounded transition-opacity ${peekScrolled ? 'hidden' : ''}`}>
                    {t('openSide')}
                  </span>
                  {peekScrolled && peekPage && (
                    <span className="text-sm font-medium text-neutral-200 truncate max-w-[50vw] sm:max-w-xs animate-fade-in">
                      {peekPage.properties?.title || tPage('untitled')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      router.push(`/db/${database.id}/${peekPageId}`);
                      setPeekPageId(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-2.5 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded"
                  >
                    <Maximize2 size={12} />
                    <span>Open in full page</span>
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === peekPageId ? null : peekPageId);
                      }}
                      className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                    {openMenuId === peekPageId && (
                      <>
                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1.5 z-50 bg-neutral-850 border border-neutral-800 shadow-xl py-1 w-36 rounded overflow-hidden text-left animate-fade-in animate-duration-100">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              const newId = await handleDuplicatePage(peekPageId!);
                              if (newId) {
                                setPeekPageId(newId);
                              }
                            }}
                            className="w-full px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
                          >
                            <Copy size={13} />
                            <span>Duplicate page</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              setConfirmDeletePageId(peekPageId!);
                            }}
                            className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>{tPage('deletePage')}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Peek Editor Scrollable Content */}
              <div
                className="flex-1 overflow-y-auto min-h-0 bg-neutral-850"
                onScroll={(e) => setPeekScrolled(e.currentTarget.scrollTop > 40)}
              >
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
      {confirmDeletePageId && (
        <ConfirmDialog
          title={t('deletePageConfirm')}
          confirmLabel={tPage('deletePage')}
          cancelLabel={tPage('deleteCancel')}
          onConfirm={() => { handleDeletePage(confirmDeletePageId); setPeekPageId(null); setConfirmDeletePageId(null); }}
          onCancel={() => setConfirmDeletePageId(null)}
        />
      )}
    </div>
    </MembersProvider>
  );
}
