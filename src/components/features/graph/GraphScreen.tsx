'use client';

/**
 * The workspace knowledge map (`/graph/<workspaceId>`). Client-only: it is
 * itself loaded through `next/dynamic` (`GraphRouteClient`), and the WebGL
 * renderer below it is a second dynamic chunk, so the toolbar and panel appear
 * while sigma is still downloading.
 *
 * What makes it a maintenance view rather than a picture is the right-hand
 * "Needs attention" panel (computed server-side over the whole workspace, see
 * `services/graph.ts`), the trust colouring, and the agent-activity colouring.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database as DatabaseIcon,
  FileCode,
  FileText,
  Folder,
  Hash,
  LayoutDashboard,
  Layers,
  Loader2,
  Maximize2,
  Network,
  RotateCcw,
  Search,
  Waypoints,
  X,
} from 'lucide-react';
import { getWorkspaceGraphData, type GraphWorkspace } from '@/lib/actions/graph';
import { openOrCreateHomeDashboard } from '@/lib/actions/dashboard';
import { CHANGE_EVENT, mayPredateRender } from '@/components/providers/ActivityTracker';
import { createInteractionGate } from '@/lib/interactionGate';
import { foldText } from '@/lib/services/textFold';
import {
  ACTIVITY_DAY_OPTIONS,
  DEFAULT_ACTIVITY_DAYS,
  EDGE_KIND,
  NODE_KIND,
  NODE_STATE,
  graphNodeHref,
  isCodeKind,
  statusOf,
  trustOf,
  type AttentionEntry,
  type GraphNodeTuple,
  type GraphPayload,
  type NodeKindCode,
} from '@/lib/graph/types';
import type { GraphCanvasHandle, GraphColorMode, GraphLayers, GraphLayoutMode } from './GraphCanvas';
import { SimpleSelect } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import PageIcon from '@/components/features/PageIcon';
import { MENU_EMPTY, MENU_SURFACE, menuItem } from '@/components/features/editor/menuStyles';
import { readGraphTheme, watchTheme, type GraphTheme } from './graphTheme';

const GraphCanvas = dynamic(() => import('./GraphCanvas'), { ssr: false });

const PREFS_KEY = 'remnus_graph_view_v1';
// The code layer starts off: it is a second map on top of the first, and its
// nodes are fetched only once someone turns it on.
const DEFAULT_LAYERS: GraphLayers = { hierarchy: true, membership: true, link: true, mention: true, tag: true, code: false };

type Prefs = { layout: GraphLayoutMode; colorMode: GraphColorMode; layers: GraphLayers; activityDays: number };

// Per-viewer convenience only: every read and write may fail (private window, blocked storage).
function readPrefs(): Prefs {
  const fallback: Prefs = { layout: 'network', colorMode: 'type', layers: DEFAULT_LAYERS, activityDays: DEFAULT_ACTIVITY_DAYS };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    return {
      layout: raw.layout === 'tree' ? 'tree' : 'network',
      colorMode: ['type', 'trust', 'agent', 'cluster'].includes(raw.colorMode) ? raw.colorMode : 'type',
      layers: { ...DEFAULT_LAYERS, ...(raw.layers ?? {}) },
      activityDays: (ACTIVITY_DAY_OPTIONS as readonly number[]).includes(raw.activityDays) ? raw.activityDays : DEFAULT_ACTIVITY_DAYS,
    };
  } catch {
    return fallback;
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

const KIND_ICON: Record<NodeKindCode, typeof FileText> = {
  [NODE_KIND.page]: FileText,
  [NODE_KIND.database]: DatabaseIcon,
  [NODE_KIND.dashboard]: LayoutDashboard,
  [NODE_KIND.row]: FileText,
  [NODE_KIND.tag]: Hash,
  [NODE_KIND.file]: FileCode,
  [NODE_KIND.folder]: Folder,
};

/**
 * Clusters only mean something when there are relations beyond the tree to
 * cluster on; below this the option is hidden rather than offered as noise.
 * Code-layer edges do not count: turning the layer on must not change what
 * the colour menu offers.
 */
function clustersAvailable(payload: GraphPayload): boolean {
  let relations = 0;
  for (const edge of payload.edges) if (edge[2] >= EDGE_KIND.link && edge[2] <= EDGE_KIND.tag) relations++;
  return relations >= Math.max(20, payload.nodes.length * 0.3);
}

