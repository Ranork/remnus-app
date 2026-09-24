'use client';

/**
 * The knowledge map's renderer — sigma 3 (WebGL) over a graphology graph. This
 * module is the heavy half: it is only ever reached through `next/dynamic`
 * (`GraphScreen`, `LocalGraphPanel`), so sigma, graphology, ForceAtlas2,
 * Louvain and d3-hierarchy never enter any other route's bundle.
 *
 * One renderer, two layouts: *network* (ForceAtlas2 in a web worker) and
 * *tree* (a radial tree from d3-hierarchy, fed to the same sigma instance).
 *
 * The one rule a live refresh must keep: the map the human is looking at does
 * not reshuffle. Existing nodes keep their positions; a new node is placed
 * next to a neighbour it already has, and a short force pass then runs with
 * every old node pinned (`fixed`), so only the newcomers move.
 */

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { EdgeRectangleProgram } from 'sigma/rendering';
import type { NodeDisplayData, EdgeDisplayData } from 'sigma/types';
import type { Settings } from 'sigma/settings';
import { animateNodes } from 'sigma/utils';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import louvain from 'graphology-communities-louvain';
import { hierarchy, tree } from 'd3-hierarchy';
import DashedEdgeProgram from './dashedEdgeProgram';
import { readGraphTheme, watchTheme, type GraphTheme } from './graphTheme';
import {
  EDGE_KIND,
  NODE_KIND,
  NODE_STATE,
  isCodeKind,
  statusOf,
  trustOf,
  type EdgeKindCode,
  type GraphPayload,
  type NodeKindCode,
} from '@/lib/graph/types';
import { pathBasename } from '@/lib/graph/codePaths';

export type GraphLayoutMode = 'network' | 'tree';
export type GraphColorMode = 'type' | 'trust' | 'agent' | 'cluster';
/** `code` switches the code layer: file/folder nodes and both of their edge kinds. */
export type GraphLayers = { hierarchy: boolean; membership: boolean; link: boolean; mention: boolean; tag: boolean; code: boolean };

export interface GraphCanvasHandle {
  /** Pan and zoom to a node (no-op when it is not on the map). */
  focus(id: string): void;
  fit(): void;
  /** Run the force layout again from the current positions. */
  relayout(): void;
}

export interface GraphCanvasProps {
  payload: GraphPayload;
  layout: GraphLayoutMode;
  colorMode: GraphColorMode;
  layers: GraphLayers;
  /** Node whose neighbourhood is lit while everything else dims (panel hover, search). */
  highlightId?: string | null;
  selectedId?: string | null;
  /** 'select' on the workspace map (a card opens), 'open' in the small per-page panel. */
  clickBehavior?: 'select' | 'open';
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  onLayoutRunning?: (running: boolean) => void;
  /** Cluster count after Louvain ran (cluster colour mode). */
  onClusters?: (count: number) => void;
  handleRef?: Ref<GraphCanvasHandle>;
  className?: string;
}

type NodeAttrs = {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  kind: NodeKindCode;
  state: number;
  agentAt: number;
  count: number;
  badge?: string;
  /** Last network-layout position, restored when switching back from the tree. */
  nx?: number;
  ny?: number;
  fixed?: boolean;
};

type EdgeAttrs = {
  kind: EdgeKindCode;
  weight: number;
  /** Tree parent for hierarchy/membership edges (the payload's source). */
  parent: string;
  size: number;
  color: string;
  type: 'line' | 'dashed';
};

type KnowledgeGraph = Graph<NodeAttrs, EdgeAttrs>;

const KIND_KEY = ['page', 'database', 'dashboard', 'row', 'tag', 'file', 'folder'] as const;
/** Edge kind → its colour in the theme. */
const EDGE_KEY = ['hierarchy', 'membership', 'link', 'mention', 'tag', 'source', 'folder'] as const;
/** Edge kind → the layer switch that shows it. */
const LAYER_KEY = ['hierarchy', 'membership', 'link', 'mention', 'tag', 'code', 'code'] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Graph sync ───────────────────────────────────────────────────────────────

