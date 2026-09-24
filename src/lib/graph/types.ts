/**
 * Remnus Graph (P12) — the wire format shared by the cookie-free service
 * (`services/graph.ts`), its session-aware action and the client renderer.
 * No database import here: the client bundle pulls this file in.
 *
 * The payload is deliberately compact. Nodes are tuples in an array, edges are
 * `[sourceIndex, targetIndex, kind, weight?]` into that array — a 5,000-node
 * workspace would otherwise repeat a 36-character uuid twice per edge.
 */

/**
 * `file` / `folder` are the code layer (P13): repo paths taken from knowledge
 * `sources`, id `code:<path>` (a folder's path ends in `/`), title = the path.
 */
export const NODE_KIND = { page: 0, database: 1, dashboard: 2, row: 3, tag: 4, file: 5, folder: 6 } as const;
export type NodeKindCode = (typeof NODE_KIND)[keyof typeof NODE_KIND];

/**
 * Edge kinds, in priority order: when two nodes are connected more than one
 * way, only the lowest code is kept (a child block that points at its own
 * sidebar child is hierarchy, not a second "link"). `source` = an item rests
 * on a file or folder, `folder` = a folder holds a file or folder; both only
 * ever touch code nodes, so they never compete with the others.
 */
export const EDGE_KIND = { hierarchy: 0, membership: 1, link: 2, mention: 3, tag: 4, source: 5, folder: 6 } as const;
export type EdgeKindCode = (typeof EDGE_KIND)[keyof typeof EDGE_KIND];

export function isCodeKind(kind: NodeKindCode): boolean {
  return kind === NODE_KIND.file || kind === NODE_KIND.folder;
}

/** Bit layout of a node's `state` field. */
export const NODE_STATE = {
  /** 0 = no verdict, 1 = machine-confirmed or externally asserted, 2 = human-reviewed (current revision). */
  trustMask: 0b11,
  /** 0 = none, 1 = draft, 2 = stable, 3 = deprecated. */
  statusShift: 2,
  statusMask: 0b1100,
  /** `staleAfter` has passed. */
  stale: 1 << 4,
  /** Carries knowledge metadata (a labelled concept). */
  concept: 1 << 5,
  /** An agent wrote it inside the activity window. */
  agentWrote: 1 << 6,
  /** An agent read it inside the activity window (and did not write it). */
  agentRead: 1 << 7,
} as const;

export type TrustLevel = 0 | 1 | 2;
export type StatusLevel = 0 | 1 | 2 | 3;

export function trustOf(state: number): TrustLevel {
  return (state & NODE_STATE.trustMask) as TrustLevel;
}

export function statusOf(state: number): StatusLevel {
  return ((state & NODE_STATE.statusMask) >> NODE_STATE.statusShift) as StatusLevel;
}

/**
 * `[id, kind, title, state, agentAt, ref?, count?]`
 * - `agentAt`: epoch seconds of the last agent touch inside the window, 0 = none.
 * - database: `ref` = `databases.id` (for `/db/<id>`), `count` = its row count.
 * - row: `ref` = index of its database node (always present — a row is only
 *   ever sent together with its database).
 * - tag: `count` = members in this view.
 * - file / folder: `count` = items whose sources name it (a folder: directly).
 */
export type GraphNodeTuple = [
  id: string,
  kind: NodeKindCode,
  title: string,
  state: number,
  agentAt: number,
  ref?: string | number | null,
  count?: number,
];

/** `[sourceIndex, targetIndex, kind, weight?]` — weight = edges folded into this one (collapsed rows), omitted when 1. */
export type GraphEdgeTuple = [source: number, target: number, kind: EdgeKindCode, weight?: number];

/**
 * `[id, kind, title, databaseItemId, metric]` — one row of the "Needs attention"
 * panel. Computed over the whole workspace, not the current view, so a row
 * folded into its database is listed too (`databaseItemId` says which database
 * to expand to show it).
 * - orphans: `metric` = bodies that name it without linking it;
 * - outdated: `metric` = its `state` bits (stale vs deprecated);
 * - hubs: `metric` = explicit links + mentions, in and out.
 */
export type AttentionEntry = [id: string, kind: NodeKindCode, title: string, databaseItemId: string | null, metric: number];

export interface GraphAttention {
  orphans: AttentionEntry[];
  orphanTotal: number;
  outdated: AttentionEntry[];
  outdatedTotal: number;
  hubs: AttentionEntry[];
}

/** Longest list each attention group sends; the totals are exact. */
export const ATTENTION_LIST_LIMIT = 40;

export interface GraphPayload {
  v: 1;
  workspaceId: string;
  nodes: GraphNodeTuple[];
  edges: GraphEdgeTuple[];
  /** Workspace map only. */
  attention?: GraphAttention;
  /** Database item ids whose rows are included as nodes. */
  expanded: string[];
  activityDays: number;
  /** Agent reads were cut to the plan's shorter audit window. */
  auditLimited?: boolean;
  /**
   * Workspace map only: repo files and folders the workspace's knowledge
   * sources name (omitted when none). The code layer's nodes are sent only
   * when the view asks for them, so the toggle knows whether to offer itself.
   */
  codePaths?: number;
  /** Local graph only: index of the page the panel belongs to. */
  focus?: number;
  /** Local graph only: the neighbourhood was cut at the node cap. */
  truncated?: boolean;
  /** Epoch seconds. */
  generatedAt: number;
}

export const ACTIVITY_DAY_OPTIONS = [7, 30, 90] as const;
export type ActivityDays = (typeof ACTIVITY_DAY_OPTIONS)[number];
export const DEFAULT_ACTIVITY_DAYS: ActivityDays = 7;

/** Most databases a single view may expand at once (payload bound, not a UI limit anyone should reach). */
export const MAX_EXPANDED_DATABASES = 50;

/** In-app route of a node, or null for tags (they are not pages). */
export function graphNodeHref(node: GraphNodeTuple, nodes: GraphNodeTuple[]): string | null {
  const [id, kind, , , , ref] = node;
  if (kind === NODE_KIND.page) return `/page/${id}`;
  if (kind === NODE_KIND.dashboard) return `/dashboard/${id}`;
  if (kind === NODE_KIND.database) return typeof ref === 'string' ? `/db/${ref}` : null;
  if (kind === NODE_KIND.row && typeof ref === 'number') {
    const database = nodes[ref];
    return database && typeof database[5] === 'string' ? `/db/${database[5]}/${id}` : null;
  }
  return null;
}