/**
 * Live refresh: refetch when the change signal moves past what the map shows,
 * never mid-drag or mid-typing.
 *
 * The first broadcast is NOT a safe baseline here (unlike `useWorkspaceEvents`,
 * whose server render is current by definition): this screen is a dynamic
 * chunk that fetches after mount, so the tracker's immediate ping has usually
 * gone by, and the first value heard can be 30s later — a write in between
 * would be taken as the baseline and never shown (found in P12 verification).
 * So the baseline is the payload's own `generatedAt`: a version at or after it
 * may not be on the map yet. The same rule settles same-second writes: a version
 * the shown payload may predate (`mayPredateRender`) gets one more refetch on a
 * later tick, even though it did not advance.
 */
function useChangeSignal(onChange: () => void, shownAt: React.RefObject<number | null>) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => {
    let handled: number | null = null;
    let pending = false;
    let settled: number | null = null; // the version a settle refetch already ran for
    const flush = () => {
      if (!pending || gate.isBlocked()) return;
      pending = false;
      callback.current();
    };
    const gate = createInteractionGate(flush);
    const listener = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(value)) return;
      if (handled !== null && value <= handled) {
        // Unchanged version: refetch once if the map may have been generated before
        // the last write of that second landed (`shownAt` is epoch seconds).
        if (value === handled && settled !== value && shownAt.current !== null && mayPredateRender(value, shownAt.current * 1000)) {
          settled = value;
          pending = true;
          flush();
        }
        return;
      }
      const firstHeard = handled === null;
      handled = value;
      // Same-second writes may or may not be in the snapshot: refetching once is cheaper than missing one.
      if (firstHeard && shownAt.current !== null && value < shownAt.current) return;
      pending = true;
      flush();
    };
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener(CHANGE_EVENT, listener);
      gate.dispose();
    };
  }, [shownAt]);
}

function useRelativeTime() {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return (epochSeconds: number) => {
      const diff = epochSeconds - Date.now() / 1000;
      const abs = Math.abs(diff);
      if (abs < 3600) return format.format(Math.round(diff / 60), 'minute');
      if (abs < 86_400) return format.format(Math.round(diff / 3600), 'hour');
      return format.format(Math.round(diff / 86_400), 'day');
    };
  }, [locale]);
}

