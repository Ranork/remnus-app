/**
 * Copy a whole workspace into a new one — cookie-free (the action does the auth and the
 * cookie). The use case is a workspace set up once for a project and then reused as a
 * template, so the copy keeps the shape of the original: the sidebar tree, page bodies,
 * databases with their columns and views, dashboards.
 *
 * `includeData: false` leaves out exactly one thing: the database ROWS (and the repeating
 * series that generate them). Everything that describes how the workspace is organised
 * still comes along, which is what makes it a usable template.
 *
 * What is never copied, either way — it belongs to the old workspace, not to its content:
 * members, invites and access requests, agent tokens and OAuth grants, share links, comments,
 * the trash, version history, the agent audit log, and human review of knowledge. The person
 * who copies becomes the only owner.
 *
 * Every id is new, so the copy must be re-pointed at itself: parent ids, the home dashboard,
 * `databaseId`s inside dashboard blocks, and the links inside page bodies (`/page/<id>`,
 * `/db/<id>[/<row>]`, child blocks). `remapContentIds` / `remapDashboardSpec` do that, and
 * are exported so the regression script can check them without a database.
 *
 * Icons uploaded to Cloudinary are NOT carried over: the app deletes the old file whenever an
 * icon is replaced, so a copy sharing the URL would delete the original's icon the first time
 * someone changed its own. Those items fall back to the default icon.
 *
 * Not atomic across statements (a large workspace does not fit one request); the new
 * workspace is deleted again if anything fails, so a failed copy leaves nothing behind.
 */
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  dashboards,
  databases,
  knowledgeMetadata,
  pages,
  recurrenceSeries,
  standalonePages,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { isCloudinaryUrl } from '@/lib/cloudinary';
import { checkCanCreateWorkspace } from '@/lib/services/billing';
import { syncPageLinksBulk } from '@/lib/services/pageLinks';
import { chunkRows } from '@/lib/services/sqlChunk';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

export class DuplicateWorkspaceLimitError extends Error {
  readonly code = 'workspaceLimitReached';
}
export class DuplicateWorkspaceTooLargeError extends Error {
  readonly code = 'workspaceTooLarge';
}

/** Rows a single copy will move. Past this the copy is refused up front instead of timing out halfway. */
export const MAX_COPIED_ROWS = 20_000;
/** Soft cap on the text bound by one INSERT, so a workspace of long pages does not become one huge request. */
const MAX_CHUNK_BYTES = 750_000;

export interface IdMaps {
  /** workspace_items.id (pages, databases and dashboards in the sidebar). */
  items: Map<string, string>;
  /** databases.id */
  databases: Map<string, string>;
  /** pages.id — empty when the rows were not copied. */
  rows: Map<string, string>;
}

// ── Content remapping ─────────────────────────────────────────────────────────

