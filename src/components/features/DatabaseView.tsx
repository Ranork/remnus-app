'use client';

import { useState, useMemo, useRef, useCallback, useEffect, useTransition, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createPage, getPage, deletePage, duplicatePage, reorderPages, updatePageProperties } from '@/lib/actions/page';
import { updateDatabaseViews } from '@/lib/actions/database';
import { updateWorkspaceItemIcon, updateWorkspaceItemTitle } from '@/lib/actions/workspace';
import { Plus, Settings, X, Maximize2, ArrowLeftRight, MoreHorizontal, Trash2, Copy, ChevronLeft, RefreshCw, ClipboardList, FileCode2, Globe, History, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TableLayout from './TableLayout';
import GroupedTableLayout from './GroupedTableLayout';
import { ConfirmDialog } from './ConfirmDialog';
import { BulkRowsDialog } from './BulkRowsDialog';
import { PageMarkdownDialog } from './PageMarkdownDialog';
import { PageHistoryModal } from './PageHistoryModal';
import ShareModal from '@/components/share/ShareModal';
import KanbanBoard from './KanbanBoard';
import CalendarView from './CalendarView';
import { useRecurrenceControls } from './recurrence/useRecurrenceControls';
import ViewsBar from './ViewsBar';
import DatabasePropertiesSidebar from './DatabasePropertiesSidebar';
import PageEditor, { type PageEditorHandle } from './PageEditor';
import SaveStatus, { type SaveState } from './SaveStatus';
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
// Shared with the dashboard renderer (a server component), so a filter selects
// the same rows in a view and in a dashboard block. See src/lib/tableFilters.ts.
import { applyFilters, applySorts } from '@/lib/tableFilters';

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

// The `id` column (row's real primary key) is always seeded into new databases but
// starts hidden — it's a precision tool (e.g. targeting exact rows in bulk update),
// not something most people need visible in every table view.
// View names are user data, so a new view is named in the UI language at creation
// (callers pass `t('viewTable')` etc.); the English defaults only serve non-UI callers.
function defaultTableView(schema: any[], name = 'Table'): DatabaseView {
  const hasIdColumn = schema.some((c: any) => c.type === 'id');
  return {
    id: uid(),
    name,
    config: { type: 'table', columnOrder: [], hiddenColumns: hasIdColumn ? ['id'] : [], filters: [], sorts: [], openBehavior: 'center' },
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

// Select/status columns with a configured default option pre-fill new rows,
// so the option shows up already selected instead of empty.
function getDefaultPropertiesFromSchema(schema: any[]): Record<string, any> {
  const props: Record<string, any> = {};
  for (const col of schema) {
    if ((col.type === 'select' || col.type === 'status') && col.defaultValue) {
      props[col.id] = col.defaultValue;
    }
  }
  return props;
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
  // Schema mutations (new inline option, settings-panel save) only persist server-side
  // and revalidate the route for the NEXT navigation — they never touch this already-
  // mounted client tree. Mirror it locally (like localPages below) so option/color
  // changes show up immediately instead of requiring a manual page refresh.
  const [localSchema, setLocalSchema] = useState<any[]>(() => database.schema ?? []);
  useEffect(() => { setLocalSchema(database.schema ?? []); }, [database.schema]);
  const schema: any[] = localSchema;
  const handleSchemaChange = useCallback((nextSchema: any[]) => { setLocalSchema(nextSchema); }, []);
  const liveDatabase = useMemo(() => ({ ...database, schema }), [database, schema]);
  const router = useRouter();
  const tabNav = useTabNav();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

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

  // Visible feedback for row/card drag-reorder + property persistence, shared
  // across Table/Kanban/Calendar so a drag doesn't just silently succeed or fail.
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const pendingSaveCountRef = useRef(0);
  const trackSave = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    pendingSaveCountRef.current += 1;
    setSaveState('saving');
    try {
      const result = await p;
      pendingSaveCountRef.current -= 1;
      if (pendingSaveCountRef.current === 0) setSaveState('saved');
      return result;
    } catch (err) {
      pendingSaveCountRef.current -= 1;
      if (pendingSaveCountRef.current === 0) setSaveState('error');
      throw err;
    }
  }, []);

  // reorderPages rewrites every row's sortOrder in one DB transaction. Firing a
  // second drag before the first one's transaction lands used to race — two
  // overlapping full-table renumbers could interleave and leave the DB with a
  // half-applied order (e.g. several quick same-day Calendar reorders where
  // only the first survived a refresh). Chaining every call through this ref
  // serializes them, so each write always starts after the previous one has
  // actually landed instead of racing it.
  const reorderQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistReorder = useCallback((orderedIds: string[]) => {
    const previous = reorderQueueRef.current;
    const run = (async () => {
      await previous.catch(() => {});
      await reorderPages(database.id, orderedIds);
    })();
    reorderQueueRef.current = run;
    return trackSave(run);
  }, [database.id, trackSave]);

  // Peek states
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekPage, setPeekPage] = useState<any | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  // True once the peek content is scrolled past the page title, so the header
  // bar can reveal the title and keep it visible.
  const [peekScrolled, setPeekScrolled] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState<string | null>(null);
  const [showSharePeek, setShowSharePeek] = useState(false);
  const [showHistoryPeek, setShowHistoryPeek] = useState(false);
  const peekEditorRef = useRef<PageEditorHandle>(null);
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

  const handlePageCardCollapsedChange = (pageId: string, collapsed: boolean) => {
    setLocalPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, cardCollapsed: collapsed } : p)
    );
  };

  // Group-level collapse (a Kanban column, a calendar day) toggles many cards
  // in one pass instead of re-mapping `localPages` once per card.
  const handlePagesCardCollapsedChange = (pageIds: string[], collapsed: boolean) => {
    const ids = new Set(pageIds);
    setLocalPages((prev) =>
      prev.map((p) => ids.has(p.id) ? { ...p, cardCollapsed: collapsed } : p)
    );
  };

  const [views, setViews] = useState<DatabaseView[]>(() => {
    const saved = database.views as DatabaseView[] | null | undefined;
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return [defaultTableView(schema, t('viewTable'))];
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

  // A rename made elsewhere (an agent, another tab) arrives in `database.name` on the next
  // refresh; the input read it only once. Adopt it unless a local edit is still waiting for
  // the save above (same rule as the page editors).
  useEffect(() => {
    const incoming = database.name ?? '';
    if (incoming === savedDbName.current || dbName !== savedDbName.current) return;
    savedDbName.current = incoming;
    setDbName(incoming);
  }, [database.name, dbName]);

  // Synchronize document title — re-applied after every server refresh too (`database` is a
  // new object then): the refresh re-renders the layout's default "Remnus" <title>.
  const activeViewName = activeView?.name;
  useEffect(() => {
    if (database && activeViewName) {
      document.title = `${dbName || database.name} - ${activeViewName} | Remnus`;
    }
  }, [dbName, database, activeViewName]);

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
    () => applySorts(applyFilters(localPages, config.filters), config.sorts),
    [localPages, config.filters, config.sorts]
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
    const schemaDefaults = getDefaultPropertiesFromSchema(schema || []);
    const filterProps = getDefaultPropertiesFromFilters(config.filters || [], schema || []);
    const mergedProperties = { ...schemaDefaults, ...filterProps, ...initialProperties };

    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const defaultIcon = config.defaultPageIcon || null;
    const defaultIconColor = config.defaultPageIconColor || null;

    const maxSort = localPages.length > 0
      ? Math.max(...localPages.map((p) => p.sortOrder ?? 0))
      : 0;

    // A new row starts without a title (every view shows the localized "Untitled"
    // placeholder) — a stored English "New Page" had to be deleted before typing.
    const optimisticPage = {
      id: tempId,
      databaseId: database.id,
      title: '',
      content: '',
      properties: { title: '', ...mergedProperties },
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
          '',
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
    const before = localPages;
    setLocalPages((prev) => prev.filter((p) => p.id !== pageId));
    // Persist. A failed delete puts the row back — otherwise it disappears from the
    // screen while still existing, and reappears on the next refresh.
    try {
      await deletePage(pageId, database.id);
    } catch (err) {
      console.error('[Remnus] delete row failed:', err);
      setLocalPages(before);
    }
  };

  // Series-aware delete for the Table and Kanban views. Only the scope dialog
  // is needed here — those views have no "repeat" menu yet, so the rule map
  // (which the calendar loads anyway for its badges) would go unused; passing
  // an empty one keeps this from costing a second query on every mount.
  const recurrence = useRecurrenceControls({
    dateColId: '',
    seriesRules: {},
    getPage: (id) => localPages.find((p) => p.id === id),
    onChanged: () => tabNav.refresh(),
    // Falls back to the existing confirm dialog rather than deleting outright:
    // the opened card's Delete routes through here too, and a non-series row
    // must still get its "are you sure?".
    onPlainDelete: (id) => setConfirmDeletePageId(id),
  });

  const handleDuplicatePage = async (pageId: string): Promise<string | undefined> => {
    // Optimistically insert the copy so it shows up immediately in Table/Kanban/Calendar
    // instead of only appearing after a manual refresh (revalidatePath alone doesn't
    // update this client component's already-rendered localPages state).
    const source = localPages.find((p) => p.id === pageId);
    const tempId = `temp-${uid()}`;

    if (source) {
      const now = new Date();
      const copiedProperties = { ...(source.properties || {}) };
      const maxSort = localPages.length > 0
        ? Math.max(...localPages.map((p) => p.sortOrder ?? 0))
        : 0;

      setLocalPages((prev) => [
        ...prev,
        {
          ...source,
          id: tempId,
          title: source.title,
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
    await persistReorder(orderedIds);
  };

  const handleCardReorder = async (pageId: string, targetGroupId: string, targetPageId?: string, position: 'before' | 'after' = 'before') => {
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
        if (targetPageId && targetPageId !== pageId) {
          let toIdx = nextPages.findIndex((p) => p.id === targetPageId);
          if (toIdx !== -1) {
            if (position === 'after') toIdx += 1;
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
        await trackSave(updatePageProperties(pageId, targetPage.properties));
      }
    }
    if (!hasSorts) {
      await persistReorder(nextPages.map((p) => p.id));
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
    const base = type === 'kanban' ? t('viewBoard') : type === 'calendar' ? t('viewCalendar') : t('viewTable');
    const name = count === 0 ? base : `${base} ${count + 1}`;
    
    let newView: DatabaseView;
    if (type === 'table') {
      newView = defaultTableView(schema, name);
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

  const handleCollapsedGroupsChange = (collapsedGroups: string[]) =>
    mutateConfig((cfg) => ({ ...cfg, collapsedGroups }));

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

  // One "mark cards by" setting (V2 R8.2): a card shows that property's value as a badge
  // (kanban) or its colour as a dot (calendar) — no tinted backgrounds, no accent
  // stripes. The older split into an accent-line property and a background property is
  // folded into it (`cardMarkCol` reads `cardColorCol ?? cardBgCol`); choosing a mark
  // clears the legacy background field so a card is never marked by two properties.
  const handleCardMarkColChange = (col: string) =>
    mutateConfig((cfg) => ({ ...cfg, cardColorCol: col || undefined, cardBgCol: undefined }));

  const handleRowColorColChange = (rowColorCol: string) =>
    mutateConfig((cfg) => ({ ...cfg, rowColorCol: rowColorCol || undefined }));

  const handleCardDateChange = async (
    pageId: string,
    newDate: string | null,
    targetPageId?: string,
    position: 'before' | 'after' = 'before'
  ) => {
    const page = localPages.find((p) => p.id === pageId);
    if (!page || !calendarConfig) return;

    const dateChanged = page.properties[calendarConfig.dateCol] !== newDate;

    const nextPages = localPages.map((p) => {
      if (p.id === pageId && dateChanged) {
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

    // Dropped onto another card (not just the day's empty area) — reposition
    // relative to it, same splice pattern as the Kanban board. Skipped while a
    // sort is active: applySorts would just re-order it right back anyway.
    const hasSorts = config.sorts && config.sorts.length > 0;
    if (!hasSorts && targetPageId && targetPageId !== pageId) {
      const fromIdx = nextPages.findIndex((p) => p.id === pageId);
      if (fromIdx !== -1) {
        const [moved] = nextPages.splice(fromIdx, 1);
        let toIdx = nextPages.findIndex((p) => p.id === targetPageId);
        if (toIdx !== -1) {
          if (position === 'after') toIdx += 1;
          nextPages.splice(toIdx, 0, moved);
        } else {
          nextPages.push(moved);
        }
      }
    }

    setLocalPages(nextPages);

    if (dateChanged) {
      const targetPage = nextPages.find((p) => p.id === pageId);
      if (targetPage) {
        await trackSave(updatePageProperties(pageId, targetPage.properties));
      }
    }
    if (!hasSorts && targetPageId && targetPageId !== pageId) {
      await persistReorder(nextPages.map((p) => p.id));
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

  // Shared by the center and side peek headers.
  const peekHeaderActions = {
    onClose: () => setPeekPageId(null),
    onOpenFull: () => {
      router.push(`/db/${database.id}/${peekPageId}`);
      setPeekPageId(null);
    },
    onMarkdown: () => setMarkdownDraft(peekEditorRef.current?.getMarkdown() ?? peekPage?.content ?? ''),
    onShare: () => setShowSharePeek(true),
    onHistory: () => setShowHistoryPeek(true),
    onDuplicate: async () => {
      const newId = await handleDuplicatePage(peekPageId!);
      if (newId) setPeekPageId(newId);
    },
    onDelete: () => recurrence.requestDelete(peekPageId!),
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
            className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg-2 transition-colors"
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
              className="p-1 hover:bg-hover rounded-surface transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={database.icon ? tPage('changeIcon') : tPage('addIcon')}
            >
              <PageIcon icon={database.icon} iconColor={database.iconColor} size={36} fallbackType="database" />
            </button>
            {database.icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 focus-visible:opacity-100 h-6 px-2 text-2xs bg-fg text-desk rounded-control transition-opacity cursor-pointer font-medium whitespace-nowrap shadow-float z-20"
              >
                {tPage('removeIcon')}
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
            className="w-full bg-transparent text-fg font-semibold text-[28px] sm:text-[34px] leading-tight tracking-[-0.025em] outline-none placeholder:text-fg-4 py-1"
          />
        </div>
      </div>

      {/* Top bar */}
      <div className="flex items-end justify-between border-b border-line">
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

        <div className="flex items-center gap-0.5 pb-1.5">
          {/* Row/card drag-reorder + property save feedback — Table/Kanban/Calendar
              all funnel through the same persistReorder/trackSave helpers.
              Renders nothing (no layout footprint) once idle/faded, same as
              every other SaveStatus consumer in the app. */}
          <SaveStatus state={saveState} className="mr-1" />

          <Tooltip content={tWs('refresh')}>
            <Button variant="ghost" size="icon-sm" onClick={handleManualRefresh} aria-label={tWs('refresh')}>
              <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
          </Tooltip>

          {/* Width — hidden on mobile; the label names the current width */}
          <Tooltip content={tPage('widthLabel')}>
            <Button variant="ghost" size="sm" onClick={cycleWidth} className="hidden sm:inline-flex">
              <ArrowLeftRight />
              {widthLabels[widthMode]}
            </Button>
          </Tooltip>

          {/* Bulk add/update — hidden on mobile, paste-driven multi-row add/update */}
          <Tooltip content={t('bulkImport.button')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setBulkDialogOpen(true)}
              aria-label={t('bulkImport.button')}
              className="hidden sm:inline-flex"
            >
              <ClipboardList />
            </Button>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleSidebar(sidebarTab)}
            aria-pressed={sidebarOpen}
            className={sidebarOpen ? 'bg-hover text-fg' : ''}
          >
            <Settings /> {t('settings')}
          </Button>

          {/* New Page button — hidden on mobile (available via bottom nav) */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleHeaderNewClick}
            loading={pendingPageIds.size > 0}
            className="hidden sm:inline-flex ml-1.5"
          >
            <Plus /> {t('new')}
          </Button>
        </div>
      </div>

      {bulkDialogOpen && (
        <BulkRowsDialog
          databaseId={database.id}
          schema={schema}
          onClose={() => setBulkDialogOpen(false)}
        />
      )}

      {/* Content + Sidebar Area */}
      <div className="flex-1 flex gap-4 relative pt-4 pb-8 min-w-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden h-full pr-1">
          {isTableView && tableConfig ? (
            isGroupedTableView ? (
              <GroupedTableLayout
                database={liveDatabase}
                pages={processedPages}
                groupByCol={tableConfig.groupByCol!}
                groupOrder={tableConfig.groupOrder ?? []}
                hiddenGroups={tableConfig.hiddenGroups ?? []}
                collapsedGroups={tableConfig.collapsedGroups ?? []}
                onGroupOrderChange={handleGroupOrderChange}
                onCollapsedGroupsChange={handleCollapsedGroupsChange}
                columnOrder={tableConfig.columnOrder}
                hiddenColumns={tableConfig.hiddenColumns}
                columnWidths={tableConfig.columnWidths ?? {}}
                onColumnWidthsChange={handleColumnWidthsChange}
                rowColorCol={tableConfig.rowColorCol}
                onColumnOrderChange={handleColumnOrderChange}
                onRowClick={handlePageClick}
                onRowReorder={handleRowReorder}
                onDeletePage={handleDeletePage}
                onRecurringDelete={recurrence.requestDelete}
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
                database={liveDatabase}
                onSchemaChange={handleSchemaChange}
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
                onRecurringDelete={recurrence.requestDelete}
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
              database={liveDatabase}
              onSchemaChange={handleSchemaChange}
              pages={processedPages}
              groupByCol={kanbanConfig.groupByCol}
              groupOrder={kanbanConfig.groupOrder}
              onGroupOrderChange={handleGroupOrderChange}
              onCardClick={handlePageClick}
              onCardMove={handleCardReorder}
              onDeletePage={handleDeletePage}
              onRecurringDelete={recurrence.requestDelete}
              onDuplicatePage={handleDuplicatePage}
              hasSorts={(config.sorts?.length ?? 0) > 0}
              cardProperties={kanbanConfig.cardProperties}
              showPropertyLabels={kanbanConfig.showPropertyLabels ?? true}
              propertyTextClamp={kanbanConfig.propertyTextClamp ?? 'truncate'}
              cardMarkCol={kanbanConfig.cardColorCol ?? kanbanConfig.cardBgCol}
              onUpdatePageProperties={handleUpdatePageProperties}
              onCreatePage={(initialProperties) => handleAddRow(initialProperties, { openAfterCreate: true })}
              defaultPageIcon={config.defaultPageIcon}
              defaultPageIconColor={config.defaultPageIconColor}
              onPageIconChange={handlePageIconChange}
              onCardCollapsedChange={handlePageCardCollapsedChange}
              onCardsCollapsedChange={handlePagesCardCollapsedChange}
              hiddenGroups={kanbanConfig.hiddenGroups ?? []}
            />
          ) : calendarConfig ? (
            <CalendarView
              database={liveDatabase}
              currentUserId={currentUserId}
              pages={processedPages}
              dateCol={calendarConfig.dateCol}
              viewMode={calendarConfig.viewMode}
              firstDayOfWeek={calendarConfig.firstDayOfWeek || 'sunday'}
              hasSorts={(config.sorts?.length ?? 0) > 0}
              onCardClick={handlePageClick}
              onCardDateChange={handleCardDateChange}
              // A series mutation rewrites many rows at once, so re-fetch
              // rather than trying to patch `localPages` change-by-change.
              onSeriesChanged={() => tabNav.refresh()}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              cardMarkCol={calendarConfig.cardColorCol ?? calendarConfig.cardBgCol}
              cardProperties={calendarConfig.cardProperties}
              showPropertyLabels={calendarConfig.showPropertyLabels ?? true}
              propertyTextClamp={calendarConfig.propertyTextClamp ?? 'truncate'}
              onUpdatePageProperties={handleUpdatePageProperties}
              onCreatePage={(initialProperties) => handleAddRow(initialProperties, { openAfterCreate: true })}
              defaultPageIcon={config.defaultPageIcon}
              defaultPageIconColor={config.defaultPageIconColor}
              onPageIconChange={handlePageIconChange}
              onCardCollapsedChange={handlePageCardCollapsedChange}
              onCardsCollapsedChange={handlePagesCardCollapsedChange}
            />
          ) : null}
        </div>

        {/* Backdrop — desktop: transparent click-to-close, mobile: dark overlay */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 bg-overlay sm:bg-transparent z-20 cursor-default sm:pointer-events-auto"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Panel — desktop: right panel, mobile: bottom sheet */}
        {sidebarOpen && (
          <div className="
            z-30 flex flex-col overflow-hidden
            fixed inset-x-0 bottom-14 max-h-[85vh] rounded-t-2xl border-t border-line
            sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-0 sm:right-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-t-0 sm:flex-row sm:overflow-visible
          ">
            <DatabasePropertiesSidebar
              database={liveDatabase}
              onSchemaChange={handleSchemaChange}
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
              cardMarkCol={
                kanbanConfig ? (kanbanConfig.cardColorCol ?? kanbanConfig.cardBgCol)
                : calendarConfig ? (calendarConfig.cardColorCol ?? calendarConfig.cardBgCol)
                : undefined
              }
              onCardMarkColChange={handleCardMarkColChange}
              rowColorCol={(config as TableViewConfig).rowColorCol}
              onRowColorColChange={handleRowColorColChange}
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
          <div
            onClick={() => setPeekPageId(null)}
            className="absolute inset-0 bg-overlay z-50 animate-fade-in transition-opacity cursor-pointer animate-duration-200"
          />

          {/* Center Peek Modal */}
          {(config.openBehavior ?? 'center') === 'center' && (
            // Sized to the view's own box, not the viewport: a vh height ran past the
            // top of the view on phones, under whatever sits above it (the demo bar).
            <div className="absolute z-50 inset-0 flex items-end pt-3 pointer-events-none sm:items-center sm:justify-center sm:p-4 md:p-10">
              <div className="w-full sm:max-w-4xl max-h-full bg-sheet flex flex-col shadow-modal overflow-hidden rounded-t-surface sm:rounded-surface pointer-events-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                <PeekHeader
                  title={peekScrolled && peekPage ? (peekPage.properties?.title || tPage('untitled')) : null}
                  {...peekHeaderActions}
                />

                {/* Peek Editor Scrollable Content */}
                <div
                  className="flex-1 overflow-y-auto min-h-0"
                  onScroll={(e) => setPeekScrolled(e.currentTarget.scrollTop > 40)}
                >
                  {isPageLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-fg-3 gap-2 animate-fade-in">
                      <Loader2 size={20} className="animate-spin" aria-hidden />
                      <span className="text-xs">{t('loadingPage')}</span>
                    </div>
                  ) : (
                    peekPage && (
                      <PageEditor
                        ref={peekEditorRef}
                        database={liveDatabase}
                        onSchemaChange={handleSchemaChange}
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
              className="absolute z-50 flex flex-col overflow-hidden bg-sheet inset-x-0 bottom-0 max-h-[calc(100%-0.75rem)] rounded-t-surface shadow-modal sm:left-auto sm:top-0 sm:right-0 sm:bottom-0 sm:h-full sm:max-h-none sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
              style={isDesktopViewport ? { width: sidePeekWidth, maxWidth: '95vw' } : undefined}
            >
              {isDesktopViewport && (
                <div
                  data-no-block-marquee
                  onMouseDown={handleSidePeekResizeStart}
                  className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-signal/50 active:bg-signal/70 transition-colors z-20"
                  title={t('resizePanel')}
                />
              )}
              <PeekHeader
                title={peekScrolled && peekPage ? (peekPage.properties?.title || tPage('untitled')) : null}
                {...peekHeaderActions}
              />

              {/* Peek Editor Scrollable Content */}
              <div
                className="flex-1 overflow-y-auto min-h-0"
                onScroll={(e) => setPeekScrolled(e.currentTarget.scrollTop > 40)}
              >
                {isPageLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-fg-3 gap-2 animate-fade-in">
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                    <span className="text-xs">{t('loadingPage')}</span>
                  </div>
                ) : (
                  peekPage && (
                    <PageEditor
                      ref={peekEditorRef}
                      database={liveDatabase}
                      onSchemaChange={handleSchemaChange}
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
      {markdownDraft !== null && (
        <PageMarkdownDialog
          initialMarkdown={markdownDraft}
          onApply={(md) => peekEditorRef.current?.replaceContent(md)}
          onClose={() => setMarkdownDraft(null)}
        />
      )}
      {showSharePeek && peekPageId && (
        <ShareModal
          pageId={peekPageId}
          workspaceId={database.workspaceId}
          isAdmin={false}
          onClose={() => setShowSharePeek(false)}
        />
      )}
      {showHistoryPeek && peekPageId && (
        <PageHistoryModal
          workspaceId={database.workspaceId}
          pageId={peekPageId}
          currentContent={peekEditorRef.current?.getMarkdown() ?? peekPage?.content ?? ''}
          onRestored={(content) => peekEditorRef.current?.replaceContent(content)}
          onClose={() => setShowHistoryPeek(false)}
        />
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
      {recurrence.node}
    </div>
    </MembersProvider>
  );
}

/**
 * The row peek's top bar: close on the left (with the row's title once the body has
 * scrolled past it), "Open in full page" and the row's menu on the right.
 */
function PeekHeader({
  title,
  onClose,
  onOpenFull,
  onMarkdown,
  onShare,
  onHistory,
  onDuplicate,
  onDelete,
}: {
  title: string | null;
  onClose: () => void;
  onOpenFull: () => void;
  onMarkdown: () => void;
  onShare: () => void;
  onHistory: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const tSharing = useTranslations('Sharing');
  const tUi = useTranslations('UI');
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip content={tUi('close')}>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={tUi('close')}>
            <X />
          </Button>
        </Tooltip>
        {title && (
          <span className="truncate text-sm font-medium text-fg animate-fade-in">{title}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onOpenFull} aria-label={t('openInFullPage')}>
          <Maximize2 />
          <span className="hidden sm:inline">{t('openInFullPage')}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            aria-label={tPage('pageOptions')}
            title={tPage('pageOptions')}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMarkdown}>
              <FileCode2 />
              {tPage('markdown.button')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>
              <Globe />
              {tSharing('shareButton')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHistory}>
              <History />
              {tPage('history.button')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy />
              {t('duplicatePage')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {tPage('deletePage')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