/** Mirror a payload into the graph; returns the ids of nodes that are new. */
function syncGraph(graph: KnowledgeGraph, payload: GraphPayload): string[] {
  const wanted = new Set(payload.nodes.map((node) => node[0]));
  graph.forEachNode((node) => {
    if (!wanted.has(node)) graph.dropNode(node);
  });

  const added: string[] = [];
  for (const [id, kind, title, state, agentAt, , count] of payload.nodes) {
    const attrs = {
      // A file's title is its repo path; the map shows the name, the card the path.
      label: kind === NODE_KIND.file ? pathBasename(title) : kind === NODE_KIND.folder ? title.replace(/\/$/, '') : title,
      kind,
      state,
      agentAt,
      count: count ?? 0,
      badge: kind === NODE_KIND.database && count ? String(count) : undefined,
    };
    if (graph.hasNode(id)) graph.mergeNodeAttributes(id, attrs);
    else {
      graph.addNode(id, { ...attrs, x: 0, y: 0, size: 4, color: '#808080' });
      added.push(id);
    }
  }

  const edges = new Map<string, { a: string; b: string; kind: EdgeKindCode; weight: number }>();
  for (const [s, t, kind, weight] of payload.edges) {
    const a = payload.nodes[s][0];
    const b = payload.nodes[t][0];
    edges.set(a < b ? `${a}|${b}` : `${b}|${a}`, { a, b, kind, weight: weight ?? 1 });
  }
  graph.forEachEdge((edge) => {
    if (!edges.has(edge)) graph.dropEdge(edge);
  });
  for (const [key, edge] of edges) {
    const attrs = { kind: edge.kind, weight: edge.weight, parent: edge.a, type: edge.kind === EDGE_KIND.mention ? 'dashed' as const : 'line' as const };
    if (graph.hasEdge(key)) graph.mergeEdgeAttributes(key, attrs);
    else graph.addUndirectedEdgeWithKey(key, edge.a, edge.b, { ...attrs, size: 1, color: '#808080' });
  }
  return added;
}

function extent(graph: KnowledgeGraph, skip?: Set<string>) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  graph.forEachNode((node, attrs) => {
    if (skip?.has(node)) return;
    minX = Math.min(minX, attrs.x); maxX = Math.max(maxX, attrs.x);
    minY = Math.min(minY, attrs.y); maxY = Math.max(maxY, attrs.y);
  });
  if (!Number.isFinite(minX)) return { cx: 0, cy: 0, span: 100 };
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span: Math.max(maxX - minX, maxY - minY, 1) };
}

/** Put each new node next to the neighbours it already has (or near the middle). */
function placeNewNodes(graph: KnowledgeGraph, added: string[]) {
  const fresh = new Set(added);
  const { cx, cy, span } = extent(graph, fresh);
  const jitter = () => (Math.random() - 0.5) * span * 0.04;
  for (const id of added) {
    let sx = 0, sy = 0, n = 0;
    graph.forEachNeighbor(id, (neighbour, attrs) => {
      if (fresh.has(neighbour)) return;
      sx += attrs.x; sy += attrs.y; n++;
    });
    graph.mergeNodeAttributes(id, n > 0
      ? { x: sx / n + jitter(), y: sy / n + jitter() }
      : { x: cx + (Math.random() - 0.5) * span * 0.6, y: cy + (Math.random() - 0.5) * span * 0.6 });
    fresh.delete(id); // later newcomers may sit next to this one
  }
}

// ── Tree layout ──────────────────────────────────────────────────────────────

type TreeDatum = { id: string; children: TreeDatum[] };
const TREE_ROOT = '\u0000root';

/**
 * Radial tree over hierarchy + membership edges, under a virtual root (the
 * workspace, not drawn). Tag and code nodes are not in the tree: they sit a
 * little outside the centroid of what they tag / what rests on them — files
 * first, then folders around their files, deepest first.
 */
