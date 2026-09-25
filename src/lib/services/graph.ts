/**
 * Remnus Graph (P12) — the workspace as a knowledge map. Cookie-free: the web
 * action (`actions/graph.ts`) adds the session and lock checks, and the MCP
 * side planned in P13 can call the same functions.
 *
 * It is a maintenance and way-finding view, not a star map. Remnus has few
 * explicit links (measured 2026-09-23 on a local workspace set: 331 items, 8
 * `page_links` rows, 0 knowledge metadata), so the graph is built from every
 * relation the workspace already records, in priority order:
 *
 *   hierarchy   workspace_items.parentId (a row can parent items too)
 *   membership  a database and its rows — rows arrive FOLDED into their
 *               database node; a view expands chosen databases
 *   link        page_links (page_link + child_block), ids resolved like
 *               getRelatedPages: item id → databases.id → row id
 *   mention     a body that names another item's title without linking it
 *   tag         knowledge_metadata.tags, as tag nodes (see projectGraph)
 *   source      knowledge_metadata.sources that read as repo paths: the code
 *               layer (P13) — file and folder nodes, sent only on request
 *
 * plus what a flat link graph cannot show: trust (human-reviewed / draft /
 * stale / deprecated, same verdict as `trustFor`) and where agents read and
 * wrote in the last N days.
 *
 * Cost model: everything that depends only on workspace content is built once
 * per `getKnowledgeCorpusVersion` key (one `db.batch`) and kept per process;
 * the agent-activity aggregate is read on every call, in parallel with the
 * key, because agent READS change no content timestamp.
 */
import { and, asc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentActivity,
  databases,
  knowledgeMetadata,
  knowledgeReviews,
  pageLinks,
  pages,
  standalonePages,
  workspaceItems,
} from '@/db/schema';
import {
  ACTIVITY_DAY_OPTIONS,
  ATTENTION_LIST_LIMIT,
  DEFAULT_ACTIVITY_DAYS,
  EDGE_KIND,
  MAX_EXPANDED_DATABASES,
  NODE_KIND,
  NODE_STATE,
  type ActivityDays,
  type AttentionEntry,
  type EdgeKindCode,
  type GraphAttention,
  type GraphEdgeTuple,
  type GraphNodeTuple,
  type GraphPayload,
  type NodeKindCode,
  isCodeKind,
} from '@/lib/graph/types';
import { normalizeSourcePath } from '@/lib/graph/codePaths';
import { asEpochSeconds } from './agentMetrics';
import { activityAtOrAfter, auditVisibleSince } from './auditRetention';
import { getKnowledgeCorpusVersion, hashKnowledgeContent, trustFor } from './knowledge';
import { foldText } from './textFold';

// ── Model ────────────────────────────────────────────────────────────────────

type ModelNode = {
  id: string;
  kind: NodeKindCode;
  title: string;
  /** Tree parent: an item's parent (item or row), a row's database item. */
  parentId: string | null;
  /** `databases.id` of a database item, or of a row's database. */
  databaseId?: string;
  rowCount?: number;
  /** Trust / status / concept bits. Stale and agent bits are per call. */
  state: number;
  /** Epoch ms after which the item is stale; 0 = never. */
  staleAt: number;
  /** Epoch ms of the last agent write stamped on a row; 0 = none. */
  agentEditedAt: number;
  /** Folded tag keys. */
  tags: string[];
  /** Has a non-empty body (pages and rows). */
  hasBody: boolean;
  /** Code nodes: items whose sources name this path directly. */
  refCount?: number;
};

type ModelEdge = { a: string; b: string; kind: EdgeKindCode };

export type MentionStats = {
  /** Titles that could be matched (after the generic/short filter). */
  candidateTitles: number;
  skippedGeneric: number;
  skippedAmbiguous: number;
  /** Titles dropped because too many bodies mention them. */
  skippedFrequent: number;
  /** Documents with a body that were scanned. */
  sources: number;
  /** Mention pairs found before de-duplication against stronger edges. */
  pairs: number;
  maxDocumentFrequency: number;
};

type GraphModel = {
  nodes: Map<string, ModelNode>;
  /** Sidebar items in sidebar order, then rows in row order. */
  order: ModelNode[];
  edges: ModelEdge[];
  /** Node id → indices into `edges`. */
  adjacency: Map<string, number[]>;
  tagLabels: Map<string, string>;
  itemByDatabaseId: Map<string, string>;
  mentionStats: MentionStats;
  /** Distinct repo paths the knowledge sources name (the code layer's size). */
  codePaths: number;
  approxBytes: number;
};

