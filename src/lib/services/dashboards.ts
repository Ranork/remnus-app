/**
 * Cookie-free dashboard writes — the one path every writer goes through: the
 * MCP tools (`create_dashboard`, `update_dashboard`) and the web editor's
 * server actions alike. Callers authorize first; everything here takes an
 * explicit workspaceId and never reaches outside it.
 *
 * Three things this module is responsible for, and each is load-bearing:
 *
 *  1. **Patches address blocks by id and pass unknown blocks through.** Only
 *     the blocks a call touches are validated. A block this build cannot read
 *     survives an edit to a different block, exactly as in P6's
 *     `loadSpecForWrite` — validating the whole document on every write would
 *     quietly delete it.
 *  2. **Errors teach.** An agent never sees the screen it builds, so a refused
 *     write names the block, the field and what was expected (valid types,
 *     allowed fields), and a successful one comes back with `warnings` for
 *     anything that will render empty or broken.
 *  3. **Writes are compare-and-swap on the stored spec.** Two writers patching
 *     different blocks at once must both land. Ops are id-based, so a lost
 *     race is simply re-applied to the newer document.
 *
 * What gets stored is the caller's own input after reference normalization —
 * never the zod output with defaults filled in. The spec is read leniently
 * and defaults apply at read time, so storing them would only make every
 * later `get_page` of the dashboard longer.
 */
import { db } from '@/db';
import { dashboards, databases, workspaceItems } from '@/db/schema';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  DASHBOARD_BLOCK_CATALOG,
  DASHBOARD_SPEC_VERSION,
  MAX_DASHBOARD_BLOCKS,
  activityBlockSchema,
  chartBlockSchema,
  databaseEmbedBlockSchema,
  linksBlockSchema,
  listBlockSchema,
  metricBlockSchema,
  textBlockSchema,
  type DashboardBlockType,
} from '@/lib/dashboard/schema';
import { resolveDashboard, type ResolvedBlock } from '@/lib/dashboard/data';

/** A refused write. The message is written for the agent (or human) who has to fix it. */
export class DashboardInputError extends Error {}

const BLOCK_TYPES = DASHBOARD_BLOCK_CATALOG.map((c) => c.type);

const BLOCK_SCHEMAS: Record<DashboardBlockType, z.ZodObject> = {
  metric: metricBlockSchema,
  chart: chartBlockSchema,
  database_embed: databaseEmbedBlockSchema,
  list: listBlockSchema,
  text: textBlockSchema,
  links: linksBlockSchema,
  activity: activityBlockSchema,
};

/** Where the full field reference lives; appended once to a refused write. */
const CATALOG_HINT = 'Block fields: remnus://dashboard/catalog.';

type RawBlock = Record<string, unknown>;
/** A block this write validates. `strictSource`: a source that cannot be found is
 *  refused rather than warned about — true unless an update left the source alone. */
type Touched = { block: RawBlock; at: string; strictSource: boolean };
type Column = { id: string; name: string; type: string; options?: unknown[] };
type DbInfo = { id: string; itemId: string; name: string; columns: Column[]; views: { id: string; name: string; type: string }[] };

export type DashboardPatch = {
  /** New blocks, appended in order. A missing `id` is generated from the type. */
  add?: unknown[];
  /** `{ id, ...fields }` merged into that block; a `null` field is removed. `type` cannot change. */
  update?: unknown[];
  /** Whole blocks swapped in by id — the web editor's form submits a complete block. */
  replace?: unknown[];
  remove?: string[];
  /** Block ids in their new order; blocks left out keep their relative order after them. */
  order?: string[];
};

/** Item-level fields; `null` clears an icon. */
export type DashboardMeta = { title?: string; icon?: string | null; iconColor?: string | null };

export type DashboardWriteResult = {
  /** Workspace item id of the dashboard. */
  id: string;
  /** Every block id, in display order. */
  blocks: string[];
  /** Things that will render empty or broken. Present only when non-empty. */
  warnings?: string[];
};