function treePositions(graph: KnowledgeGraph): Map<string, { x: number; y: number }> {
  const parentOf = new Map<string, string>();
  graph.forEachEdge((edge, attrs, source, target) => {
    if (attrs.kind !== EDGE_KIND.hierarchy && attrs.kind !== EDGE_KIND.membership) return;
    const child = source === attrs.parent ? target : source;
    if (!parentOf.has(child)) parentOf.set(child, attrs.parent);
  });

  const children = new Map<string, string[]>();
  const tags: string[] = [];
  const files: string[] = [];
  const folders: string[] = [];
  graph.forEachNode((node, attrs) => {
    if (attrs.kind === NODE_KIND.tag) {
      tags.push(node);
      return;
    }
    if (isCodeKind(attrs.kind)) {
      (attrs.kind === NODE_KIND.file ? files : folders).push(node);
      return;
    }
    // A parent chain that loops (bad data) hangs off the root instead.
    let parent = parentOf.get(node) ?? TREE_ROOT;
    const seen = new Set([node]);
    for (let p = parent; p !== TREE_ROOT; p = parentOf.get(p) ?? TREE_ROOT) {
      if (seen.has(p)) {
        parent = TREE_ROOT;
        break;
      }
      seen.add(p);
    }
    const list = children.get(parent);
    if (list) list.push(node);
    else children.set(parent, [node]);
  });

  const build = (id: string): TreeDatum => ({ id, children: (children.get(id) ?? []).map(build) });
  const root = hierarchy<TreeDatum>(build(TREE_ROOT));
  const count = graph.order - tags.length - files.length - folders.length;
  const radius = Math.max(60, Math.sqrt(Math.max(1, count)) * 40);
  tree<TreeDatum>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(root);

  const positions = new Map<string, { x: number; y: number }>();
  root.each((node) => {
    if (node.data.id === TREE_ROOT) return;
    const angle = (node.x ?? 0) - Math.PI / 2;
    positions.set(node.data.id, { x: (node.y ?? 0) * Math.cos(angle), y: (node.y ?? 0) * Math.sin(angle) });
  });
  // Folder ids are `code:<path>/`: a longer path is deeper, so it is placed before its parent.
  folders.sort((a, b) => b.length - a.length);
  [...tags, ...files, ...folders].forEach((outer, i) => {
    let sx = 0, sy = 0, n = 0;
    graph.forEachNeighbor(outer, (neighbour) => {
      const p = positions.get(neighbour);
      if (p) { sx += p.x; sy += p.y; n++; }
    });
    // Two files a page rests on share that page as their only neighbour: without
    // a nudge they land on one point and the force layout cannot pull them apart.
    // Golden-angle steps keep it deterministic, so the tree does not shift per refresh.
    const angle = i * 2.39996;
    const nudge = radius * 0.06;
    const base = n > 0 ? { x: (sx / n) * 1.12, y: (sy / n) * 1.12 } : { x: radius * 1.15, y: 0 };
    positions.set(outer, { x: base.x + Math.cos(angle) * nudge, y: base.y + Math.sin(angle) * nudge });
  });
  return positions;
}

// ── Appearance ───────────────────────────────────────────────────────────────

function nodeColor(attrs: NodeAttrs, mode: GraphColorMode, theme: GraphTheme, cluster: number | undefined): string {
  // Tags and code files are not knowledge items: no trust, no agent activity.
  if (attrs.kind === NODE_KIND.tag || isCodeKind(attrs.kind)) return theme.kind[KIND_KEY[attrs.kind]];
  switch (mode) {
    case 'trust': {
      const status = statusOf(attrs.state);
      if (status === 3) return theme.trust.deprecated;
      if (attrs.state & NODE_STATE.stale) return theme.trust.stale;
      if (trustOf(attrs.state) === 2) return theme.trust.reviewed;
      if (status === 1) return theme.trust.draft;
      if (trustOf(attrs.state) === 1 || status === 2) return theme.trust.confirmed;
      return theme.trust.none;
    }
    case 'agent':
      if (attrs.state & NODE_STATE.agentWrote) return theme.agent.wrote;
      if (attrs.state & NODE_STATE.agentRead) return theme.agent.read;
      return theme.agent.none;
    case 'cluster':
      return cluster !== undefined && cluster < theme.clusters.length ? theme.clusters[cluster] : theme.clusterRest;
    default:
      return theme.kind[KIND_KEY[attrs.kind]];
  }
}

function edgeSize(kind: EdgeKindCode, weight: number): number {
  if (kind === EDGE_KIND.link) return 1 + Math.min(2, Math.log2(weight));
  if (kind === EDGE_KIND.hierarchy) return 0.8;
  if (kind === EDGE_KIND.mention) return 0.9 + Math.min(1.5, Math.log2(weight) * 0.5);
  if (kind === EDGE_KIND.source) return 0.8 + Math.min(1.5, Math.log2(weight) * 0.5);
  return 0.6;
}