const EPOCH_MS = (value: Date | null | undefined): number => {
  const ms = value instanceof Date ? value.getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

const STATUS_BITS: Record<string, number> = { draft: 1, stable: 2, deprecated: 3 };

async function buildGraphModel(workspaceId: string): Promise<GraphModel> {
  const [itemRows, rowRows, linkRows, metadataRows, reviewRows] = await db.batch([
    db
      .select({
        id: workspaceItems.id,
        type: workspaceItems.type,
        title: workspaceItems.title,
        parentId: workspaceItems.parentId,
        pageContent: standalonePages.content,
        databaseId: databases.id,
        databaseSchema: databases.schema,
      })
      .from(workspaceItems)
      .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
      .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId))
      // Sidebar order (same tie-break as the sidebar and the workspace map), so
      // a fresh layout seeds nodes in an order a human recognizes.
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt), asc(workspaceItems.id)),
    db
      .select({
        id: pages.id,
        databaseId: pages.databaseId,
        title: pages.title,
        content: pages.content,
        agentEditedAt: pages.agentEditedAt,
      })
      .from(pages)
      .innerJoin(databases, eq(databases.id, pages.databaseId))
      .innerJoin(workspaceItems, and(eq(workspaceItems.id, databases.itemId), eq(workspaceItems.workspaceId, workspaceId)))
      .orderBy(asc(pages.sortOrder), asc(pages.id)),
    db
      .select({ fromId: pageLinks.fromId, toId: pageLinks.toId })
      .from(pageLinks)
      .where(eq(pageLinks.workspaceId, workspaceId)),
    db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId)),
    db
      .select({ review: knowledgeReviews })
      .from(knowledgeReviews)
      .innerJoin(knowledgeMetadata, and(eq(knowledgeMetadata.id, knowledgeReviews.metadataId), eq(knowledgeMetadata.workspaceId, workspaceId))),
  ]);

  const metadataByKey = new Map(metadataRows.map((row) => [`${row.itemType}:${row.itemId}`, row]));
  const reviewsByMetadata = new Map<string, Array<typeof knowledgeReviews.$inferSelect>>();
  for (const { review } of reviewRows) {
    const list = reviewsByMetadata.get(review.metadataId) ?? [];
    list.push(review);
    reviewsByMetadata.set(review.metadataId, list);
  }

  const nodes = new Map<string, ModelNode>();
  const order: ModelNode[] = [];
  const itemByDatabaseId = new Map<string, string>();
  const tagLabels = new Map<string, string>();
  const bodies: Array<{ id: string; body: string }> = [];
  /** Repo path → ids of the items whose sources name it. */
  const codeRefs = new Map<string, Set<string>>();
  let approxBytes = 0;

  const knowledgeState = (
    id: string,
    key: string,
    title: string,
    content: () => string,
  ): { state: number; staleAt: number; tags: string[] } => {
    const metadata = metadataByKey.get(key);
    if (!metadata) return { state: 0, staleAt: 0, tags: [] };
    for (const source of metadata.sources ?? []) {
      const path = typeof source?.resource === 'string' ? normalizeSourcePath(source.resource) : null;
      if (!path) continue;
      const refs = codeRefs.get(path);
      if (refs) refs.add(id);
      else codeRefs.set(path, new Set([id]));
    }
    // Hash only what carries metadata: trust is about the exact reviewed revision.
    const { trust } = trustFor(metadata, hashKnowledgeContent(title, content()), reviewsByMetadata.get(metadata.id) ?? []);
    const trustBits = trust === 'human-reviewed' ? 2 : trust === 'unverified' ? 0 : 1;
    const staleAt = metadata.staleAfter ? new Date(metadata.staleAfter).getTime() : 0;
    const tags: string[] = [];
    for (const raw of metadata.tags ?? []) {
      const label = String(raw).trim();
      const key = foldText(label);
      if (!key || tags.includes(key)) continue;
      tags.push(key);
      if (!tagLabels.has(key)) tagLabels.set(key, label);
    }
    return {
      state: trustBits | ((STATUS_BITS[metadata.status ?? ''] ?? 0) << NODE_STATE.statusShift) | NODE_STATE.concept,
      staleAt: Number.isFinite(staleAt) ? staleAt : 0,
      tags,
    };
  };

  for (const raw of itemRows) {
    const kind = raw.type === 'database' ? NODE_KIND.database : raw.type === 'dashboard' ? NODE_KIND.dashboard : NODE_KIND.page;
    // Dashboards are not knowledge items (see AGENTS.md → Dashboards): no metadata, no trust.
    const knowledge = raw.type === 'dashboard'
      ? { state: 0, staleAt: 0, tags: [] }
      : knowledgeState(raw.id, `${raw.type}:${raw.id}`, raw.title, () => raw.type === 'page' ? raw.pageContent ?? '' : JSON.stringify(raw.databaseSchema ?? []));
    const node: ModelNode = {
      id: raw.id,
      kind,
      title: raw.title,
      parentId: raw.parentId,
      ...(raw.databaseId ? { databaseId: raw.databaseId, rowCount: 0 } : {}),
      ...knowledge,
      agentEditedAt: 0,
      hasBody: raw.type === 'page' && !!raw.pageContent?.trim(),
    };
    nodes.set(raw.id, node);
    order.push(node);
    if (raw.databaseId) itemByDatabaseId.set(raw.databaseId, raw.id);
    if (raw.type === 'page' && raw.pageContent) bodies.push({ id: raw.id, body: raw.pageContent });
    approxBytes += 160 + raw.title.length * 2;
  }

  for (const raw of rowRows) {
    const databaseItemId = itemByDatabaseId.get(raw.databaseId);
    if (!databaseItemId) continue;
    const database = nodes.get(databaseItemId)!;
    database.rowCount = (database.rowCount ?? 0) + 1;
    const node: ModelNode = {
      id: raw.id,
      kind: NODE_KIND.row,
      title: raw.title,
      parentId: databaseItemId,
      databaseId: raw.databaseId,
      ...knowledgeState(raw.id, `database_row:${raw.id}`, raw.title, () => raw.content ?? ''),
      agentEditedAt: EPOCH_MS(raw.agentEditedAt),
      hasBody: !!raw.content?.trim(),
    };
    nodes.set(raw.id, node);
    order.push(node);
    if (raw.content) bodies.push({ id: raw.id, body: raw.content });
    approxBytes += 160 + raw.title.length * 2;
  }

  const code = buildCodeLayer(codeRefs);
  for (const node of code.nodes) {
    nodes.set(node.id, node);
    order.push(node);
    approxBytes += 160 + node.title.length * 2;
  }

  // Strongest relation per unordered pair wins (lower EDGE_KIND code first).
  const pairs = new Map<string, ModelEdge>();
  const addEdge = (a: string, b: string, kind: EdgeKindCode) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const existing = pairs.get(key);
    if (!existing || kind < existing.kind) pairs.set(key, { a, b, kind });
  };

  for (const node of order) {
    if (node.kind === NODE_KIND.row) addEdge(node.parentId!, node.id, EDGE_KIND.membership);
    // A code node's parent is its folder: a `folder` edge (below), not the page tree.
    else if (node.parentId && !isCodeKind(node.kind)) addEdge(node.parentId, node.id, EDGE_KIND.hierarchy);
  }

  // Stored target ids are unresolved (AGENTS.md → page_links): an item id, a
  // databases.id from a /db/<id> href, or a row id. Dangling and foreign ids
  // simply resolve to nothing.
  const resolve = (id: string) => (nodes.has(id) ? id : itemByDatabaseId.get(id) ?? null);
  for (const link of linkRows) {
    const to = resolve(link.toId);
    if (to) addEdge(link.fromId, to, EDGE_KIND.link);
  }

  // Code nodes carry no title anyone writes in prose: they stay out of the mention scan.
  const mentions = findMentions(order.filter((node) => !isCodeKind(node.kind)), bodies);
  for (const [from, to] of mentions.pairs) addEdge(from, to, EDGE_KIND.mention);

  for (const [folder, child] of code.contains) addEdge(folder, child, EDGE_KIND.folder);
  for (const [path, refs] of codeRefs) for (const id of refs) addEdge(id, codeNodeId(path), EDGE_KIND.source);

  const edges = [...pairs.values()];
  const adjacency = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    for (const end of [edge.a, edge.b]) {
      const list = adjacency.get(end);
      if (list) list.push(index);
      else adjacency.set(end, [index]);
    }
  });
  approxBytes += edges.length * 120;

  return { nodes, order, edges, adjacency, tagLabels, itemByDatabaseId, mentionStats: mentions.stats, codePaths: codeRefs.size, approxBytes };
}

