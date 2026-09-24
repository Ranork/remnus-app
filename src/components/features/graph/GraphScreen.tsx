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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getWorkspaceGraphData } from '@/lib/actions/graph';
import { CHANGE_EVENT } from '@/components/providers/ActivityTracker';
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
 * may not be on the map yet.
 */
function useChangeSignal(onChange: () => void, shownAt: React.RefObject<number | null>) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => {
    let handled: number | null = null;
    let pending = false;
    const flush = () => {
      if (!pending || gate.isBlocked()) return;
      pending = false;
      callback.current();
    };
    const gate = createInteractionGate(flush);
    const listener = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(value) || (handled !== null && value <= handled)) return;
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

export default function GraphScreen({ workspace }: { workspace: { id: string; name: string } }) {
  const t = useTranslations('Graph');
  const router = useRouter();
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
  const [layersOpen, setLayersOpen] = useState(false);
  const [query, setQuery] = useState('');
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
      setPayload(data);
      setFailed(false);
    } catch {
      if (id === request.current) setFailed(true);
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
    setExpanded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

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
      setExpanded((list) => (list.includes(databaseItemId) ? list : [...list, databaseItemId]));
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-neutral-850">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
        <div className="mr-1 flex min-w-0 items-baseline gap-2">
          <h1 className="text-sm font-medium text-neutral-100">{t('title')}</h1>
          <span className="hidden truncate text-xs text-neutral-500 sm:inline">{workspace.name}</span>
        </div>

        <div className="flex border border-neutral-800" role="group" aria-label={t('layoutLabel')}>
          {(['network', 'tree'] as const).map((mode) => {
            const Icon = mode === 'network' ? Waypoints : Network;
            const active = prefs.layout === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => updatePrefs({ layout: mode })}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs transition-colors ${active ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Icon size={13} />
                {mode === 'network' ? t('layoutNetwork') : t('layoutTree')}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="hidden sm:inline">{t('colorLabel')}</span>
          <select
            value={colorMode}
            onChange={(e) => updatePrefs({ colorMode: e.target.value as GraphColorMode })}
            className="border border-neutral-800 bg-neutral-850 px-1.5 py-1 text-xs text-neutral-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            <option value="type">{t('colorType')}</option>
            <option value="trust">{t('colorTrust')}</option>
            <option value="agent">{t('colorAgent')}</option>
            {canCluster && <option value="cluster">{t('colorCluster')}</option>}
          </select>
        </label>

        {colorMode === 'agent' && (
          <select
            aria-label={t('activityLabel')}
            value={prefs.activityDays}
            onChange={(e) => updatePrefs({ activityDays: Number(e.target.value) })}
            className="border border-neutral-800 bg-neutral-850 px-1.5 py-1 text-xs text-neutral-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            {ACTIVITY_DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>{t('activityDays', { days })}</option>
            ))}
          </select>
        )}

        <div className="relative">
          <button
            type="button"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen((v) => !v)}
            className="flex items-center gap-1.5 border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:text-neutral-50"
          >
            <Layers size={13} />
            {t('layersLabel')}
            <ChevronDown size={12} className={`transition-transform ${layersOpen ? 'rotate-180' : ''}`} />
          </button>
          {layersOpen && (
            <>
              <button type="button" aria-label={t('close')} className="fixed inset-0 z-20 cursor-default" onClick={() => setLayersOpen(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-52 border border-neutral-800 bg-neutral-900 py-1">
                {(['hierarchy', 'membership', 'link', 'mention', 'tag', 'code'] as const)
                  .filter((layer) => (layer !== 'tag' || hasTags) && (layer !== 'code' || codePaths > 0))
                  .map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={prefs.layers[layer]}
                      onClick={() => updatePrefs({ layers: { ...prefs.layers, [layer]: !prefs.layers[layer] } })}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800/60"
                    >
                      <span className={`flex h-3.5 w-3.5 items-center justify-center border ${prefs.layers[layer] ? 'border-blue-500 bg-blue-500 text-white' : 'border-neutral-700'}`}>
                        {prefs.layers[layer] && <Check size={10} />}
                      </span>
                      <EdgeSwatch kind={layer} />
                      {layer === 'code' ? t('layer_code', { count: codePaths }) : t(`layer_${layer}`)}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>

        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0]) choose(suggestions[0]);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full border border-neutral-800 bg-neutral-850 py-1 pl-7 pr-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          />
          {query.trim() && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 border border-neutral-800 bg-neutral-900 py-1">
              {suggestions.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-neutral-500">{t('searchEmpty')}</p>
              ) : suggestions.map((node) => {
                const Icon = KIND_ICON[node[1]];
                return (
                  <button
                    key={node[0]}
                    type="button"
                    onClick={() => choose(node)}
                    onMouseEnter={() => setHighlightId(node[0])}
                    onMouseLeave={() => setHighlightId(null)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800/60"
                  >
                    <Icon size={12} className="shrink-0 text-neutral-500" />
                    <span className="truncate">{node[2] || t('untitled')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {arranging && (
            <span className="flex items-center gap-1.5 px-1 text-xs text-neutral-500" aria-live="polite">
              <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
              <span className="hidden sm:inline">{t('arranging')}</span>
            </span>
          )}
          {prefs.layout === 'network' && (
            <button type="button" onClick={() => canvas.current?.relayout()} title={t('relayout')} aria-label={t('relayout')} className="p-1.5 text-neutral-400 hover:text-neutral-50">
              <RotateCcw size={14} />
            </button>
          )}
          <button type="button" onClick={() => canvas.current?.fit()} title={t('fit')} aria-label={t('fit')} className="p-1.5 text-neutral-400 hover:text-neutral-50">
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setAttentionOpen((v) => !v)}
            className="flex items-center gap-1.5 border border-neutral-800 px-2 py-1 text-xs text-neutral-300 lg:hidden"
          >
            <AlertTriangle size={12} className="text-amber-500" />
            {t('attentionToggle', { count: attentionCount })}
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          {failed && !payload ? (
            <CenterMessage>
              <p>{t('loadFailed')}</p>
              <button type="button" onClick={() => void load()} className="mt-3 border border-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
                {t('retry')}
              </button>
            </CenterMessage>
          ) : !payload ? (
            <CenterMessage><p className="text-neutral-500">{t('loading')}</p></CenterMessage>
          ) : payload.nodes.length === 0 ? (
            <CenterMessage>
              <p className="text-neutral-200">{t('emptyTitle')}</p>
              <p className="mt-1 max-w-xs text-neutral-500">{t('emptyHint')}</p>
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
              <Legend colorMode={colorMode} auditLimited={!!payload.auditLimited} showCode={showCode && codePaths > 0} />
              {selected && (
                <SelectionCard
                  node={selected}
                  payload={payload}
                  expanded={expanded.includes(selected[0])}
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
            className={`${attentionOpen ? 'flex' : 'hidden'} fixed inset-x-0 bottom-14 z-40 max-h-[65vh] flex-col border-t border-neutral-800 bg-neutral-900 lg:static lg:z-auto lg:flex lg:max-h-none lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0`}
            aria-label={t('attentionTitle')}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
              <h2 className="text-xs font-medium text-neutral-200">{t('attentionTitle')}</h2>
              <button type="button" onClick={() => setAttentionOpen(false)} aria-label={t('close')} className="p-1 text-neutral-500 hover:text-neutral-200 lg:hidden">
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
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
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-sm">{children}</div>;
}

function EdgeSwatch({ kind }: { kind: keyof GraphLayers }) {
  const style: Record<keyof GraphLayers, string> = {
    hierarchy: 'border-neutral-600',
    membership: 'border-neutral-700',
    link: 'border-blue-400',
    mention: 'border-dashed border-neutral-500',
    tag: 'border-[var(--color-opt-teal)]',
    code: 'border-[var(--color-opt-pink)]',
  };
  return <span aria-hidden className={`inline-block w-4 border-t-2 ${style[kind]}`} />;
}

function Legend({ colorMode, auditLimited, showCode }: { colorMode: GraphColorMode; auditLimited: boolean; showCode: boolean }) {
  const t = useTranslations('Graph');
  // Code files keep their own colour in every mode (they carry no trust or agent state).
  const code: Array<[string, string]> = showCode ? [['bg-[var(--color-opt-pink)]', t('kindFile')]] : [];
  const entries: Array<[string, string]> =
    colorMode === 'trust'
      ? [
          ['bg-green-400', t('trustReviewed')],
          ['bg-blue-400', t('trustConfirmed')],
          ['bg-[var(--color-opt-yellow)]', t('trustDraft')],
          ['bg-amber-500', t('trustStale')],
          ['bg-red-400', t('trustDeprecated')],
          ['bg-neutral-700', t('trustNone')],
          ...code,
        ]
      : colorMode === 'agent'
        ? [
            ['bg-amber-400', t('agentWrote')],
            ['bg-amber-400/40', t('agentRead')],
            ['bg-neutral-700', t('agentNone')],
            ...code,
          ]
        : colorMode === 'cluster'
          ? code
          : [
              ['bg-neutral-400', t('kindPage')],
              ['bg-blue-400', t('kindDatabase')],
              ['bg-neutral-600', t('kindRow')],
              ['bg-[var(--color-opt-purple)]', t('kindDashboard')],
              ['bg-[var(--color-opt-teal)]', t('kindTag')],
              ...code,
            ];
  if (entries.length === 0 && !auditLimited) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-3 max-w-56 border border-neutral-800 bg-neutral-900/90 px-2.5 py-2 text-[11px] text-neutral-400">
      <ul className="space-y-1">
        {entries.map(([swatch, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${swatch}`} />
            {label}
          </li>
        ))}
      </ul>
      {colorMode === 'agent' && auditLimited && <p className="mt-1.5 text-neutral-500">{t('auditLimited')}</p>}
    </div>
  );
}

function SelectionCard({
  node,
  payload,
  expanded,
  relative,
  onClose,
  onToggleRows,
}: {
  node: GraphNodeTuple;
  payload: GraphPayload;
  expanded: boolean;
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
    <div className="absolute inset-x-3 bottom-3 z-10 border border-neutral-800 bg-neutral-900 sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-start gap-2 px-3 pt-3">
        <Icon size={15} className="mt-0.5 shrink-0 text-neutral-500" />
        <div className="min-w-0 flex-1">
          {/* A repo path wraps instead of truncating: its end (the file name) is the part that matters. */}
          <p className={`${code ? 'break-all font-mono text-xs' : 'truncate text-sm'} font-medium text-neutral-100`} title={title}>{title || t('untitled')}</p>
          <p className="text-xs text-neutral-500">{trust ? t('kindWithTrust', { kind: kindLabel, trust }) : kindLabel}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('close')} className="p-0.5 text-neutral-500 hover:text-neutral-200">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-0.5 px-3 pt-2 text-xs text-neutral-400">
        {kind !== NODE_KIND.tag && !code && <p>{t('linkSummary', { links, mentions })}</p>}
        {kind === NODE_KIND.tag && <p>{t('tagMembers', { count: count ?? 0 })}</p>}
        {code && (count ?? 0) > 0 && <p>{t('codeRefs', { count: count ?? 0 })}</p>}
        {code && <p className="text-neutral-500">{t('codeHint')}</p>}
        {agent && <p className="text-amber-400">{agent}</p>}
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        {href && (
          <Link href={href} className="border border-neutral-700 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-800">
            {t('open')}
          </Link>
        )}
        {kind === NODE_KIND.database && (count ?? 0) > 0 && (
          <button type="button" onClick={onToggleRows} className="px-2.5 py-1 text-xs text-neutral-300 hover:text-neutral-50">
            {expanded ? t('hideRows') : t('showRows', { count: count ?? 0 })}
          </button>
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
    <section className="border-b border-neutral-800 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium text-neutral-200">{title}</h3>
        <span className="text-xs tabular-nums text-neutral-500">{total}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{hint}</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-600">{t('allClear')}</p>
      ) : (
        <ul className="mt-2 -mx-1.5">
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
                  className="flex w-full items-start gap-2 px-1.5 py-1 text-left hover:bg-neutral-800/50 focus:outline-none focus-visible:bg-neutral-800/50"
                >
                  <Icon size={12} className="mt-0.5 shrink-0 text-neutral-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-neutral-300">{entry[2] || t('untitled')}</span>
                    {detail && <span className="block text-[11px] text-neutral-500">{detail}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {total > entries.length && <p className="mt-1 text-[11px] text-neutral-500">{t('more', { count: total - entries.length })}</p>}
    </section>
  );
}