// ── Input validation ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is RawBlock {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Blocks whose id this module generated — naming such an id in an error would only confuse. */
const generatedIds = new WeakSet<object>();

function label(where: string, raw: unknown): string {
  return isObject(raw) && typeof raw.id === 'string' && !generatedIds.has(raw) ? `${where} ("${raw.id}")` : where;
}

function valueAt(raw: unknown, path: PropertyKey[]): unknown {
  let cur = raw;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

function describeExpected(issue: z.core.$ZodIssue): string {
  if (issue.code === 'invalid_type') return String(issue.expected);
  if (issue.code === 'invalid_value') return issue.values.map(String).join('|');
  return 'a value';
}

/**
 * Strict validation of ONE block, with a message an agent can act on:
 * an unknown `type` lists the valid ones, an unknown field lists the fields the
 * type takes, a missing field says so instead of "expected string, received
 * undefined".
 */
function validateBlock(where: string, raw: unknown): string[] {
  const at = label(where, raw);
  if (!isObject(raw)) return [`${at}: a block must be an object`];
  const type = raw.type;
  if (typeof type !== 'string' || !type) {
    return [`${at}.type: missing — one of ${BLOCK_TYPES.join(', ')}`];
  }
  if (!(BLOCK_TYPES as string[]).includes(type)) {
    return [`${at}.type: "${type}" is not a block type — use one of ${BLOCK_TYPES.join(', ')}`];
  }
  const schema = BLOCK_SCHEMAS[type as DashboardBlockType];
  const result = schema.safeParse(raw);
  if (result.success) return [];

  return result.error.issues.slice(0, 4).map((issue) => {
    const path = issue.path.length ? `.${issue.path.join('.')}` : '';
    if (issue.code === 'unrecognized_keys') {
      const allowed = Object.keys(schema.shape).join(', ');
      return `${at}${path}: unknown field ${issue.keys.map((k) => `"${k}"`).join(', ')} — ${type} takes ${allowed}`;
    }
    if ((issue.code === 'invalid_type' || issue.code === 'invalid_value') && valueAt(raw, issue.path) === undefined) {
      return `${at}${path}: missing (expected ${describeExpected(issue)})`;
    }
    return `${at}${path}: ${issue.message}`;
  });
}

function refuse(errors: string[]): never {
  throw new DashboardInputError(`${errors.slice(0, 6).join('; ')}${errors.length > 6 ? ` (+${errors.length - 6} more)` : ''}. ${CATALOG_HINT}`);
}

function blockIdOf(raw: unknown): string | null {
  return isObject(raw) && typeof raw.id === 'string' ? raw.id : null;
}

/** `metric3`, `chart1` … — short, readable, and unique within the dashboard. */
function generateBlockId(type: string, taken: Set<string>): string {
  const base = /^[a-z_]+$/.test(type) ? type.replace(/_/g, '') : 'block';
  for (let n = 1; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ── Reference normalization ──────────────────────────────────────────────────

/**
 * Loads every database the given refs name, INSIDE this workspace only, keyed
 * by both `databases.id` and the database's workspace-item id — agents see
 * both (the map prints `databaseId`, `list_workspace` the item id), and a
 * dashboard stores the former.
 */
async function loadDatabases(workspaceId: string, refs: string[]): Promise<Map<string, DbInfo>> {
  const map = new Map<string, DbInfo>();
  if (!refs.length) return map;
  const rows = await db
    .select({
      id: databases.id,
      itemId: workspaceItems.id,
      name: databases.name,
      schema: databases.schema,
      views: databases.views,
    })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(and(
      eq(workspaceItems.workspaceId, workspaceId),
      or(inArray(databases.id, refs), inArray(workspaceItems.id, refs)),
    ));
  for (const r of rows) {
    const info: DbInfo = {
      id: r.id,
      itemId: r.itemId,
      name: r.name,
      columns: ((r.schema ?? []) as Column[]).filter((c) => c && typeof c.id === 'string'),
      views: ((r.views ?? []) as { id: string; name: string; config?: { type?: string } }[])
        .filter((v) => v && typeof v.id === 'string')
        .map((v) => ({ id: v.id, name: v.name, type: v.config?.type ?? '' })),
    };
    map.set(r.id, info);
    map.set(r.itemId, info);
  }
  return map;
}

function sourceRef(block: RawBlock): string | null {
  if (block.type === 'database_embed') return typeof block.databaseId === 'string' ? block.databaseId : null;
  if (block.type === 'metric' || block.type === 'chart' || block.type === 'list') {
    const source = block.source as RawBlock | undefined;
    return typeof source?.databaseId === 'string' ? source.databaseId : null;
  }
  return null;
}

function columnList(info: DbInfo): string {
  const names = info.columns.map((c) => c.name);
  return names.length > 12 ? `${names.slice(0, 12).join(', ')} …` : names.join(', ');
}

function optionValues(column: Column): string[] {
  return (column.options ?? [])
    .map((o) => (typeof o === 'string' ? o : isObject(o) && typeof o.value === 'string' ? o.value : null))
    .filter((v): v is string => v !== null);
}

const SELECT_TYPES = new Set(['select', 'multi_select', 'status']);
const DATE_TYPES = new Set(['date', 'datetime']);

/**
 * Rewrites a validated block's references to their canonical ids, in place:
 * database item id → `databases.id`, column name → column id, view name →
 * view id, a select filter value → the option's exact spelling. Anything that
 * cannot be resolved is left as written and reported in `warnings` — it would
 * render as "column removed" or match nothing, and the agent has no other way
 * to find out.
 */
function normalizeBlock(block: RawBlock, at: string, dbs: Map<string, DbInfo>, warnings: string[]) {
  const ref = sourceRef(block);
  if (!ref) return;
  const info = dbs.get(ref);
  if (!info) return; // reported as an error by the caller

  if (block.type === 'database_embed') {
    block.databaseId = info.id;
    if (typeof block.viewId === 'string') {
      const embeddable = info.views.filter((v) => v.type === 'table' || v.type === 'kanban');
      const view = embeddable.find((v) => v.id === block.viewId)
        ?? embeddable.find((v) => v.name.toLowerCase() === String(block.viewId).toLowerCase());
      if (view) block.viewId = view.id;
      else {
        warnings.push(`${at}: no table or kanban view "${block.viewId}" in "${info.name}" — views: ${embeddable.map((v) => v.name).join(', ') || 'none'}`);
      }
    }
    return;
  }

  const source = block.source as RawBlock;
  source.databaseId = info.id;

  const column = (field: string, value: unknown, expect?: 'number' | 'date'): Column | null => {
    if (typeof value !== 'string') return null;
    const col = info.columns.find((c) => c.id === value)
      ?? info.columns.find((c) => c.name?.toLowerCase() === value.toLowerCase());
    if (!col) {
      warnings.push(`${at} ${field}: no column "${value}" in "${info.name}" — columns: ${columnList(info)}`);
      return null;
    }
    if (expect === 'number' && col.type !== 'number') {
      warnings.push(`${at} ${field}: "${col.name}" is a ${col.type} column; only number values count`);
    }
    if (expect === 'date' && !DATE_TYPES.has(col.type)) {
      warnings.push(`${at} ${field}: "${col.name}" is a ${col.type} column, not a date`);
    }
    return col;
  };

  const filters = Array.isArray(source.filters) ? (source.filters as RawBlock[]) : [];
  filters.forEach((f, i) => {
    const col = column(`source.filters.${i}.columnId`, f.columnId);
    if (!col) return;
    f.columnId = col.id;
    const needsValue = f.operator !== 'is_empty' && f.operator !== 'is_not_empty';
    if (needsValue && (typeof f.value !== 'string' || f.value === '')) {
      warnings.push(`${at} source.filters.${i}: "${f.operator}" without a value matches no rows`);
      return;
    }
    // Select matching is exact; fix the case, report a value that is no option at all.
    if (needsValue && SELECT_TYPES.has(col.type) && (f.operator === 'equals' || f.operator === 'not_equals')) {
      const options = optionValues(col);
      if (!options.length) return;
      const raw = String(f.value);
      const isList = raw.startsWith('[') && raw.endsWith(']');
      let values: string[];
      try {
        values = isList ? (JSON.parse(raw) as unknown[]).map(String) : [raw];
      } catch {
        values = [raw];
      }
      const fixed = values.map((v) => options.find((o) => o === v) ?? options.find((o) => o.toLowerCase() === v.toLowerCase()) ?? null);
      const unknown = values.filter((_, k) => fixed[k] === null);
      if (unknown.length) {
        warnings.push(`${at} source.filters.${i}: ${unknown.map((u) => `"${u}"`).join(', ')} is not an option of "${col.name}" — options: ${options.slice(0, 12).join(', ')}`);
      } else {
        f.value = isList ? JSON.stringify(fixed) : (fixed[0] as string);
      }
    }
  });

  if (block.type === 'metric') {
    if (block.columnId !== undefined) {
      const col = column('columnId', block.columnId, block.aggregate && block.aggregate !== 'count' ? 'number' : undefined);
      if (col) block.columnId = col.id;
    }
    if (isObject(block.trend)) {
      const col = column('trend.columnId', block.trend.columnId, 'date');
      if (col) block.trend.columnId = col.id;
    }
  }

  if (block.type === 'chart') {
    const group = column('groupBy', block.groupBy);
    if (group) {
      block.groupBy = group.id;
      if (block.bucket && !DATE_TYPES.has(group.type)) {
        warnings.push(`${at} bucket: ignored — "${group.name}" is not a date column`);
      }
    }
    if (block.valueColumnId !== undefined) {
      const col = column('valueColumnId', block.valueColumnId, 'number');
      if (col) block.valueColumnId = col.id;
    }
  }

  if (block.type === 'list') {
    if (isObject(block.sort)) {
      const col = column('sort.columnId', block.sort.columnId);
      if (col) block.sort.columnId = col.id;
    }
    if (Array.isArray(block.showColumns)) {
      block.showColumns = block.showColumns.map((ref, i) => column(`showColumns.${i}`, ref)?.id ?? ref);
    }
  }
}

/** Link targets may be given as a database's `databases.id`; the block stores item ids. */
async function normalizeLinks(workspaceId: string, blocks: { block: RawBlock; at: string }[], warnings: string[]) {
  const linkBlocks = blocks.filter((b) => b.block.type === 'links' && Array.isArray(b.block.items));
  if (!linkBlocks.length) return;
  const refs = Array.from(new Set(linkBlocks.flatMap((b) => (b.block.items as RawBlock[]).map((i) => String(i.itemId)))));
  const rows = await db
    .select({ itemId: workspaceItems.id, databaseId: databases.id })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(and(
      eq(workspaceItems.workspaceId, workspaceId),
      or(inArray(workspaceItems.id, refs), inArray(databases.id, refs)),
    ));
  const toItemId = new Map<string, string>();
  for (const r of rows) {
    toItemId.set(r.itemId, r.itemId);
    if (r.databaseId) toItemId.set(r.databaseId, r.itemId);
  }
  for (const { block, at } of linkBlocks) {
    (block.items as RawBlock[]).forEach((item, i) => {
      const resolved = toItemId.get(String(item.itemId));
      if (resolved) item.itemId = resolved;
      else warnings.push(`${at} items.${i}: no item "${item.itemId}" in this workspace — the link will show as removed`);
    });
  }
}

/**
 * Validate, normalize and report on the blocks a write touches. Throws
 * `DashboardInputError` for anything that must not be stored; returns the
 * warnings for anything that may be stored but will not render as intended.
 */
async function prepareTouched(workspaceId: string, touched: Touched[]): Promise<{ warnings: string[]; warned: Set<string> }> {
  const errors = touched.flatMap(({ block, at }) => validateBlock(at, block));
  if (errors.length) refuse(errors);

  const refs = Array.from(new Set(touched.map(({ block }) => sourceRef(block)).filter((r): r is string => !!r)));
  const dbs = await loadDatabases(workspaceId, refs);
  // A source that does not exist in THIS workspace is refused outright — a
  // foreign database and a made-up id read the same, so nothing leaks. The one
  // exception is an update that leaves the source alone: retitling a tile whose
  // database a human deleted must not fail on a field the call never touched.
  const missing = touched
    .map(({ block, at, strictSource }) => ({ at: label(at, block), ref: sourceRef(block), strictSource }))
    .filter((m) => m.ref && !dbs.has(m.ref));
  const notFound = (m: { at: string; ref: string | null }) =>
    `${m.at}: database "${m.ref}" not found in this workspace — use a databaseId from the workspace map or list_workspace`;
  const refused = missing.filter((m) => m.strictSource);
  if (refused.length) refuse(refused.map(notFound));

  // Warnings name the block by id — the handle the agent patches it with —
  // where errors above name the call's own argument path.
  const warnings: string[] = [];
  const warned = new Set<string>();
  for (const { block, strictSource } of touched) {
    const before = warnings.length;
    const name = `block "${String(block.id)}"`;
    const ref = sourceRef(block);
    if (!strictSource && ref && !dbs.has(ref)) warnings.push(notFound({ at: name, ref }));
    normalizeBlock(block, name, dbs, warnings);
    if (warnings.length > before) warned.add(String(block.id));
  }
  const beforeLinks = warnings.length;
  await normalizeLinks(workspaceId, touched.map(({ block }) => ({ block, at: `block "${String(block.id)}"` })), warnings);
  if (warnings.length > beforeLinks) touched.filter(({ block }) => block.type === 'links').forEach(({ block }) => warned.add(String(block.id)));
  return { warnings, warned };
}

// ── Self-check after a write ─────────────────────────────────────────────────

/**
 * Resolve the dashboard exactly as the page will and report what renders
 * empty or broken. Emptiness is reported only for the blocks this call
 * touched (an unchanged tile showing zero is not news); a broken block is
 * reported wherever it is, since nothing else would ever tell the agent.
 */
async function renderWarnings(
  workspaceId: string,
  spec: { version: unknown; blocks: unknown[] },
  touchedIds: Set<string>,
  alreadyWarned: Set<string>,
): Promise<string[]> {
  const resolved = await resolveDashboard(workspaceId, spec);
  if (resolved.fatal) return [`the dashboard cannot be read: ${resolved.fatal}`];
  const out: string[] = [];
  const name = (id: string | null) => `block "${id ?? '?'}"`;
  resolved.blocks.forEach((entry: ResolvedBlock) => {
    if (entry.kind === 'invalid') {
      out.push(`${name(entry.id)} cannot be read and shows as broken: ${entry.error}`);
      return;
    }
    const id = entry.block.id;
    if (entry.kind === 'unavailable') {
      const why = { database_missing: 'its database is gone', view_missing: 'its view is gone', column_missing: 'a column it names does not exist' }[entry.reason];
      out.push(`${name(id)} shows as unavailable: ${why}`);
      return;
    }
    // One warning per block is enough: a typo'd column already explains the zero.
    if (!touchedIds.has(id) || alreadyWarned.has(id)) return;
    if (entry.kind === 'metric' && entry.block.aggregate !== 'count' && entry.value === null) {
      out.push(`${name(id)}: no numeric values to ${entry.block.aggregate} (${entry.matched} rows match) — it shows "—"`);
    } else if (entry.kind === 'metric' && entry.matched === 0) {
      out.push(`${name(id)}: matches no rows right now (shows 0)`);
    } else if (entry.kind === 'chart' && entry.total === 0) {
      out.push(`${name(id)}: nothing to chart — no rows match`);
    } else if (entry.kind === 'list' && entry.total === 0) {
      out.push(`${name(id)}: matches no rows right now`);
    } else if (entry.kind === 'database_embed' && entry.rows.length === 0) {
      out.push(`${name(id)}: the view shows no rows`);
    }
  });
  return out;
}

// ── Storage ──────────────────────────────────────────────────────────────────

type StoredDashboard = { itemId: string; raw: string | null; version: unknown; blocks: unknown[] };

async function loadStored(workspaceId: string, itemId: string): Promise<StoredDashboard> {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);
  if (!item || item.workspaceId !== workspaceId) throw new DashboardInputError(`Dashboard "${itemId}" not found in this workspace`);
  if (item.type !== 'dashboard') throw new DashboardInputError(`"${itemId}" is a ${item.type}, not a dashboard`);

  // The raw TEXT, not the json-mode value: it is what the compare-and-swap
  // below compares against.
  const [row] = await db
    .select({ raw: sql<string | null>`${dashboards.spec}` })
    .from(dashboards)
    .where(eq(dashboards.itemId, itemId))
    .limit(1);

  let doc: unknown = null;
  if (row?.raw) {
    try {
      doc = JSON.parse(row.raw);
    } catch {
      doc = null;
    }
  }
  const shell = isObject(doc) ? doc : {};
  return {
    itemId,
    raw: row?.raw ?? null,
    version: shell.version ?? DASHBOARD_SPEC_VERSION,
    blocks: Array.isArray(shell.blocks) ? shell.blocks : [],
  };
}

/** Write only if nobody else wrote since `expectedRaw` was read. */
async function compareAndSwap(
  itemId: string,
  expectedRaw: string | null,
  spec: { version: unknown; blocks: unknown[] },
  meta: DashboardMeta,
): Promise<boolean> {
  const now = new Date();
  const guard = expectedRaw === null ? sql`1 = 1` : sql`${dashboards.spec} = ${expectedRaw}`;
  const result = await db
    .update(dashboards)
    .set({ spec, updatedAt: now })
    .where(and(eq(dashboards.itemId, itemId), guard));
  if (result.rowsAffected === 0) {
    if (expectedRaw !== null) return false;
    // No detail row at all (only reachable by a hand-edited database): create it.
    await db.insert(dashboards).values({ id: crypto.randomUUID(), itemId, spec, createdAt: now, updatedAt: now });
  }
  await touchItem(itemId, meta, now);
  return true;
}

/**
 * Title/icon live on the workspace item, like a page's. Also the change
 * signal: live refresh keys off `workspace_items.updated_at`
 * (services/changeVersion.ts), so a spec edit must touch it too.
 */
async function touchItem(itemId: string, meta: DashboardMeta, now: Date) {
  await db
    .update(workspaceItems)
    .set({
      updatedAt: now,
      ...(meta.title !== undefined ? { title: meta.title || 'Untitled' } : {}),
      ...(meta.icon !== undefined ? { icon: meta.icon } : {}),
      ...(meta.iconColor !== undefined ? { iconColor: meta.iconColor } : {}),
    })
    .where(eq(workspaceItems.id, itemId));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createDashboardInWorkspace(
  workspaceId: string,
  input: { title: string; parentId?: string; icon?: string | null; iconColor?: string | null; blocks?: unknown[] },
): Promise<DashboardWriteResult> {
  if (input.parentId) {
    const [parent] = await db
      .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type })
      .from(workspaceItems)
      .where(eq(workspaceItems.id, input.parentId))
      .limit(1);
    if (!parent || parent.workspaceId !== workspaceId) throw new DashboardInputError(`parentId "${input.parentId}" not found in this workspace`);
    // Only pages hold children in the sidebar (`isInvalidDropTarget`).
    if (parent.type !== 'page') throw new DashboardInputError(`parentId "${input.parentId}" is a ${parent.type}; only a page can hold a dashboard`);
  }

  const incoming = input.blocks ?? [];
  if (incoming.length > MAX_DASHBOARD_BLOCKS) refuse([`blocks: at most ${MAX_DASHBOARD_BLOCKS} per dashboard`]);

  const blocks = incoming.map((b) => (isObject(b) ? structuredClone(b) : b)) as RawBlock[];
  assignMissingIds(blocks, new Set());
  const dupes = duplicateIds(blocks);
  if (dupes.length) refuse(dupes.map((id) => `blocks: id "${id}" is used twice`));

  const touched = blocks.map((block, i) => ({ block, at: `blocks[${i}]`, strictSource: true }));
  const { warnings, warned } = await prepareTouched(workspaceId, touched);
  const spec = { version: DASHBOARD_SPEC_VERSION, blocks };

  const itemId = crypto.randomUUID();
  const now = new Date();
  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'dashboard',
    title: input.title || 'Untitled',
    parentId: input.parentId ?? null,
    sortOrder: 0,
    icon: input.icon ?? null,
    iconColor: input.iconColor ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(dashboards).values({ id: crypto.randomUUID(), itemId, spec, createdAt: now, updatedAt: now });

  warnings.push(...await renderWarnings(workspaceId, spec, new Set(blocks.map((b) => String(b.id))), warned));
  return { id: itemId, blocks: blocks.map((b) => String(b.id)), ...(warnings.length ? { warnings } : {}) };
}

function assignMissingIds(blocks: unknown[], taken: Set<string>) {
  for (const b of blocks) {
    const id = blockIdOf(b);
    if (id) taken.add(id);
  }
  for (const b of blocks) {
    if (isObject(b) && b.id === undefined && typeof b.type === 'string') {
      b.id = generateBlockId(b.type, taken);
      taken.add(b.id as string);
      generatedIds.add(b);
    }
  }
}

function duplicateIds(blocks: unknown[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const b of blocks) {
    const id = blockIdOf(b);
    if (!id) continue;
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return Array.from(dupes);
}

/**
 * Apply a block-level patch. All-or-nothing: every op is checked in memory
 * against the current document first, and nothing is written unless the whole
 * patch is valid. Order of application: remove → update/replace → add → order.
 */
export async function patchDashboard(
  workspaceId: string,
  itemId: string,
  patch: DashboardPatch,
  meta: DashboardMeta = {},
): Promise<DashboardWriteResult> {
  const hasOps = !!(patch.add?.length || patch.update?.length || patch.replace?.length || patch.remove?.length || patch.order?.length);
  const hasMeta = meta.title !== undefined || meta.icon !== undefined || meta.iconColor !== undefined;
  if (!hasOps && !hasMeta) throw new DashboardInputError('Nothing to change — pass add, update, remove, order, title or icon');

  if (!hasOps) {
    const stored = await loadStored(workspaceId, itemId);
    await touchItem(itemId, meta, new Date());
    return { id: itemId, blocks: stored.blocks.map((b) => blockIdOf(b) ?? '?') };
  }

  for (let attempt = 0; ; attempt++) {
    const stored = await loadStored(workspaceId, itemId);
    const { blocks, touched } = applyPatch(stored.blocks, patch);
    const { warnings, warned } = await prepareTouched(workspaceId, touched);
    const spec = { version: stored.version, blocks };
    if (!await compareAndSwap(itemId, stored.raw, spec, meta)) {
      if (attempt < 3) continue;
      throw new Error('The dashboard kept changing while this edit was applied — read it again and retry');
    }
    const touchedIds = new Set(touched.map(({ block }) => String(block.id)));
    warnings.push(...await renderWarnings(workspaceId, spec, touchedIds, warned));
    return { id: itemId, blocks: blocks.map((b) => blockIdOf(b) ?? '?'), ...(warnings.length ? { warnings } : {}) };
  }
}

function applyPatch(current: unknown[], patch: DashboardPatch): { blocks: unknown[]; touched: Touched[] } {
  const errors: string[] = [];
  let blocks = [...current];
  const indexOf = (id: string) => blocks.findIndex((b) => blockIdOf(b) === id);
  const touched: Touched[] = [];

  for (const id of patch.remove ?? []) {
    const i = indexOf(id);
    if (i < 0) errors.push(`remove: no block "${id}"`);
    else blocks.splice(i, 1);
  }

  (patch.update ?? []).forEach((raw, n) => {
    const where = `update[${n}]`;
    if (!isObject(raw) || typeof raw.id !== 'string') {
      errors.push(`${where}: needs the "id" of the block to change`);
      return;
    }
    const i = indexOf(raw.id);
    if (i < 0) {
      errors.push(`${where}: no block "${raw.id}" — current ids: ${blocks.map(blockIdOf).filter(Boolean).join(', ') || 'none'}`);
      return;
    }
    const existing = isObject(blocks[i]) ? (blocks[i] as RawBlock) : {};
    if (raw.type !== undefined && existing.type !== undefined && raw.type !== existing.type) {
      errors.push(`${where}: type cannot change ("${existing.type}" → "${raw.type}") — remove the block and add a new one`);
      return;
    }
    const merged: RawBlock = structuredClone(existing);
    for (const [key, value] of Object.entries(raw)) {
      if (value === null) delete merged[key];
      else merged[key] = structuredClone(value);
    }
    blocks[i] = merged;
    touched.push({ block: merged, at: where, strictSource: 'source' in raw || 'databaseId' in raw });
  });

  (patch.replace ?? []).forEach((raw, n) => {
    const where = `replace[${n}]`;
    const id = blockIdOf(raw);
    const i = id ? indexOf(id) : -1;
    if (!id || i < 0) {
      errors.push(`${where}: no block "${id ?? ''}" to replace`);
      return;
    }
    const block = structuredClone(raw) as RawBlock;
    blocks[i] = block;
    touched.push({ block, at: where, strictSource: true });
  });

  const adds = (patch.add ?? []).map((b) => (isObject(b) ? structuredClone(b) : b));
  assignMissingIds(adds, new Set(blocks.map(blockIdOf).filter((id): id is string => !!id)));
  adds.forEach((raw, n) => {
    const id = blockIdOf(raw);
    if (id && indexOf(id) >= 0) {
      errors.push(`add[${n}]: id "${id}" is already used — use update to change that block`);
      return;
    }
    blocks.push(raw);
    if (isObject(raw)) touched.push({ block: raw, at: `add[${n}]`, strictSource: true });
    else errors.push(`add[${n}]: a block must be an object`);
  });
  const dupes = duplicateIds(adds);
  if (dupes.length) errors.push(...dupes.map((id) => `add: id "${id}" is used twice`));

  if (patch.order?.length) {
    const unknown = patch.order.filter((id) => indexOf(id) < 0);
    if (unknown.length) {
      errors.push(`order: no block ${unknown.map((u) => `"${u}"`).join(', ')}`);
    } else {
      const listed = new Set(patch.order);
      const rest = blocks.filter((b) => !listed.has(blockIdOf(b) ?? ''));
      blocks = [...patch.order.map((id) => blocks[indexOf(id)]), ...rest];
    }
  }

  if (blocks.length > MAX_DASHBOARD_BLOCKS) errors.push(`at most ${MAX_DASHBOARD_BLOCKS} blocks per dashboard (this edit leaves ${blocks.length})`);
  if (errors.length) refuse(errors);
  return { blocks, touched };
}