// ── Code layer (P13) ─────────────────────────────────────────────────────────
//
// "The whole project" is the knowledge plus the code it rests on. Remnus never
// sees the repository — only the paths calibration (and people) wrote into
// `sources` — so the layer is exactly those files, arranged in the folders
// their paths name. A folder is drawn when a source names it or when it holds
// two or more things; a chain of single-child folders collapses into the
// nearest one that branches, so `src/lib/services/auth.ts` alone does not
// bring three empty folders along.

const codeNodeId = (path: string) => `code:${path}`;

function buildCodeLayer(refs: Map<string, Set<string>>): { nodes: ModelNode[]; contains: Array<[string, string]> } {
  type Dir = { path: string; dirs: Map<string, Dir>; files: string[] };
  const root: Dir = { path: '', dirs: new Map(), files: [] };
  for (const path of refs.keys()) {
    const folder = path.endsWith('/');
    const parts = path.split('/').filter(Boolean);
    let dir = root;
    for (const part of folder ? parts : parts.slice(0, -1)) {
      let next = dir.dirs.get(part);
      if (!next) {
        next = { path: `${dir.path}${part}/`, dirs: new Map(), files: [] };
        dir.dirs.set(part, next);
      }
      dir = next;
    }
    if (!folder) dir.files.push(path);
  }

  const nodes: ModelNode[] = [];
  const contains: Array<[string, string]> = [];
  const codeNode = (path: string, kind: NodeKindCode): ModelNode => {
    const node: ModelNode = {
      id: codeNodeId(path),
      kind,
      title: path,
      parentId: null,
      state: 0,
      staleAt: 0,
      agentEditedAt: 0,
      tags: [],
      hasBody: false,
      refCount: refs.get(path)?.size ?? 0,
    };
    nodes.push(node);
    return node;
  };
  // Post-order: returns the nodes that stand for `dir` inside its parent —
  // itself when it is drawn, its children when it collapses away.
  const visit = (dir: Dir): ModelNode[] => {
    const children = [...dir.files].sort().map((path) => codeNode(path, NODE_KIND.file));
    for (const name of [...dir.dirs.keys()].sort()) children.push(...visit(dir.dirs.get(name)!));
    if (dir === root || (!refs.has(dir.path) && children.length < 2)) return children;
    const folder = codeNode(dir.path, NODE_KIND.folder);
    for (const child of children) {
      child.parentId = folder.id;
      contains.push([folder.id, child.id]);
    }
    return [folder];
  };
  visit(root);
  return { nodes, contains };
}