function layerOn(layers: GraphLayers, kind: EdgeKindCode): boolean {
  return layers[LAYER_KEY[kind]];
}

/** Size by degree over the edges that are visible, so hiding a layer re-weighs the map. */
function applySizes(graph: KnowledgeGraph, layers: GraphLayers) {
  const degree = new Map<string, number>();
  graph.forEachEdge((edge, attrs, source, target) => {
    if (!layerOn(layers, attrs.kind)) return;
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  });
  // Sizes are screen pixels: hundreds of nodes at small-map sizes overlap into a blot.
  const scale = graph.order > 1_500 ? 0.5 : graph.order > 400 ? 0.65 : graph.order > 150 ? 0.8 : 1;
  graph.updateEachNodeAttributes((node, attrs) => {
    const d = degree.get(node) ?? 0;
    const size = attrs.kind === NODE_KIND.tag
      ? 3 + Math.sqrt(attrs.count)
      : 4 + 1.5 * Math.sqrt(d) + (attrs.kind === NODE_KIND.database ? Math.log2(1 + attrs.count) : 0);
    return { ...attrs, size: Math.max(2, Math.min(20, size) * scale) };
  });
}

/**
 * Sigma scales the layout to fill the canvas, so four nodes land in its four
 * corners, and hides labels of nodes drawn smaller than a threshold. Both are
 * right for thousands of nodes and wrong for a handful: a small map keeps
 * every label and breathes in from the edges.
 */
function applyScaleSettings(renderer: Sigma<NodeAttrs, EdgeAttrs>, order: number, container: HTMLElement) {
  const small = order <= 150;
  // Relative to the canvas: a fixed 120px would leave a 288px-tall local panel 48px to draw in.
  const short = Math.min(container.clientWidth, container.clientHeight) || 300;
  const padding = order <= 12 ? Math.min(120, short * 0.2) : order <= 60 ? Math.min(60, short * 0.1) : 24;
  renderer.setSetting('labelRenderedSizeThreshold', small ? 0 : 6);
  renderer.setSetting('stagePadding', Math.round(padding));
}

// ── Canvas drawing (labels) ──────────────────────────────────────────────────

type LabelData = Partial<NodeDisplayData> & { x: number; y: number; size: number; label: string | null; color: string; badge?: string };

function drawLabel(theme: GraphTheme, context: CanvasRenderingContext2D, data: LabelData, settings: Settings) {
  if (!data.label) return;
  const size = settings.labelSize;
  context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
  const x = data.x + data.size + 4;
  const y = data.y + size / 3;
  context.fillStyle = theme.label;
  context.fillText(data.label, x, y);
  if (!data.badge) return;
  // The folded row count: a pill after the title, the same shape as the sidebar's count badges.
  const width = context.measureText(data.label).width;
  context.font = `${settings.labelWeight} ${size - 2}px ${settings.labelFont}`;
  const badgeWidth = context.measureText(data.badge).width + 10;
  const height = size + 2;
  const bx = x + width + 6;
  const by = data.y - height / 2;
  context.beginPath();
  context.roundRect(bx, by, badgeWidth, height, height / 2);
  context.fillStyle = theme.panel;
  context.fill();
  context.strokeStyle = theme.border;
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = theme.labelMuted;
  context.fillText(data.badge, bx + 5, y - 1);
}