const PAGE_LINK_TAG = /<a\b[^>]*\bdata-page-link\b[^>]*>/gi;
const CHILD_BLOCK_TAG = /<div\b[^>]*\bdata-cb-id\s*=\s*"[^"]*"[^>]*>/gi;
const PAGE_HREF = /^\/page\/([^/?#]+)(.*)$/;
const DB_HREF = /^\/db\/([^/?#]+)(?:\/([^/?#]+))?(.*)$/;

function readAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function writeAttr(tag: string, name: string, value: string): string {
  return tag.replace(new RegExp(`(\\b${name}\\s*=\\s*)"[^"]*"`, 'i'), (_m, head: string) => `${head}"${value}"`);
}

/**
 * Re-points the references inside one markdown body at the copies. A reference to something
 * that was not copied is left as written (it was already dangling, or points outside the
 * workspace); a link to a ROW that was not copied becomes a link to its database, since a
 * template copied without data should not carry links into thin air.
 */
export function remapContentIds(content: string, maps: IdMaps): string {
  if (!content) return content;

  let out = content.replace(PAGE_LINK_TAG, (tag) => {
    const href = readAttr(tag, 'href');
    if (!href) return tag;

    const page = href.match(PAGE_HREF);
    if (page) {
      const next = maps.items.get(page[1]);
      return next ? writeAttr(tag, 'href', `/page/${next}${page[2]}`) : tag;
    }

    const db = href.match(DB_HREF);
    if (db) {
      const newDb = maps.databases.get(db[1]);
      if (!newDb) return tag;
      if (!db[2]) return writeAttr(tag, 'href', `/db/${newDb}${db[3]}`);
      const newRow = maps.rows.get(db[2]);
      if (newRow) return writeAttr(tag, 'href', `/db/${newDb}/${newRow}${db[3]}`);
      // The row is not in the copy: fall back to the database it lived in.
      const relinked = writeAttr(tag, 'href', `/db/${newDb}${db[3]}`);
      return /\bdata-type\s*=/.test(relinked) ? writeAttr(relinked, 'data-type', 'database') : relinked;
    }
    return tag;
  });

  out = out.replace(CHILD_BLOCK_TAG, (tag) => {
    let next = tag;
    const itemId = readAttr(tag, 'data-cb-id');
    const newItem = itemId ? maps.items.get(itemId) : undefined;
    if (newItem) next = writeAttr(next, 'data-cb-id', newItem);
    const dbId = readAttr(tag, 'data-cb-dbid');
    const newDb = dbId ? maps.databases.get(dbId) : undefined;
    if (newDb) next = writeAttr(next, 'data-cb-dbid', newDb);
    return next;
  });

  return out;
}

/**
 * A dashboard block names its data by `databaseId`. Every string equal to a copied database's
 * id is swapped (ids are random UUIDs, so nothing else can collide); a block pointing at a
 * database outside the workspace keeps its value.
 */
export function remapDashboardSpec<T>(spec: T, databaseIds: Map<string, string>): T {
  if (typeof spec === 'string') return (databaseIds.get(spec) ?? spec) as unknown as T;
  if (Array.isArray(spec)) return spec.map((v) => remapDashboardSpec(v, databaseIds)) as unknown as T;
  if (spec && typeof spec === 'object') {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(spec as Record<string, unknown>)) next[k] = remapDashboardSpec(v, databaseIds);
    return next as T;
  }
  return spec;
}

/** An icon that is safe to give a second owner: Cloudinary-hosted ones are dropped (see the header). */
export function copiedIcon(icon: string | null, iconColor: string | null): { icon: string | null; iconColor: string | null } {
  if (isCloudinaryUrl(icon)) return { icon: null, iconColor: null };
  return { icon, iconColor };
}

// ── Chunked inserts ───────────────────────────────────────────────────────────

/** Insert batches under SQLite's bind limit and a soft byte cap (shared with the item copy). */
export function chunkBySize<T>(rows: T[], columnsPerRow: number, sizeOf: (row: T) => number): T[][] {
  const out: T[][] = [];
  for (const group of chunkRows(rows, columnsPerRow)) {
    let current: T[] = [];
    let bytes = 0;
    for (const row of group) {
      const size = sizeOf(row);
      if (current.length > 0 && bytes + size > MAX_CHUNK_BYTES) {
        out.push(current);
        current = [];
        bytes = 0;
      }
      current.push(row);
      bytes += size;
    }
    if (current.length > 0) out.push(current);
  }
  return out;
}

export const textSize = (...parts: Array<string | null | undefined>) => parts.reduce((n, p) => n + (p ? p.length : 0), 0);

// ── The copy ──────────────────────────────────────────────────────────────────

export async function duplicateWorkspaceData(input: {
  sourceWorkspaceId: string;
  /** The copier — becomes the new workspace's owner and billing owner. */
  userId: string;
  name: string;
  includeData: boolean;
  /** Platform admins are not bound by the plan's workspace cap (mirrors createWorkspace). */
  skipPlanLimit?: boolean;
}): Promise<string> {
  const { sourceWorkspaceId, userId, includeData } = input;

  if (!input.skipPlanLimit && (await checkCanCreateWorkspace(userId))) {
    throw new DuplicateWorkspaceLimitError('Workspace limit reached');
  }

  const [source] = await db.select().from(workspaces).where(eq(workspaces.id, sourceWorkspaceId)).limit(1);
  if (!source) throw new Error('Workspace not found');

  // Joins, not `IN (…ids)`: a workspace can hold thousands of rows and SQLite caps bound parameters.
  const [allItems, allBodies, allDashboards, allDatabases, rows, seriesRows, knowledgeRows] = await Promise.all([
    db.select().from(workspaceItems).where(eq(workspaceItems.workspaceId, sourceWorkspaceId)),
    db
      .select({ itemId: standalonePages.itemId, content: standalonePages.content })
      .from(standalonePages)
      .innerJoin(workspaceItems, eq(workspaceItems.id, standalonePages.itemId))
      .where(eq(workspaceItems.workspaceId, sourceWorkspaceId)),
    db
      .select({ itemId: dashboards.itemId, spec: dashboards.spec })
      .from(dashboards)
      .innerJoin(workspaceItems, eq(workspaceItems.id, dashboards.itemId))
      .where(eq(workspaceItems.workspaceId, sourceWorkspaceId)),
    db
      .select({ id: databases.id, name: databases.name, itemId: databases.itemId, schema: databases.schema, views: databases.views })
      .from(databases)
      .innerJoin(workspaceItems, eq(workspaceItems.id, databases.itemId))
      .where(eq(workspaceItems.workspaceId, sourceWorkspaceId)),
    includeData
      ? db
          .select({
            id: pages.id, databaseId: pages.databaseId, title: pages.title, content: pages.content, properties: pages.properties,
            sortOrder: pages.sortOrder, icon: pages.icon, iconColor: pages.iconColor, cardCollapsed: pages.cardCollapsed,
            seriesId: pages.seriesId, occurrenceDate: pages.occurrenceDate, seriesDetached: pages.seriesDetached,
          })
          .from(pages)
          .innerJoin(databases, eq(databases.id, pages.databaseId))
          .innerJoin(workspaceItems, eq(workspaceItems.id, databases.itemId))
          .where(eq(workspaceItems.workspaceId, sourceWorkspaceId))
      : Promise.resolve([]),
    includeData
      ? db
          .select({
            id: recurrenceSeries.id, databaseId: recurrenceSeries.databaseId, dateColId: recurrenceSeries.dateColId,
            rule: recurrenceSeries.rule, template: recurrenceSeries.template, materializedUntil: recurrenceSeries.materializedUntil,
            parentSeriesId: recurrenceSeries.parentSeriesId,
          })
          .from(recurrenceSeries)
          .innerJoin(databases, eq(databases.id, recurrenceSeries.databaseId))
          .innerJoin(workspaceItems, eq(workspaceItems.id, databases.itemId))
          .where(eq(workspaceItems.workspaceId, sourceWorkspaceId))
      : Promise.resolve([]),
    db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, sourceWorkspaceId)),
  ]);

  if (rows.length > MAX_COPIED_ROWS) {
    throw new DuplicateWorkspaceTooLargeError(`Workspace has ${rows.length} rows; the copy limit is ${MAX_COPIED_ROWS}`);
  }

  // A page can be nested under a database ROW (a row's sub-page). It travels with that row; in a
  // structure-only copy there is no row to hang it on, so it — and anything under it — is left
  // out rather than dropped on the workspace root where nobody put it.
  const itemIds = new Set(allItems.map((i) => i.id));
  const rowIds = new Set(rows.map((r) => r.id));
  const left = new Set<string>();
  for (const i of allItems) {
    if (i.parentId && !itemIds.has(i.parentId) && !rowIds.has(i.parentId)) left.add(i.id);
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const i of allItems) {
      if (!left.has(i.id) && i.parentId && left.has(i.parentId)) { left.add(i.id); grew = true; }
    }
  }
  const items = allItems.filter((i) => !left.has(i.id));
  const bodies = allBodies.filter((b) => !left.has(b.itemId));
  const dashboardRows = allDashboards.filter((d) => !left.has(d.itemId));
  const databaseRows = allDatabases.filter((d) => !d.itemId || !left.has(d.itemId));

  const maps: IdMaps = { items: new Map(), databases: new Map(), rows: new Map() };
  for (const item of items) maps.items.set(item.id, crypto.randomUUID());
  for (const d of databaseRows) maps.databases.set(d.id, crypto.randomUUID());
  for (const r of rows) maps.rows.set(r.id, crypto.randomUUID());
  const seriesMap = new Map(seriesRows.map((s) => [s.id, crypto.randomUUID()]));

  const newWorkspaceId = crypto.randomUUID();
  const now = new Date();
  const wsIcon = copiedIcon(source.icon, source.iconColor);

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      id: newWorkspaceId,
      name: input.name.trim() || source.name,
      icon: wsIcon.icon,
      iconColor: wsIcon.iconColor,
      billingOwnerId: userId,
      homeDashboardItemId: source.homeDashboardItemId ? maps.items.get(source.homeDashboardItemId) ?? null : null,
      createdAt: now,
      // Explicit, like every other insert: the column default writes TEXT, which the change signal ignores.
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({ workspaceId: newWorkspaceId, userId, role: 'owner', createdAt: now });
  });

  try {
    const newItems = items.map((item) => {
      const icon = copiedIcon(item.icon, item.iconColor);
      return {
        id: maps.items.get(item.id)!,
        workspaceId: newWorkspaceId,
        type: item.type,
        title: item.title,
        parentId: item.parentId ? maps.items.get(item.parentId) ?? maps.rows.get(item.parentId) ?? null : null,
        sortOrder: item.sortOrder,
        icon: icon.icon,
        iconColor: icon.iconColor,
        createdAt: now,
        updatedAt: now,
      };
    });
    for (const chunk of chunkBySize(newItems, 9, (r) => textSize(r.title, r.icon))) {
      await db.insert(workspaceItems).values(chunk);
    }

    const newBodies = bodies.map((b) => ({
      id: crypto.randomUUID(),
      itemId: maps.items.get(b.itemId)!,
      content: remapContentIds(b.content, maps),
      createdAt: now,
      updatedAt: now,
    }));
    for (const chunk of chunkBySize(newBodies, 5, (r) => textSize(r.content))) {
      await db.insert(standalonePages).values(chunk);
    }

    const newDashboards = dashboardRows.map((d) => ({
      id: crypto.randomUUID(),
      itemId: maps.items.get(d.itemId)!,
      spec: remapDashboardSpec(d.spec, maps.databases),
      createdAt: now,
      updatedAt: now,
    }));
    for (const chunk of chunkBySize(newDashboards, 5, (r) => JSON.stringify(r.spec).length)) {
      await db.insert(dashboards).values(chunk);
    }

    const newDatabases = databaseRows.map((d) => ({
      id: maps.databases.get(d.id)!,
      name: d.name,
      itemId: d.itemId ? maps.items.get(d.itemId) ?? null : null,
      schema: d.schema,
      views: d.views,
      createdAt: now,
      updatedAt: now,
    }));
    for (const chunk of chunkBySize(newDatabases, 7, (r) => JSON.stringify(r.schema).length + JSON.stringify(r.views ?? []).length)) {
      await db.insert(databases).values(chunk);
    }

    const newRows: Array<{ id: string; content: string }> = [];
    if (includeData) {
      const newSeries = seriesRows.map((s) => ({
        id: seriesMap.get(s.id)!,
        databaseId: maps.databases.get(s.databaseId)!,
        dateColId: s.dateColId,
        rule: s.rule,
        template: s.template,
        materializedUntil: s.materializedUntil,
        parentSeriesId: s.parentSeriesId ? seriesMap.get(s.parentSeriesId) ?? null : null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }));
      for (const chunk of chunkBySize(newSeries, 10, (r) => JSON.stringify(r.rule).length + JSON.stringify(r.template).length)) {
        await db.insert(recurrenceSeries).values(chunk);
      }

      const rowValues = rows.map((r) => {
        const icon = copiedIcon(r.icon, r.iconColor);
        return {
          id: maps.rows.get(r.id)!,
          databaseId: maps.databases.get(r.databaseId)!,
          title: r.title,
          content: remapContentIds(r.content, maps),
          properties: r.properties,
          sortOrder: r.sortOrder,
          icon: icon.icon,
          iconColor: icon.iconColor,
          cardCollapsed: r.cardCollapsed,
          // Agent attribution belongs to the old workspace's tokens; the new rows have none.
          agentEditedAt: null,
          agentTokenId: null,
          seriesId: r.seriesId ? seriesMap.get(r.seriesId) ?? null : null,
          occurrenceDate: r.occurrenceDate,
          seriesDetached: r.seriesDetached,
          createdAt: now,
          updatedAt: now,
        };
      });
      for (const chunk of chunkBySize(rowValues, 18, (r) => textSize(r.title, r.content) + JSON.stringify(r.properties).length)) {
        await db.insert(pages).values(chunk);
      }
      newRows.push(...rowValues);
    }

    // Knowledge labels (concept type, tags, sources, lifecycle) ride along with what they
    // describe; human review does not — a review vouches for one revision of one page.
    const newKnowledge = knowledgeRows.flatMap((k) => {
      const itemId = k.itemType === 'database_row' ? maps.rows.get(k.itemId) : maps.items.get(k.itemId);
      if (!itemId) return [];
      return [{
        id: crypto.randomUUID(),
        workspaceId: newWorkspaceId,
        itemId,
        itemType: k.itemType,
        conceptType: k.conceptType,
        description: k.description,
        tags: k.tags,
        sources: k.sources,
        status: k.status,
        staleAfter: k.staleAfter,
        ownerUserId: k.ownerUserId,
        generatedBy: k.generatedBy,
        generatedAt: k.generatedAt,
        externalVerified: k.externalVerified,
        externalFrontmatter: k.externalFrontmatter,
        createdAt: now,
        updatedAt: now,
      }];
    });
    for (const chunk of chunkBySize(newKnowledge, 17, (r) => textSize(r.description, r.externalFrontmatter) + JSON.stringify(r.sources).length)) {
      await db.insert(knowledgeMetadata).values(chunk);
    }

    // The link graph is derived from the (already remapped) bodies, like on any content write.
    // In groups: the bulk sync deletes by `from_id IN (…)`, which SQLite caps at its bind limit.
    const linkSources = [
      ...newBodies.map((b) => ({ fromId: b.itemId, fromType: 'page' as const, content: b.content })),
      ...newRows.map((r) => ({ fromId: r.id, fromType: 'database_row' as const, content: r.content })),
    ].filter((src) => src.content);
    for (let i = 0; i < linkSources.length; i += 300) {
      await syncPageLinksBulk(newWorkspaceId, linkSources.slice(i, i + 300));
    }
  } catch (err) {
    await deleteWorkspaceData(newWorkspaceId).catch(() => {});
    throw err;
  }

  return newWorkspaceId;
}