// ── Unlinked mentions ────────────────────────────────────────────────────────
//
// "Body of A names B's title" is cheap to find but noisy, so the rules are
// strict and measured (see the bench:graph script):
//   - titles are folded (`foldText`, the same rule as search) and split into
//     words; a title of more than MAX_TITLE_WORDS words is not a phrase anyone
//     writes verbatim, so it is not indexed;
//   - one-word titles shorter than MIN_SINGLE_WORD letters, numbers, and
//     generic titles ("Notes", "Todo", "Backlog", their Turkish equivalents)
//     are not indexed, and neither is a title shared by two nodes (recurring
//     calendar rows share theirs — which one would the body mean?);
//   - a title mentioned by more than max(MENTION_MIN_DF, MENTION_MAX_SHARE of
//     the scanned bodies) is dropped after the scan: it is the workspace's
//     vocabulary (the product name, the team name), not a relation.
//
// Scanning is a word window over each body against a hash set of title phrases
// plus a set of their prefixes, so it is O(total words × matched prefix
// length) — never titles × bodies.

const MAX_TITLE_WORDS = 6;
const MIN_SINGLE_WORD = 4;
const MIN_PHRASE_LETTERS = 5;
export const MENTION_MIN_DF = 8;
export const MENTION_MAX_SHARE = 0.1;
/** A list page that names hundreds of titles still says something, but not 100+ lines of it. */
const MAX_MENTIONS_PER_SOURCE = 60;

const GENERIC_TITLES = new Set([
  'notes', 'note', 'todo', 'todos', 'to do', 'backlog', 'tasks', 'task', 'ideas', 'idea', 'inbox',
  'archive', 'docs', 'doc', 'readme', 'overview', 'index', 'home', 'misc', 'general', 'untitled',
  'draft', 'drafts', 'test', 'page', 'pages', 'table', 'list', 'new page', 'meeting', 'meetings',
  'journal', 'log', 'wiki', 'faq', 'help', 'project', 'projects', 'team', 'calendar', 'events',
  'notlar', 'gorevler', 'gorev', 'yapilacaklar', 'fikirler', 'fikir', 'arsiv', 'genel', 'taslak',
  'liste', 'toplanti', 'toplantilar', 'gunluk', 'proje', 'projeler', 'takim', 'takvim', 'belgeler',
  'adsiz', 'yeni sayfa', 'sayfa',
].map(foldText));

function titleWords(value: string): string[] {
  return foldText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// A page link's anchor text IS the linked title: it is already an edge, and
// counting it made every often-linked page look "too frequent" and get cut.
// Other tags (child blocks carry uuids) and markdown link targets are noise.
function bodyWords(markdown: string): string[] {
  return titleWords(
    markdown
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\]\([^)]*\)/g, '] '),
  );
}

export function findMentions(
  targets: Array<{ id: string; title: string }>,
  sources: Array<{ id: string; body: string }>,
  /** Measurement only (bench:graph) — the product always uses the defaults. */
  cut: { minDf?: number; maxShare?: number } = {},
): { pairs: Array<[string, string]>; stats: MentionStats; documentFrequency: Map<string, number> } {
  const phrases = new Map<string, string | null>();
  let skippedGeneric = 0;
  for (const target of targets) {
    const words = titleWords(target.title);
    if (words.length === 0 || words.length > MAX_TITLE_WORDS) continue;
    const phrase = words.join(' ');
    const letters = words.reduce((sum, word) => sum + word.length, 0);
    if (
      GENERIC_TITLES.has(phrase) ||
      (words.length === 1 && (phrase.length < MIN_SINGLE_WORD || /^\p{N}+$/u.test(phrase))) ||
      letters < MIN_PHRASE_LETTERS
    ) {
      skippedGeneric++;
      continue;
    }
    phrases.set(phrase, phrases.has(phrase) ? null : target.id);
  }
  let skippedAmbiguous = 0;
  const prefixes = new Set<string>();
  for (const [phrase, id] of phrases) {
    if (id === null) {
      skippedAmbiguous++;
      continue;
    }
    const words = phrase.split(' ');
    for (let n = 1; n < words.length; n++) prefixes.add(words.slice(0, n).join(' '));
  }

  const found = new Map<string, Set<string>>(); // target → sources
  let scanned = 0;
  for (const source of sources) {
    const words = bodyWords(source.body);
    if (words.length === 0) continue;
    scanned++;
    const hits = new Set<string>();
    for (let i = 0; i < words.length && hits.size < MAX_MENTIONS_PER_SOURCE; i++) {
      let key = words[i];
      for (let n = 1; n <= MAX_TITLE_WORDS; n++) {
        const target = phrases.get(key);
        if (target && target !== source.id) hits.add(target);
        if (!prefixes.has(key) || i + n >= words.length) break;
        key = `${key} ${words[i + n]}`;
      }
    }
    for (const target of hits) {
      const list = found.get(target);
      if (list) list.add(source.id);
      else found.set(target, new Set([source.id]));
    }
  }

  const maxDf = Math.max(cut.minDf ?? MENTION_MIN_DF, Math.ceil(scanned * (cut.maxShare ?? MENTION_MAX_SHARE)));
  const pairs: Array<[string, string]> = [];
  const documentFrequency = new Map<string, number>();
  let skippedFrequent = 0;
  let maxDocumentFrequency = 0;
  for (const [target, from] of found) {
    documentFrequency.set(target, from.size);
    maxDocumentFrequency = Math.max(maxDocumentFrequency, from.size);
    if (from.size > maxDf) {
      skippedFrequent++;
      continue;
    }
    for (const source of from) pairs.push([source, target]);
  }

  return {
    pairs,
    documentFrequency,
    stats: {
      candidateTitles: phrases.size - skippedAmbiguous,
      skippedGeneric,
      skippedAmbiguous,
      skippedFrequent,
      sources: scanned,
      pairs: pairs.length,
      maxDocumentFrequency,
    },
  };
}