function drawHover(theme: GraphTheme, context: CanvasRenderingContext2D, data: LabelData, settings: Settings) {
  if (data.label) {
    // Flat plate behind the label (no shadow — the workspace UI has none).
    const size = settings.labelSize;
    context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    let width = context.measureText(data.label).width + 12;
    if (data.badge) {
      context.font = `${settings.labelWeight} ${size - 2}px ${settings.labelFont}`;
      width += context.measureText(data.badge).width + 16;
    }
    const x = data.x + data.size + 1;
    const height = size + 10;
    context.fillStyle = theme.panel;
    context.fillRect(x, data.y - height / 2, width, height);
    context.strokeStyle = theme.border;
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, data.y - height / 2 + 0.5, width - 1, height - 1);
  }
  context.beginPath();
  context.arc(data.x, data.y, data.size + 2.5, 0, Math.PI * 2);
  context.strokeStyle = theme.label;
  context.lineWidth = 1.5;
  context.stroke();
  drawLabel(theme, context, data, settings);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GraphCanvas({
  payload,
  layout,
  colorMode,
  layers,
  highlightId = null,
  selectedId = null,
  clickBehavior = 'select',
  onSelect,
  onOpen,
  onLayoutRunning,
  onClusters,
  handleRef,
  className,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<KnowledgeGraph | null>(null);
  const rendererRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null);
  const themeRef = useRef<GraphTheme | null>(null);
  const layoutRef = useRef<{ fa2: FA2Layout | null; timer: ReturnType<typeof setTimeout> | null }>({ fa2: null, timer: null });
  const clustersRef = useRef<Map<string, number>>(new Map());
  const hoveredRef = useRef<string | null>(null);
  const focusRef = useRef<{ id: string | null; set: Set<string> | null }>({ id: null, set: null });
  const view = useRef({ layout, colorMode, layers, highlightId, selectedId, clickBehavior, subject: null as string | null });
  view.current = { ...view.current, layout, colorMode, layers, highlightId, selectedId, clickBehavior };
  const callbacks = useRef({ onSelect, onOpen, onLayoutRunning, onClusters });
  callbacks.current = { onSelect, onOpen, onLayoutRunning, onClusters };
  const firstSync = useRef(true);

  // ── focus neighbourhood ──
  const refreshFocus = () => {
    const graph = graphRef.current;
    const v = view.current;
    const id = v.highlightId ?? hoveredRef.current ?? v.selectedId;
    if (!graph || !id || !graph.hasNode(id)) {
      focusRef.current = { id: null, set: null };
      return;
    }
    const set = new Set([id]);
    graph.forEachEdge(id, (edge, attrs, source, target) => {
      if (!layerOn(v.layers, attrs.kind)) return;
      set.add(source === id ? target : source);
    });
    focusRef.current = { id, set };
  };

  const stopForce = () => {
    const state = layoutRef.current;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    if (state.fa2) {
      state.fa2.stop();
      state.fa2.kill();
      state.fa2 = null;
    }
  };

  const saveNetworkPositions = () => {
    graphRef.current?.updateEachNodeAttributes((node, attrs) => ({ ...attrs, nx: attrs.x, ny: attrs.y, fixed: false }));
  };

  /** ForceAtlas2 in its worker for `duration` ms; `pinned` nodes do not move. */
  const runForce = (duration: number, pinned?: Set<string>) => {
    const graph = graphRef.current;
    if (!graph || graph.order < 2) return;
    stopForce();
    if (pinned) graph.updateEachNodeAttributes((node, attrs) => ({ ...attrs, fixed: pinned.has(node) }));
    const inferred = forceAtlas2.inferSettings(graph);
    const fa2 = new FA2Layout(graph, {
      settings: { ...inferred, barnesHutOptimize: graph.order > 400, gravity: 1, scalingRatio: 8 },
      getEdgeWeight: 'weight',
    });
    layoutRef.current.fa2 = fa2;
    fa2.start();
    callbacks.current.onLayoutRunning?.(true);
    layoutRef.current.timer = setTimeout(() => {
      stopForce();
      saveNetworkPositions();
      callbacks.current.onLayoutRunning?.(false);
    }, duration);
  };

  const forceBudget = (order: number) => Math.min(12_000, 1_500 + order * 2);

  const animateTo = (targets: Map<string, { x: number; y: number }>, done?: () => void) => {
    const graph = graphRef.current;
    if (!graph) return;
    const record: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of targets) if (graph.hasNode(id)) record[id] = p;
    if (prefersReducedMotion()) {
      for (const [id, p] of Object.entries(record)) graph.mergeNodeAttributes(id, p);
      done?.();
      return;
    }
    animateNodes(graph, record, { duration: 450 }, done);
  };

  const computeClusters = () => {
    const graph = graphRef.current;
    if (!graph || view.current.colorMode !== 'cluster' || graph.size === 0) return;
    const communities = louvain(graph, { getEdgeWeight: 'weight' });
    // Largest community gets the first hue: colours stay put when a small one appears.
    const sizes = new Map<number, number>();
    for (const c of Object.values(communities)) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    const rank = new Map([...sizes].sort((a, b) => b[1] - a[1]).map(([c], i) => [c, i]));
    clustersRef.current = new Map(Object.entries(communities).map(([node, c]) => [node, rank.get(c) ?? 99]));
    callbacks.current.onClusters?.(sizes.size);
  };

  // ── mount: graph + renderer, once ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph: KnowledgeGraph = new Graph<NodeAttrs, EdgeAttrs>({ type: 'undirected', multi: false, allowSelfLoops: false });
    graphRef.current = graph;
    // A fresh (or StrictMode re-mounted) graph is empty: its first payload is a first layout.
    firstSync.current = true;
    themeRef.current = readGraphTheme();
    const theme = () => themeRef.current!;

    const renderer = new Sigma<NodeAttrs, EdgeAttrs>(graph, container, {
      allowInvalidContainer: true,
      renderEdgeLabels: false,
      zIndex: true,
      labelFont: theme().font,
      labelSize: 12,
      labelWeight: '500',
      labelColor: { color: theme().label },
      labelDensity: 0.7,
      labelGridCellSize: 90,
      labelRenderedSizeThreshold: 7,
      minCameraRatio: 0.03,
      maxCameraRatio: 6,
      stagePadding: 24,
      defaultEdgeType: 'line',
      edgeProgramClasses: { line: EdgeRectangleProgram, dashed: DashedEdgeProgram },
      defaultDrawNodeLabel: (context, data, settings) => drawLabel(theme(), context, data as LabelData, settings as Settings),
      defaultDrawNodeHover: (context, data, settings) => drawHover(theme(), context, data as LabelData, settings as Settings),
      nodeReducer: (node, attrs) => {
        const v = view.current;
        const t = theme();
        const display: Partial<NodeDisplayData> & { badge?: string } = {
          ...attrs,
          color: nodeColor(attrs, v.colorMode, t, clustersRef.current.get(node)),
        };
        if (attrs.kind === NODE_KIND.tag && !v.layers.tag) display.hidden = true;
        if (isCodeKind(attrs.kind) && !v.layers.code) display.hidden = true;
        const focus = focusRef.current;
        if (focus.set) {
          if (!focus.set.has(node)) {
            display.color = t.dim;
            display.label = '';
            display.badge = undefined;
            display.zIndex = 0;
          } else {
            display.zIndex = 1;
            display.forceLabel = focus.set.size <= 40 || node === focus.id;
            if (node === focus.id) display.highlighted = true;
          }
        }
        if (node === v.subject) {
          display.highlighted = true;
          display.forceLabel = true;
          display.zIndex = 2;
        }
        if (node === hoveredRef.current || node === v.selectedId) display.highlighted = true;
        return display;
      },
      edgeReducer: (edge, attrs) => {
        const v = view.current;
        const t = theme();
        const display: Partial<EdgeDisplayData> = {
          ...attrs,
          color: t.edge[EDGE_KEY[attrs.kind]],
          size: edgeSize(attrs.kind, attrs.weight),
        };
        if (!layerOn(v.layers, attrs.kind)) display.hidden = true;
        const focus = focusRef.current;
        if (focus.id && !display.hidden) {
          const [a, b] = graph.extremities(edge);
          if (a !== focus.id && b !== focus.id) display.color = t.dimEdge;
          else display.zIndex = 1;
        } else if (v.layout === 'tree' && attrs.kind !== EDGE_KIND.hierarchy && attrs.kind !== EDGE_KIND.membership) {
          // The tree view is about the tree: cross-links stay, but quiet until a node is focused.
          display.color = t.dimEdge;
        }
        return display;
      },
    });
    rendererRef.current = renderer;

    renderer.on('clickNode', ({ node }) => {
      if (view.current.clickBehavior === 'open') callbacks.current.onOpen?.(node);
      else callbacks.current.onSelect?.(node);
    });
    renderer.on('doubleClickNode', (event) => {
      event.preventSigmaDefault();
      callbacks.current.onOpen?.(event.node);
    });
    renderer.on('clickStage', () => callbacks.current.onSelect?.(null));
    renderer.on('enterNode', ({ node }) => {
      hoveredRef.current = node;
      container.style.cursor = 'pointer';
      refreshFocus();
      renderer.refresh({ skipIndexation: true });
    });
    renderer.on('leaveNode', () => {
      hoveredRef.current = null;
      container.style.cursor = '';
      refreshFocus();
      renderer.refresh({ skipIndexation: true });
    });

    const unwatch = watchTheme(() => {
      themeRef.current = readGraphTheme();
      renderer.setSetting('labelFont', themeRef.current.font);
      renderer.setSetting('labelColor', { color: themeRef.current.label });
      renderer.refresh();
    });
    const resize = new ResizeObserver(() => {
      applyScaleSettings(renderer, graph.order, container);
      renderer.refresh();
    });
    resize.observe(container);

    return () => {
      unwatch();
      resize.disconnect();
      stopForce();
      renderer.kill();
      rendererRef.current = null;
      graphRef.current = null;
    };
  }, []);

  // ── payload: merge, keep positions, place newcomers ──
  useEffect(() => {
    const graph = graphRef.current;
    const renderer = rendererRef.current;
    if (!graph || !renderer) return;
    view.current.subject = payload.focus !== undefined ? payload.nodes[payload.focus]?.[0] ?? null : null;
    const added = syncGraph(graph, payload);
    applySizes(graph, view.current.layers);
    if (containerRef.current) applyScaleSettings(renderer, graph.order, containerRef.current);

    if (firstSync.current) {
      firstSync.current = false;
      // The radial tree is a good seed for the force layout too: related nodes
      // start close, so ForceAtlas2 converges instead of untangling noise.
      const seed = treePositions(graph);
      graph.updateEachNodeAttributes((node, attrs) => ({ ...attrs, ...(seed.get(node) ?? {}) }));
      if (view.current.layout === 'network') runForce(forceBudget(graph.order));
    } else if (added.length > 0) {
      if (view.current.layout === 'tree') animateTo(treePositions(graph));
      else {
        placeNewNodes(graph, added);
        const pinned = new Set<string>();
        const fresh = new Set(added);
        graph.forEachNode((node) => { if (!fresh.has(node)) pinned.add(node); });
        runForce(1_200, pinned);
      }
    }
    computeClusters();
    refreshFocus();
    renderer.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  // ── layout mode ──
  const lastLayout = useRef(layout);
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || lastLayout.current === layout) return;
    lastLayout.current = layout;
    rendererRef.current?.refresh({ skipIndexation: true });
    if (layout === 'tree') {
      if (layoutRef.current.fa2) {
        stopForce();
        callbacks.current.onLayoutRunning?.(false);
      }
      saveNetworkPositions();
      animateTo(treePositions(graph));
      return;
    }
    // Back to the network the human already saw; nodes that joined meanwhile settle in.
    const targets = new Map<string, { x: number; y: number }>();
    const missing: string[] = [];
    graph.forEachNode((node, attrs) => {
      if (attrs.nx !== undefined && attrs.ny !== undefined) targets.set(node, { x: attrs.nx, y: attrs.ny });
      else missing.push(node);
    });
    if (targets.size === 0) {
      runForce(forceBudget(graph.order));
      return;
    }
    animateTo(targets, () => {
      if (missing.length === 0) return;
      placeNewNodes(graph, missing);
      runForce(1_200, new Set(targets.keys()));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // ── appearance ──
  useEffect(() => {
    const graph = graphRef.current;
    const renderer = rendererRef.current;
    if (!graph || !renderer) return;
    applySizes(graph, layers);
    computeClusters();
    refreshFocus();
    renderer.refresh();
  }, [layers, colorMode]);

  useEffect(() => {
    refreshFocus();
    rendererRef.current?.refresh({ skipIndexation: true });
  }, [highlightId, selectedId]);

  useImperativeHandle(handleRef, () => ({
    focus(id: string) {
      const renderer = rendererRef.current;
      const data = renderer?.getNodeDisplayData(id);
      if (!renderer || !data) return;
      const camera = renderer.getCamera();
      camera.animate(
        { x: data.x, y: data.y, ratio: Math.min(camera.ratio, 0.45) },
        { duration: prefersReducedMotion() ? 0 : 400 },
      );
    },
    fit() {
      rendererRef.current?.getCamera().animatedReset({ duration: prefersReducedMotion() ? 0 : 300 });
    },
    relayout() {
      const graph = graphRef.current;
      if (graph && view.current.layout === 'network') runForce(forceBudget(graph.order));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return <div ref={containerRef} className={className ?? 'absolute inset-0'} />;
}