export default function GraphScreen({
  workspace,
  switchable,
}: {
  workspace: GraphWorkspace & { homeDashboardItemId: string | null };
  /** Workspaces the map can switch to; null in a project window (one workspace only). */
  switchable: GraphWorkspace[] | null;
}) {
  const t = useTranslations('Graph');
  const tWorkspace = useTranslations('Workspace');
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [openingHome, startOpenHome] = useTransition();
  const [homeFailed, setHomeFailed] = useState(false);
  const relative = useRelativeTime();
  const canvas = useRef<GraphCanvasHandle>(null);

  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The database whose rows are on their way (show/hide rows), and the list to go
  // back to if that request fails — one toggle at a time.
  const [rowsPending, setRowsPending] = useState<string | null>(null);
  const rowsRevert = useRef<string[] | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const request = useRef(0);
  const shownAt = useRef<number | null>(null);

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePrefs(next);
      return next;
    });
  };

  const showCode = prefs.layers.code;
  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const data = await getWorkspaceGraphData(workspace.id, { expanded, activityDays: prefs.activityDays, code: showCode });
      if (id !== request.current) return;
      shownAt.current = data.generatedAt;
      rowsRevert.current = null;
      setRowsPending(null);
      setPayload(data);
      setFailed(false);
    } catch {
      if (id !== request.current) return;
      // A rows toggle that could not load goes back, so its button offers it again.
      const previous = rowsRevert.current;
      rowsRevert.current = null;
      setRowsPending(null);
      if (previous) setExpanded(previous);
      setFailed(true);
    }
  }, [workspace.id, expanded, prefs.activityDays, showCode]);

  useEffect(() => {
    void load();
  }, [load]);
  useChangeSignal(() => void load(), shownAt);

  const index = useMemo(() => new Map((payload?.nodes ?? []).map((node, i) => [node[0], i])), [payload]);
  const nodeById = useCallback((id: string | null): GraphNodeTuple | null => {
    if (!id || !payload) return null;
    const i = index.get(id);
    return i === undefined ? null : payload.nodes[i];
  }, [index, payload]);

  // A row picked from the attention panel while its database is folded: expand,
  // then select it once it is on the map.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id || !payload || !index.has(id)) return;
    pendingFocus.current = null;
    setSelectedId(id);
    // Positions exist only after the canvas has synced this payload.
    const timer = setTimeout(() => canvas.current?.focus(id), 150);
    return () => clearTimeout(timer);
  }, [payload, index]);

  const canCluster = payload ? clustersAvailable(payload) : false;
  const colorMode: GraphColorMode = prefs.colorMode === 'cluster' && !canCluster ? 'type' : prefs.colorMode;
  const hasTags = !!payload?.nodes.some((node) => node[1] === NODE_KIND.tag);
  const codePaths = payload?.codePaths ?? 0;

  const open = (id: string) => {
    const node = nodeById(id);
    const href = node && payload ? graphNodeHref(node, payload.nodes) : null;
    if (href) router.push(href);
  };

  const toggleDatabase = (id: string) => {
    if (rowsPending) return;
    rowsRevert.current = expanded;
    setRowsPending(id);
    setExpanded(expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id]);
  };

  const switchWorkspace = (id: string) => {
    if (id !== workspace.id) startSwitch(() => router.push(`/graph/${id}`));
  };

  // Like the sidebar's Pano button: no home dashboard yet → create it, then open it.
  const openHome = () => {
    if (openingHome) return;
    setHomeFailed(false);
    startOpenHome(async () => {
      try {
        const { itemId } = await openOrCreateHomeDashboard(workspace.id, tWorkspace('dashboardShort'));
        router.push(`/dashboard/${itemId}`);
      } catch (err) {
        console.error('[Remnus] could not open the workspace dashboard:', err);
        setHomeFailed(true);
      }
    });
  };
  const homeClass = cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0');

  const pickEntry = (entry: AttentionEntry) => {
    const [id, , , databaseItemId] = entry;
    setAttentionOpen(false);
    if (index.has(id)) {
      setSelectedId(id);
      canvas.current?.focus(id);
      return;
    }
    if (databaseItemId) {
      pendingFocus.current = id;
      if (expanded.includes(databaseItemId) || rowsPending) return;
      rowsRevert.current = expanded;
      setRowsPending(databaseItemId);
      setExpanded([...expanded, databaseItemId]);
    }
  };

  const suggestions = useMemo(() => {
    const q = foldText(query.trim());
    if (!q || !payload) return [];
    const out: GraphNodeTuple[] = [];
    for (const node of payload.nodes) {
      if (node[1] === NODE_KIND.tag || !foldText(node[2]).includes(q)) continue;
      out.push(node);
      if (out.length === 8) break;
    }
    return out;
  }, [query, payload]);

  const choose = (node: GraphNodeTuple) => {
    setQuery('');
    setHighlightId(null);
    setSelectedId(node[0]);
    canvas.current?.focus(node[0]);
  };

  const selected = nodeById(selectedId);
  const attention = payload?.attention;
  const attentionCount = attention ? attention.orphanTotal + attention.outdatedTotal + attention.hubs.length : 0;
  const graphTheme = useGraphTheme();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-sheet">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        {/* Whose map this is, and the way back to that project's dashboard. */}
        <div className="mr-1 flex min-w-0 items-center gap-2">
          {switchable && switchable.length > 1 ? (
            <SimpleSelect
              aria-label={t('switchWorkspace')}
              value={workspace.id}
              onValueChange={switchWorkspace}
              disabled={switching}
              size="sm"
              className="max-w-52"
              options={switchable.map((w) => ({ value: w.id, label: w.name, icon: <WorkspaceBadge workspace={w} /> }))}
            />
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 text-ui font-medium text-fg-2">
              <WorkspaceBadge workspace={workspace} />
              <span className="max-w-52 truncate">{workspace.name}</span>
            </span>
          )}
          {switching ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-fg-3 motion-reduce:animate-none" aria-hidden />
          ) : (
            <span aria-hidden className="text-fg-4">/</span>
          )}
          <h1 className="shrink-0 text-sm font-semibold text-fg">{t('title')}</h1>
          {workspace.homeDashboardItemId ? (
            <Link href={`/dashboard/${workspace.homeDashboardItemId}`} title={t('openDashboard')} className={homeClass}>
              <LayoutDashboard />
              {tWorkspace('dashboardShort')}
            </Link>
          ) : (
            <Button variant="secondary" size="sm" onClick={openHome} loading={openingHome} title={t('openDashboard')} className="shrink-0">
              <LayoutDashboard />
              {tWorkspace('dashboardShort')}
            </Button>
          )}
          {homeFailed && <span role="alert" className="text-xs text-red-400">{tWorkspace('dashboardOpenFailed')}</span>}
        </div>

        <Tabs
          value={prefs.layout}
          onValueChange={(value) => updatePrefs({ layout: value as GraphLayoutMode })}
          variant="segmented"
          aria-label={t('layoutLabel')}
        >
          <TabsList>
            <TabsTab value="network">
              <Waypoints />
              {t('layoutNetwork')}
            </TabsTab>
            <TabsTab value="tree">
              <Network />
              {t('layoutTree')}
            </TabsTab>
          </TabsList>
        </Tabs>

        <label className="flex items-center gap-1.5 text-xs text-fg-3">
          <span className="hidden sm:inline">{t('colorLabel')}</span>
          <SimpleSelect
            value={colorMode}
            onValueChange={(v) => updatePrefs({ colorMode: v as GraphColorMode })}
            size="sm"
            options={[
              { value: 'type', label: t('colorType') },
              { value: 'trust', label: t('colorTrust') },
              { value: 'agent', label: t('colorAgent') },
              ...(canCluster ? [{ value: 'cluster', label: t('colorCluster') }] : []),
            ]}
          />
        </label>

        {colorMode === 'agent' && (
          <SimpleSelect
            aria-label={t('activityLabel')}
            value={String(prefs.activityDays)}
            onValueChange={(v) => updatePrefs({ activityDays: Number(v) })}
            size="sm"
            options={ACTIVITY_DAY_OPTIONS.map((days) => ({ value: String(days), label: t('activityDays', { days }) }))}
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <Layers />
            {t('layersLabel')}
            <ChevronDown className="text-fg-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-52">
            {(['hierarchy', 'membership', 'link', 'mention', 'tag', 'code'] as const)
              .filter((layer) => (layer !== 'tag' || hasTags) && (layer !== 'code' || codePaths > 0))
              .map((layer) => (
                <DropdownMenuCheckboxItem
                  key={layer}
                  checked={prefs.layers[layer]}
                  onCheckedChange={(checked) => updatePrefs({ layers: { ...prefs.layers, [layer]: checked } })}
                >
                  <EdgeSwatch kind={layer} theme={graphTheme} />
                  {layer === 'code' ? t('layer_code', { count: codePaths }) : t(`layer_${layer}`)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden />
          <Input
            size="sm"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0]) choose(suggestions[0]);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="pl-7"
          />
          {query.trim() && (
            <div className={`absolute left-0 right-0 top-full z-30 mt-1 ${MENU_SURFACE}`}>
              {suggestions.length === 0 ? (
                <p className={MENU_EMPTY}>{t('searchEmpty')}</p>
              ) : suggestions.map((node) => {
                const Icon = KIND_ICON[node[1]];
                return (
                  <button
                    key={node[0]}
                    type="button"
                    onClick={() => choose(node)}
                    onMouseEnter={() => setHighlightId(node[0])}
                    onMouseLeave={() => setHighlightId(null)}
                    className={menuItem()}
                  >
                    <Icon size={16} className="shrink-0 text-fg-3" aria-hidden />
                    <span className="truncate">{node[2] || t('untitled')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {arranging && (
            <span className="flex items-center gap-1.5 px-1 text-xs text-fg-3" aria-live="polite">
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
              <span className="hidden sm:inline">{t('arranging')}</span>
            </span>
          )}
          {prefs.layout === 'network' && (
            <Tooltip content={t('relayout')}>
              <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.relayout()} aria-label={t('relayout')}>
                <RotateCcw />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('fit')}>
            <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.fit()} aria-label={t('fit')}>
              <Maximize2 />
            </Button>
          </Tooltip>
          <Button variant="secondary" size="sm" onClick={() => setAttentionOpen((v) => !v)} className="lg:hidden">
            <AlertTriangle className="text-signal-text" />
            {t('attentionToggle', { count: attentionCount })}
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          {failed && !payload ? (
            <CenterMessage>
              <EmptyState
                icon={<AlertTriangle />}
                title={t('loadFailed')}
              >
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  {t('retry')}
                </Button>
              </EmptyState>
            </CenterMessage>
          ) : !payload ? (
            <CenterMessage>
              <p className="flex items-center gap-2 text-ui text-fg-3">
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                {t('loading')}
              </p>
            </CenterMessage>
          ) : payload.nodes.length === 0 ? (
            <CenterMessage>
              <EmptyState icon={<Waypoints />} title={t('emptyTitle')} description={t('emptyHint')} />
            </CenterMessage>
          ) : (
            <>
              <GraphCanvas
                payload={payload}
                layout={prefs.layout}
                colorMode={colorMode}
                layers={prefs.layers}
                highlightId={highlightId}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpen={open}
                onLayoutRunning={setArranging}
                handleRef={canvas}
              />
              <Legend colorMode={colorMode} auditLimited={!!payload.auditLimited} showCode={showCode && codePaths > 0} theme={graphTheme} />
              {rowsPending && (
                <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-control bg-float px-2.5 py-1.5 text-xs text-fg-2 shadow-float">
                  <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                  {t('loadingRows')}
                </div>
              )}
              {selected && (
                <SelectionCard
                  node={selected}
                  payload={payload}
                  expanded={expanded.includes(selected[0])}
                  rowsLoading={rowsPending === selected[0]}
                  rowsBusy={rowsPending !== null}
                  relative={relative}
                  onClose={() => setSelectedId(null)}
                  onToggleRows={() => toggleDatabase(selected[0])}
                />
              )}
            </>
          )}
        </div>

        {/* Needs attention: a column on wide screens, a bottom sheet on narrow ones. */}
        {attention && (
          <aside
            className={`${attentionOpen ? 'flex' : 'hidden'} fixed inset-x-0 bottom-14 z-40 max-h-[65vh] flex-col rounded-t-surface bg-float shadow-modal lg:static lg:z-auto lg:flex lg:max-h-none lg:w-72 lg:shrink-0 lg:rounded-none lg:border-l lg:border-line lg:bg-sheet lg:shadow-none`}
            aria-label={t('attentionTitle')}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
              <h2 className="text-ui font-semibold text-fg">{t('attentionTitle')}</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setAttentionOpen(false)} aria-label={t('close')} className="lg:hidden">
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {attentionCount === 0 ? (
                <EmptyState size="sm" icon={<Check />} title={t('allClear')} />
              ) : (
                <>
                  <AttentionGroup
                    title={t('orphansTitle')}
                    hint={t('orphansHint')}
                    entries={attention.orphans}
                    total={attention.orphanTotal}
                    meta={(entry) => (entry[4] > 0 ? t('mentionedIn', { count: entry[4] }) : null)}
                    onPick={pickEntry}
                    onHover={setHighlightId}
                  />
                  <AttentionGroup
                    title={t('outdatedTitle')}
                    hint={t('outdatedHint')}
                    entries={attention.outdated}
                    total={attention.outdatedTotal}
                    meta={(entry) => (statusOf(entry[4]) === 3 ? t('trustDeprecated') : t('trustStale'))}
                    onPick={pickEntry}
                    onHover={setHighlightId}
                  />
                  <AttentionGroup
                    title={t('hubsTitle')}
                    hint={t('hubsHint')}
                    entries={attention.hubs}
                    total={attention.hubs.length}
                    meta={(entry) => t('connections', { count: entry[4] })}
                    onPick={pickEntry}
                    onHover={setHighlightId}
                  />
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * The live graph colours for the HTML around the canvas (legend, layer swatches), so a
 * swatch is always the colour the WebGL renderer draws — re-read when the theme changes.
 */
function useGraphTheme(): GraphTheme | null {
  const themeName = useSyncExternalStore(
    watchTheme,
    () => document.documentElement.dataset.theme ?? '',
    () => null,
  );
  return useMemo(() => (themeName === null ? null : readGraphTheme()), [themeName]);
}

/** A workspace's own icon, or its initial — the same mark the sidebar shows. */
function WorkspaceBadge({ workspace }: { workspace: GraphWorkspace }) {
  if (workspace.icon) return <PageIcon icon={workspace.icon} iconColor={workspace.iconColor} size={16} hideFallback={false} className="shrink-0 rounded" />;
  return (
    <span translate="no" className="notranslate flex size-4 shrink-0 items-center justify-center rounded-sm bg-ink text-2xs font-semibold text-ink-fg">
      {(workspace.name || 'W').trim().charAt(0).toUpperCase()}
    </span>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{children}</div>;
}

const EDGE_THEME_KEY: Record<keyof GraphLayers, keyof GraphTheme['edge']> = {
  hierarchy: 'hierarchy',
  membership: 'membership',
  link: 'link',
  mention: 'mention',
  tag: 'tag',
  code: 'source',
};

function EdgeSwatch({ kind, theme }: { kind: keyof GraphLayers; theme: GraphTheme | null }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-4 shrink-0 border-t-2 ${kind === 'mention' ? 'border-dashed' : ''}`}
      style={{ borderTopColor: theme?.edge[EDGE_THEME_KEY[kind]] }}
    />
  );
}

function Legend({
  colorMode,
  auditLimited,
  showCode,
  theme,
}: {
  colorMode: GraphColorMode;
  auditLimited: boolean;
  showCode: boolean;
  theme: GraphTheme | null;
}) {
  const t = useTranslations('Graph');
  if (!theme) return null;
  // Code files keep their own colour in every mode (they carry no trust or agent state).
  const code: Array<[string, string]> = showCode ? [[theme.kind.file, t('kindFile')]] : [];
  const entries: Array<[string, string]> =
    colorMode === 'trust'
      ? [
          [theme.trust.reviewed, t('trustReviewed')],
          [theme.trust.confirmed, t('trustConfirmed')],
          [theme.trust.draft, t('trustDraft')],
          [theme.trust.stale, t('trustStale')],
          [theme.trust.deprecated, t('trustDeprecated')],
          [theme.trust.none, t('trustNone')],
          ...code,
        ]
      : colorMode === 'agent'
        ? [
            [theme.agent.wrote, t('agentWrote')],
            [theme.agent.read, t('agentRead')],
            [theme.agent.none, t('agentNone')],
            ...code,
          ]
        : colorMode === 'cluster'
          ? code
          : [
              [theme.kind.page, t('kindPage')],
              [theme.kind.database, t('kindDatabase')],
              [theme.kind.row, t('kindRow')],
              [theme.kind.dashboard, t('kindDashboard')],
              [theme.kind.tag, t('kindTag')],
              ...code,
            ];
  if (entries.length === 0 && !auditLimited) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-3 max-w-56 rounded-control bg-float/95 px-2.5 py-2 text-xs text-fg-2 shadow-float">
      <ul className="space-y-1">
        {entries.map(([color, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </li>
        ))}
      </ul>
      {colorMode === 'agent' && auditLimited && <p className="mt-1.5 text-fg-3">{t('auditLimited')}</p>}
    </div>
  );
}

function SelectionCard({
  node,
  payload,
  expanded,
  rowsLoading,
  rowsBusy,
  relative,
  onClose,
  onToggleRows,
}: {
  node: GraphNodeTuple;
  payload: GraphPayload;
  expanded: boolean;
  /** This database's rows are being fetched. */
  rowsLoading: boolean;
  /** Some database's rows are being fetched (one toggle at a time). */
  rowsBusy: boolean;
  relative: (epochSeconds: number) => string;
  onClose: () => void;
  onToggleRows: () => void;
}) {
  const t = useTranslations('Graph');
  const [, kind, title, state, agentAt, , count] = node;
  const href = graphNodeHref(node, payload.nodes);
  const Icon = KIND_ICON[kind];

  const connections = useMemo(() => {
    const at = payload.nodes.indexOf(node);
    const byKind = [0, 0, 0, 0, 0, 0, 0];
    for (const [s, target, edgeKind] of payload.edges) if (s === at || target === at) byKind[edgeKind]++;
    return byKind;
  }, [node, payload]);
  const code = isCodeKind(kind);

  const status = statusOf(state);
  const trust =
    status === 3 ? t('trustDeprecated')
      : state & NODE_STATE.stale ? t('trustStale')
        : trustOf(state) === 2 ? t('trustReviewed')
          : status === 1 ? t('trustDraft')
            : trustOf(state) === 1 || status === 2 ? t('trustConfirmed')
              : null;
  const agent =
    state & NODE_STATE.agentWrote ? t('agentWroteAt', { time: relative(agentAt) })
      : state & NODE_STATE.agentRead ? t('agentReadAt', { time: relative(agentAt) })
        : null;
  const kindLabel = [t('kindPage'), t('kindDatabase'), t('kindDashboard'), t('kindRow'), t('kindTag'), t('kindFile'), t('kindFolder')][kind];
  const links = connections[EDGE_KIND.link];
  const mentions = connections[EDGE_KIND.mention];

  return (
    // Kept clear of the cookie bar while it is up (its height is published as a CSS
    // variable), so the card's buttons are never under it (R7 note).
    <div
      className="absolute inset-x-3 z-10 rounded-surface bg-float shadow-float sm:inset-x-auto sm:left-3 sm:w-80"
      style={{ bottom: 'calc(var(--consent-banner-height, 0px) + 0.75rem)' }}
    >
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <Icon size={16} className="mt-0.5 shrink-0 text-fg-3" aria-hidden />
        <div className="min-w-0 flex-1">
          {/* A repo path wraps instead of truncating: its end (the file name) is the part that matters. */}
          <p className={`${code ? 'break-all font-mono text-xs' : 'truncate text-sm'} font-semibold text-fg`} title={title}>{title || t('untitled')}</p>
          <p className="text-xs text-fg-3">{trust ? t('kindWithTrust', { kind: kindLabel, trust }) : kindLabel}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')} className="-mr-1.5 -mt-1">
          <X />
        </Button>
      </div>
      <div className="space-y-0.5 px-4 pt-2 text-xs text-fg-2">
        {kind !== NODE_KIND.tag && !code && <p>{t('linkSummary', { links, mentions })}</p>}
        {kind === NODE_KIND.tag && <p>{t('tagMembers', { count: count ?? 0 })}</p>}
        {code && (count ?? 0) > 0 && <p>{t('codeRefs', { count: count ?? 0 })}</p>}
        {code && <p className="text-fg-3">{t('codeHint')}</p>}
        {agent && (
          <p className="flex items-center gap-1.5 text-fg">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />
            {agent}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 pb-3.5 pt-3">
        {href && (
          <Link href={href} className={buttonVariants({ variant: 'primary', size: 'xs' })}>
            {t('open')}
          </Link>
        )}
        {kind === NODE_KIND.database && (count ?? 0) > 0 && (
          <Button variant="secondary" size="xs" onClick={onToggleRows} loading={rowsLoading} disabled={rowsBusy}>
            {expanded ? t('hideRows') : t('showRows', { count: count ?? 0 })}
          </Button>
        )}
      </div>
    </div>
  );
}

function AttentionGroup({
  title,
  hint,
  entries,
  total,
  meta,
  onPick,
  onHover,
}: {
  title: string;
  hint: string;
  entries: AttentionEntry[];
  total: number;
  meta: (entry: AttentionEntry) => string | null;
  onPick: (entry: AttentionEntry) => void;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations('Graph');
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-ui font-medium text-fg">{title}</h3>
        <span className="text-xs tabular-nums text-fg-3">{total}</span>
      </div>
      <p className="mt-0.5 text-xs leading-snug text-fg-3">{hint}</p>
      {entries.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-3">
          <Check size={14} className="shrink-0" aria-hidden />
          {t('allClear')}
        </p>
      ) : (
        <ul className="-mx-2 mt-2">
          {entries.map((entry) => {
            const Icon = KIND_ICON[entry[1]];
            const detail = meta(entry);
            return (
              <li key={entry[0]}>
                <button
                  type="button"
                  onClick={() => onPick(entry)}
                  onMouseEnter={() => onHover(entry[0])}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(entry[0])}
                  onBlur={() => onHover(null)}
                  className="flex w-full cursor-pointer items-start gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:bg-hover"
                >
                  <Icon size={14} className="mt-0.5 shrink-0 text-fg-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui text-fg-2">{entry[2] || t('untitled')}</span>
                    {detail && <span className="block text-xs text-fg-3">{detail}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {total > entries.length && <p className="mt-1 text-xs text-fg-3">{t('more', { count: total - entries.length })}</p>}
    </section>
  );
}