// ── Model cache ──────────────────────────────────────────────────────────────
//
// Same contract as the prepare_context corpus cache (services/contextPack.ts):
// keyed by `getKnowledgeCorpusVersion` (content, deletions, counts and the
// knowledge tables), null inside the hot second = never cached, per process,
// best-effort. Bodies are scanned for mentions and dropped — the cached model
// holds titles, ids and edges only.

const GRAPH_CACHE_BUDGET_BYTES = 16 * 1024 * 1024;
const modelCache = new Map<string, { version: string; model: GraphModel }>();
let modelCacheBytes = 0;

function forgetModel(workspaceId: string): void {
  const entry = modelCache.get(workspaceId);
  if (!entry) return;
  modelCache.delete(workspaceId);
  modelCacheBytes -= entry.model.approxBytes;
}

function rememberModel(workspaceId: string, version: string, model: GraphModel): void {
  forgetModel(workspaceId);
  if (model.approxBytes > GRAPH_CACHE_BUDGET_BYTES) return;
  for (const [oldest] of modelCache) {
    if (modelCacheBytes + model.approxBytes <= GRAPH_CACHE_BUDGET_BYTES) break;
    forgetModel(oldest);
  }
  modelCache.set(workspaceId, { version, model });
  modelCacheBytes += model.approxBytes;
}

async function loadGraphModel(workspaceId: string, version: string | null): Promise<GraphModel> {
  if (version) {
    const cached = modelCache.get(workspaceId);
    if (cached?.version === version) {
      modelCache.delete(workspaceId);
      modelCache.set(workspaceId, cached);
      return cached.model;
    }
  }
  const model = await buildGraphModel(workspaceId);
  if (version) rememberModel(workspaceId, version, model);
  return model;
}

// ── Agent activity ───────────────────────────────────────────────────────────

/** The audited tools that name a target and only read it; every other targeted tool writes. */
const READ_TOOLS = ['get_page', 'get_database_schema', 'query_database', 'get_related_pages'];

type Activity = Map<string, { at: number; wrote: boolean }>;

function normalizeActivityDays(days: number | undefined): ActivityDays {
  return (ACTIVITY_DAY_OPTIONS as readonly number[]).includes(days ?? NaN) ? (days as ActivityDays) : DEFAULT_ACTIVITY_DAYS;
}

/**
 * One grouped read over the window. `agent_activity` is indexed on
 * (workspace_id, created_at) since migration 0053, so this is a range scan of
 * the window, not of the workspace's whole audit history (measured: 1,766 of
 * 30,000 rows for 7 days).
 */
function activityQuery(workspaceId: string, since: Date) {
  return db
    .select({
      targetId: agentActivity.targetId,
      at: sql<number>`max(${asEpochSeconds(agentActivity.createdAt)})`,
      wrote: sql<number>`max(case when ${agentActivity.tool} in (${sql.join(READ_TOOLS.map((tool) => sql`${tool}`), sql`, `)}) then 0 else 1 end)`,
    })
    .from(agentActivity)
    .where(and(
      eq(agentActivity.workspaceId, workspaceId),
      // The index range: integers from `since` on, plus any legacy TEXT
      // timestamp (TEXT sorts above every number)…
      gte(agentActivity.createdAt, since),
      // …which the exact test then keeps only when it really is that recent.
      activityAtOrAfter(since),
      eq(agentActivity.status, 'success'),
      isNotNull(agentActivity.targetId),
    ))
    .groupBy(agentActivity.targetId);
}

function collectActivity(
  model: GraphModel,
  rows: Array<{ targetId: string | null; at: number; wrote: number }>,
  sinceMs: number,
): Activity {
  const activity: Activity = new Map();
  const touch = (id: string, atSeconds: number, wrote: boolean) => {
    const current = activity.get(id);
    if (!current) activity.set(id, { at: atSeconds, wrote });
    else {
      current.at = Math.max(current.at, atSeconds);
      current.wrote ||= wrote;
    }
  };
  for (const row of rows) {
    if (!row.targetId) continue;
    // Targets are logged as item ids, row ids or databases.id (the database tools).
    const id = model.nodes.has(row.targetId) ? row.targetId : model.itemByDatabaseId.get(row.targetId);
    const at = Number(row.at);
    if (id && Number.isFinite(at)) touch(id, at, Number(row.wrote) === 1);
  }
  // Bulk tools log no per-row target; rows carry their own agent stamp.
  for (const node of model.order) {
    if (node.agentEditedAt >= sinceMs) touch(node.id, Math.floor(node.agentEditedAt / 1000), true);
  }
  return activity;
}

// ── Projection ───────────────────────────────────────────────────────────────

function nodeState(node: ModelNode, now: number, activity: { at: number; wrote: boolean } | undefined): number {
  let state = node.state;
  if (node.staleAt && node.staleAt < now) state |= NODE_STATE.stale;
  if (activity) state |= activity.wrote ? NODE_STATE.agentWrote : NODE_STATE.agentRead;
  return state;
}

function tagNodeId(key: string): string {
  return `tag:${key}`;
}

/**
 * Tags become NODES, not pairwise edges: a tag on k items is k edges this way
 * and k(k-1)/2 the other, and calibration writes tags in two languages on
 * every concept — a tag on 200 rows would be ~20,000 edges as pairs. A tag is
 * shown only when it connects two or more visible nodes.
 */
function projectGraph(
  model: GraphModel,
  expanded: Set<string>,
  activity: Activity,
  activityDays: ActivityDays,
  workspaceId: string,
  includeCode: boolean,
): GraphPayload {
  const now = Date.now();
  const visible = (id: string): string => {
    const node = model.nodes.get(id)!;
    return node.kind === NODE_KIND.row && !expanded.has(node.parentId!) ? node.parentId! : id;
  };

  const nodes: GraphNodeTuple[] = [];
  const index = new Map<string, number>();
  const folded = new Map<string, { at: number; wrote: boolean }>();
  for (const node of model.order) {
    // Left out, the code layer's edges find no index below and drop with it.
    if (!includeCode && isCodeKind(node.kind)) continue;
    const act = activity.get(node.id);
    if (node.kind === NODE_KIND.row && !expanded.has(node.parentId!)) {
      // A folded database shows the freshest agent touch among its rows.
      if (act) {
        const current = folded.get(node.parentId!);
        if (!current) folded.set(node.parentId!, { ...act });
        else {
          current.at = Math.max(current.at, act.at);
          current.wrote ||= act.wrote;
        }
      }
      continue;
    }
    index.set(node.id, nodes.length);
    nodes.push(toTuple(node, now, act, index));
  }
  for (const [databaseId, act] of folded) {
    const tuple = nodes[index.get(databaseId)!];
    const own = activity.get(databaseId);
    const merged = own ? { at: Math.max(own.at, act.at), wrote: own.wrote || act.wrote } : act;
    tuple[3] = nodeState(model.nodes.get(databaseId)!, now, merged);
    tuple[4] = merged.at;
  }

  const edgeMap = new Map<string, GraphEdgeTuple>();
  for (const edge of model.edges) {
    const a = index.get(visible(edge.a));
    const b = index.get(visible(edge.b));
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const existing = edgeMap.get(key);
    if (!existing) edgeMap.set(key, [a, b, edge.kind]);
    else {
      existing[3] = (existing[3] ?? 1) + 1;
      if (edge.kind < existing[2]) {
        existing[0] = a;
        existing[1] = b;
        existing[2] = edge.kind;
      }
    }
  }
  const edges = [...edgeMap.values()];

  const tagMembers = new Map<string, Set<number>>();
  for (const node of model.order) {
    if (node.tags.length === 0) continue;
    const member = index.get(visible(node.id));
    if (member === undefined) continue;
    for (const key of node.tags) {
      const set = tagMembers.get(key);
      if (set) set.add(member);
      else tagMembers.set(key, new Set([member]));
    }
  }
  for (const [key, members] of tagMembers) {
    if (members.size < 2) continue;
    const tagIndex = nodes.length;
    nodes.push([tagNodeId(key), NODE_KIND.tag, model.tagLabels.get(key) ?? key, 0, 0, null, members.size]);
    for (const member of members) edges.push([tagIndex, member, EDGE_KIND.tag]);
  }

  return {
    v: 1,
    workspaceId,
    nodes,
    edges,
    expanded: [...expanded],
    activityDays,
    ...(model.codePaths > 0 ? { codePaths: model.codePaths } : {}),
    generatedAt: Math.floor(now / 1000),
  };
}

function toTuple(node: ModelNode, now: number, act: { at: number; wrote: boolean } | undefined, index: Map<string, number>): GraphNodeTuple {
  // Code nodes are not knowledge: no trust, no agent colour — just how many items rest on them.
  if (isCodeKind(node.kind)) return [node.id, node.kind, node.title, 0, 0, null, node.refCount ?? 0];
  const state = nodeState(node, now, act);
  const agentAt = act?.at ?? 0;
  if (node.kind === NODE_KIND.database) return [node.id, node.kind, node.title, state, agentAt, node.databaseId ?? null, node.rowCount ?? 0];
  // A row's database always precedes it in `order`, so its index exists.
  if (node.kind === NODE_KIND.row) return [node.id, node.kind, node.title, state, agentAt, index.get(node.parentId!) ?? null];
  return [node.id, node.kind, node.title, state, agentAt];
}

// ── Needs attention ──────────────────────────────────────────────────────────
//
// The part that makes this a maintenance view rather than a picture. Computed
// over the whole model, so it does not depend on which databases are expanded.

/** Explicit links + mentions (in and out) from which an unreviewed node counts as a hub. */
const HUB_MIN_DEGREE = 3;
const HUB_LIMIT = 15;

function computeAttention(model: GraphModel, now: number): GraphAttention {
  const linked = new Set<string>();
  const mentionedBy = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const edge of model.edges) {
    if (edge.kind !== EDGE_KIND.link && edge.kind !== EDGE_KIND.mention) continue;
    degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
    degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
    if (edge.kind === EDGE_KIND.link) {
      linked.add(edge.a);
      linked.add(edge.b);
    } else {
      mentionedBy.set(edge.b, (mentionedBy.get(edge.b) ?? 0) + 1);
    }
  }
  const tagUse = new Map<string, number>();
  for (const node of model.order) for (const key of node.tags) tagUse.set(key, (tagUse.get(key) ?? 0) + 1);

  const entry = (node: ModelNode, metric: number): AttentionEntry => [
    node.id,
    node.kind,
    node.title,
    node.kind === NODE_KIND.row ? node.parentId : null,
    metric,
  ];

  // An orphan is knowledge nothing points to or from except the tree: a page
  // with a body, or a labelled row/database, with no link and no shared tag.
  // Being mentioned does not count as connected — it is the linking
  // opportunity the entry shows. Folders (empty pages) and plain rows (tasks,
  // events) are not knowledge to maintain.
  const orphanNodes = model.order.filter((node) => {
    const knowledge = node.kind === NODE_KIND.page ? node.hasBody || (node.state & NODE_STATE.concept) !== 0 : (node.state & NODE_STATE.concept) !== 0 && node.kind !== NODE_KIND.dashboard;
    return knowledge && !linked.has(node.id) && !node.tags.some((key) => (tagUse.get(key) ?? 0) >= 2);
  });
  orphanNodes.sort((a, b) =>
    (b.state & NODE_STATE.concept) - (a.state & NODE_STATE.concept) ||
    (mentionedBy.get(b.id) ?? 0) - (mentionedBy.get(a.id) ?? 0));

  const outdatedNodes = model.order.filter((node) =>
    (node.staleAt !== 0 && node.staleAt < now) ||
    ((node.state & NODE_STATE.statusMask) >> NODE_STATE.statusShift) === 3);

  // A node only mentioned (never linked) would read as both "nothing links
  // here" and "well connected"; the orphan list already shows its mentions.
  const orphanIds = new Set(orphanNodes.map((node) => node.id));
  const hubs = model.order
    .filter((node) => (degree.get(node.id) ?? 0) >= HUB_MIN_DEGREE && (node.state & NODE_STATE.trustMask) !== 2 && node.kind !== NODE_KIND.dashboard && !orphanIds.has(node.id))
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, HUB_LIMIT);

  return {
    orphans: orphanNodes.slice(0, ATTENTION_LIST_LIMIT).map((node) => entry(node, mentionedBy.get(node.id) ?? 0)),
    orphanTotal: orphanNodes.length,
    outdated: outdatedNodes.slice(0, ATTENTION_LIST_LIMIT).map((node) => entry(node, nodeState(node, now, undefined))),
    outdatedTotal: outdatedNodes.length,
    hubs: hubs.map((node) => entry(node, degree.get(node.id) ?? 0)),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export type WorkspaceGraphOptions = {
  /** Database ITEM ids (or databases.id) whose rows should be nodes. */
  expanded?: string[];
  activityDays?: number;
  /** Include the code layer's file and folder nodes (off by default: most maps have none, and it is a view choice). */
  code?: boolean;
};

async function loadModelAndActivity(workspaceId: string, activityDays: ActivityDays) {
  // One `now` for both windows: comparing two clock reads flagged a 7-day
  // request as "cut by the plan" on a 7-day plan by a few milliseconds.
  const now = Date.now();
  const requested = now - activityDays * 86_400_000;
  // The version key and the plan's audit window are independent: one parallel turn.
  const [version, visibleSince] = await Promise.all([
    getKnowledgeCorpusVersion(workspaceId).catch(() => null),
    auditVisibleSince(workspaceId, now),
  ]);
  // "Which pages did an agent read" IS audit-log information, so it stays inside
  // the plan's audit window (services/auditRetention.ts) like every other surface
  // that shows it. Rows' own agent-edit stamps are content, not audit, and follow
  // the requested window.
  const auditSince = new Date(Math.max(requested, visibleSince.getTime()));
  const [model, activityRows] = await Promise.all([
    loadGraphModel(workspaceId, version),
    activityQuery(workspaceId, auditSince),
  ]);
  return {
    model,
    activity: collectActivity(model, activityRows, requested),
    auditClamped: auditSince.getTime() > requested,
  };
}

/**
 * The workspace map. Rows are folded into their database node unless the
 * database is listed in `expanded` — the client expands one by asking again.
 * Callers must have checked access to `workspaceId`; unknown expanded ids are
 * ignored, so a foreign id cannot pull anything in.
 */
export async function getWorkspaceGraph(workspaceId: string, options: WorkspaceGraphOptions = {}): Promise<GraphPayload> {
  const activityDays = normalizeActivityDays(options.activityDays);
  const { model, activity, auditClamped } = await loadModelAndActivity(workspaceId, activityDays);
  const expanded = new Set<string>();
  for (const id of (options.expanded ?? []).slice(0, MAX_EXPANDED_DATABASES)) {
    const itemId = model.nodes.get(id)?.kind === NODE_KIND.database ? id : model.itemByDatabaseId.get(id);
    if (itemId) expanded.add(itemId);
  }
  const payload = projectGraph(model, expanded, activity, activityDays, workspaceId, options.code === true);
  payload.attention = computeAttention(model, Date.now());
  return auditClamped ? { ...payload, auditLimited: true } : payload;
}

/** Most nodes a local (per-page) graph returns. */
const LOCAL_NODE_CAP = 120;
/** Rows of a database shown when the database itself is the page in focus. */
const LOCAL_ROWS_OF_SUBJECT = 40;
/** Members followed through one tag at depth 2. */
const LOCAL_TAG_FANOUT = 12;

/**
 * One or two steps around one item or row, rows NOT folded (the neighbourhood
 * is small by construction). A database's rows are only followed when the
 * database is the subject; a row brings its database, not its siblings. The
 * code layer is always in: the files a page rests on, and at two steps the
 * other pages resting on them, are the neighbourhood that matters most here.
 * Returns null when the id is not a node of this workspace.
 */
export async function getLocalGraph(workspaceId: string, itemId: string, depth: 1 | 2 = 1): Promise<GraphPayload | null> {
  const { model, activity } = await loadModelAndActivity(workspaceId, DEFAULT_ACTIVITY_DAYS);
  const subject = model.nodes.get(itemId);
  if (!subject) return null;

  const now = Date.now();
  const members = new Map<string, Set<string>>(); // tag key → node ids
  for (const node of model.order) {
    for (const key of node.tags) {
      const set = members.get(key);
      if (set) set.add(node.id);
      else members.set(key, new Set([node.id]));
    }
  }

  const included = new Set<string>([subject.id]);
  const tagEdges = new Map<string, Set<string>>(); // tag key → included members
  let frontier = [subject.id];
  let truncated = false;
  for (let step = 0; step < depth && frontier.length > 0 && !truncated; step++) {
    const next: string[] = [];
    const add = (id: string) => {
      if (included.has(id)) return true;
      if (included.size >= LOCAL_NODE_CAP) {
        truncated = true;
        return false;
      }
      included.add(id);
      next.push(id);
      return true;
    };
    for (const id of frontier) {
      const node = model.nodes.get(id)!;
      let rowsTaken = 0;
      for (const edgeIndex of model.adjacency.get(id) ?? []) {
        const edge = model.edges[edgeIndex];
        const other = edge.a === id ? edge.b : edge.a;
        if (edge.kind === EDGE_KIND.membership && node.kind === NODE_KIND.database) {
          if (id !== subject.id || rowsTaken >= LOCAL_ROWS_OF_SUBJECT) continue;
          rowsTaken++;
        }
        if (!add(other)) break;
      }
      for (const key of node.tags) {
        const tagged = members.get(key)!;
        if (tagged.size < 2) continue;
        const shown = tagEdges.get(key) ?? new Set<string>();
        shown.add(id);
        tagEdges.set(key, shown);
        // Members reached through a tag count as one step further out.
        if (step + 1 >= depth) continue;
        let taken = 0;
        for (const member of tagged) {
          if (member === id || taken >= LOCAL_TAG_FANOUT) continue;
          if (!add(member)) break;
          shown.add(member);
          taken++;
        }
      }
    }
    frontier = next;
  }

  // A row's tuple points at its database's index, so every included row brings
  // its database (over the cap if need be: one node, and the href needs it).
  for (const id of [...included]) {
    const node = model.nodes.get(id)!;
    if (node.kind === NODE_KIND.row) included.add(node.parentId!);
  }

  const nodes: GraphNodeTuple[] = [];
  const index = new Map<string, number>();
  // `order` lists every database before any row, so the index exists when a row needs it.
  for (const node of model.order) {
    if (!included.has(node.id)) continue;
    index.set(node.id, nodes.length);
    nodes.push(toTuple(node, now, activity.get(node.id), index));
  }
  const edges: GraphEdgeTuple[] = [];
  for (const edge of model.edges) {
    const a = index.get(edge.a);
    const b = index.get(edge.b);
    if (a !== undefined && b !== undefined) edges.push([a, b, edge.kind]);
  }
  for (const [key, shown] of tagEdges) {
    const visibleMembers = [...shown].filter((id) => index.has(id));
    if (visibleMembers.length < 2) continue;
    const tagIndex = nodes.length;
    nodes.push([tagNodeId(key), NODE_KIND.tag, model.tagLabels.get(key) ?? key, 0, 0, null, members.get(key)!.size]);
    for (const id of visibleMembers) edges.push([tagIndex, index.get(id)!, EDGE_KIND.tag]);
  }

  return {
    v: 1,
    workspaceId,
    nodes,
    edges,
    expanded: [],
    activityDays: DEFAULT_ACTIVITY_DAYS,
    focus: index.get(subject.id),
    ...(truncated ? { truncated: true } : {}),
    generatedAt: Math.floor(now / 1000),
  };
}

/** For scripts and tests: the mention statistics of the cached/built model. */
export async function getGraphModelStats(workspaceId: string) {
  const version = await getKnowledgeCorpusVersion(workspaceId).catch(() => null);
  const model = await loadGraphModel(workspaceId, version);
  const byKind = [0, 0, 0, 0, 0, 0, 0];
  for (const edge of model.edges) byKind[edge.kind]++;
  return {
    nodes: model.order.length,
    edges: model.edges.length,
    edgesByKind: { hierarchy: byKind[0], membership: byKind[1], link: byKind[2], mention: byKind[3], source: byKind[5], folder: byKind[6] },
    tags: model.tagLabels.size,
    codePaths: model.codePaths,
    codeNodes: model.order.filter((node) => isCodeKind(node.kind)).length,
    mentions: model.mentionStats,
    approxBytes: model.approxBytes,
  };
}
