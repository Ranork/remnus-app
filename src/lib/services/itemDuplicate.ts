/**
 * Duplicate one sidebar item — or one database row — inside its own workspace, cookie-free
 * (the action does the auth). The copy is the whole branch, not just what you clicked: a
 * page keeps its sub-pages, a database keeps the pages nested under its rows, a row keeps
 * the pages nested under it, and every one of those comes along with its body, columns,
 * views, dashboards and knowledge labels.
 *
 * `includeRows: false` is the "structure only" copy of a board: the database rows (and the
 * repeating series that generate them) stay behind, and so does anything nested under a
 * row, since there is no row left to hang it on.
 *
 * References inside the branch are re-pointed at the copies (child blocks, page links,
 * dashboard sources) with the same helpers the workspace copy uses; references that leave
 * the branch keep pointing where they did. Comments, version history, share links and
 * human review stay with the original — they vouch for, or talk about, that one page.
 *
 * Icons keep their URL: it is the same workspace, and replacing an icon only deletes the
 * uploaded file once nothing else shows it (`releaseIcon`).
 *
 * Not atomic across statements; whatever was inserted is removed again if a step fails.
 */
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  dashboards,
  databases,
  knowledgeMetadata,
  pages,
  recurrenceSeries,
  standalonePages,
  workspaceItems,
} from '@/db/schema';
import { syncPageLinksBulk } from '@/lib/services/pageLinks';
import { chunkRows } from '@/lib/services/sqlChunk';
import {
  chunkBySize,
  DuplicateWorkspaceTooLargeError,
  MAX_COPIED_ROWS,
  remapContentIds,
  remapDashboardSpec,
  textSize,
  type IdMaps,
} from '@/lib/services/workspaceDuplicate';

export type DuplicatedItem =
  | { type: 'page'; itemId: string }
  | { type: 'dashboard'; itemId: string }
  | { type: 'database'; itemId: string; dbId: string };

type ItemRow = typeof workspaceItems.$inferSelect;
type RowRow = typeof pages.$inferSelect;
type BranchMaps = IdMaps & { /** workspace_items.id of a database item → the copied database's id. */ databaseOfItem: Map<string, string> };

async function selectIn<T>(ids: string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunkRows(ids, 1)) out.push(...(await read(chunk)));
  return out;
}

export async function duplicateItemSubtree(input: { itemId: string; includeRows: boolean }): Promise<DuplicatedItem | null> {
  const [root] = await db.select().from(workspaceItems).where(eq(workspaceItems.id, input.itemId)).limit(1);
  if (!root) return null;
  const maps = await copyBranch({ workspaceId: root.workspaceId, rootItem: root, includeRows: input.includeRows });
  const rootCopy = maps.items.get(root.id)!;
  if (root.type === 'database') {
    const dbId = maps.databaseOfItem.get(root.id);
    return dbId ? { type: 'database', itemId: rootCopy, dbId } : null;
  }
  return { type: root.type === 'dashboard' ? 'dashboard' : 'page', itemId: rootCopy };
}

/**
 * Duplicate one database row with the pages nested under it, as a new row of the same
 * database at `sortOrder`. The copy is a card of its own: it does not join the original's
 * repeating series. Returns the new row's id.
 */
export async function duplicateRowSubtree(input: { workspaceId: string; row: RowRow; sortOrder: number }): Promise<{ rowId: string; nestedItems: number }> {
  const maps = await copyBranch({
    workspaceId: input.workspaceId,
    rootRow: { ...input.row, sortOrder: input.sortOrder },
    includeRows: true,
  });
  return { rowId: maps.rows.get(input.row.id)!, nestedItems: maps.items.size };
}

async function copyBranch(input: {
  workspaceId: string;
  rootItem?: ItemRow;
  rootRow?: RowRow;
  includeRows: boolean;
}): Promise<BranchMaps> {
  const { workspaceId, rootItem, rootRow, includeRows } = input;

  // ── Collect the branch ──────────────────────────────────────────────────────
  // Children hang off an item or off a database ROW, so the walk alternates: items → their
  // databases → those databases' rows → items under the items and rows found so far.
  const allItems = await db.select().from(workspaceItems).where(eq(workspaceItems.workspaceId, workspaceId));
  const childrenOf = new Map<string, ItemRow[]>();
  for (const item of allItems) {
    if (!item.parentId) continue;
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item);
    childrenOf.set(item.parentId, list);
  }

  const items: ItemRow[] = rootItem ? [rootItem] : [];
  const itemIds = new Set(items.map((i) => i.id));
  const databaseRows: Array<{ id: string; name: string; itemId: string | null; schema: unknown[]; views: unknown[] | null }> = [];
  let rowCount = 0;
  let frontier = [...items];
  let frontierRows = rootRow ? [rootRow.id] : [];
  while (frontier.length > 0 || frontierRows.length > 0) {
    const dbItems = frontier.filter((i) => i.type === 'database').map((i) => i.id);
    const found = await selectIn(dbItems, (chunk) =>
      db
        .select({ id: databases.id, name: databases.name, itemId: databases.itemId, schema: databases.schema, views: databases.views })
        .from(databases)
        .where(inArray(databases.itemId, chunk)),
    );
    databaseRows.push(...found);

    const parents = [...frontier.map((i) => i.id), ...frontierRows];
    if (includeRows && found.length > 0) {
      const rowsHere = await selectIn(found.map((d) => d.id), (chunk) =>
        db.select({ id: pages.id }).from(pages).where(inArray(pages.databaseId, chunk)),
      );
      rowCount += rowsHere.length;
      parents.push(...rowsHere.map((r) => r.id));
    }

    const next: ItemRow[] = [];
    for (const parentId of parents) {
      for (const child of childrenOf.get(parentId) ?? []) {
        if (itemIds.has(child.id)) continue;
        itemIds.add(child.id);
        items.push(child);
        next.push(child);
      }
    }
    frontier = next;
    frontierRows = [];
  }

  if (rowCount > MAX_COPIED_ROWS) {
    throw new DuplicateWorkspaceTooLargeError(`Branch has ${rowCount} rows; the copy limit is ${MAX_COPIED_ROWS}`);
  }

  const itemIdList = [...itemIds];
  const databaseIdList = databaseRows.map((d) => d.id);
  const [bodies, dashboardRows, branchRows, seriesRows, knowledgeRows] = await Promise.all([
    selectIn(itemIdList, (chunk) =>
      db.select({ itemId: standalonePages.itemId, content: standalonePages.content }).from(standalonePages).where(inArray(standalonePages.itemId, chunk)),
    ),
    selectIn(itemIdList, (chunk) =>
      db.select({ itemId: dashboards.itemId, spec: dashboards.spec }).from(dashboards).where(inArray(dashboards.itemId, chunk)),
    ),
    includeRows ? selectIn(databaseIdList, (chunk) => db.select().from(pages).where(inArray(pages.databaseId, chunk))) : Promise.resolve([]),
    includeRows
      ? selectIn(databaseIdList, (chunk) => db.select().from(recurrenceSeries).where(inArray(recurrenceSeries.databaseId, chunk)))
      : Promise.resolve([]),
    selectIn([...itemIdList, ...(rootRow ? [rootRow.id] : [])], (chunk) =>
      db.select().from(knowledgeMetadata).where(inArray(knowledgeMetadata.itemId, chunk)),
    ),
  ]);
  // Row labels are looked up separately: there can be far more rows than items.
  const rowKnowledge = includeRows
    ? await selectIn(branchRows.map((r) => r.id), (chunk) => db.select().from(knowledgeMetadata).where(inArray(knowledgeMetadata.itemId, chunk)))
    : [];

  // The duplicated row itself: placed by the caller, and outside any series.
  const rows: RowRow[] = rootRow ? [{ ...rootRow, seriesId: null, occurrenceDate: null, seriesDetached: false }, ...branchRows] : branchRows;

  const maps: IdMaps = { items: new Map(), databases: new Map(), rows: new Map() };
  for (const id of itemIdList) maps.items.set(id, crypto.randomUUID());
  for (const d of databaseRows) maps.databases.set(d.id, crypto.randomUUID());
  for (const r of rows) maps.rows.set(r.id, crypto.randomUUID());
  const seriesMap = new Map(seriesRows.map((s) => [s.id, crypto.randomUUID()]));
  const now = new Date();

  const inserted = { items: [] as string[], databases: [] as string[], rows: [] as string[], knowledge: [] as string[] };
  try {
    const newItems = items.map((item) => ({
      id: maps.items.get(item.id)!,
      workspaceId,
      type: item.type,
      title: item.title,
      // The copy sits right under the original; everything below it hangs off the copies.
      parentId: item.id === rootItem?.id ? rootItem.parentId : maps.items.get(item.parentId!) ?? maps.rows.get(item.parentId!) ?? null,
      sortOrder: item.id === rootItem?.id ? rootItem.sortOrder + 1 : item.sortOrder,
      icon: item.icon,
      iconColor: item.iconColor,
      createdAt: now,
      updatedAt: now,
    }));

    const newDatabases = databaseRows.map((d) => ({
      id: maps.databases.get(d.id)!,
      name: d.name,
      itemId: d.itemId ? maps.items.get(d.itemId) ?? null : null,
      schema: d.schema,
      views: d.views,
      createdAt: now,
      updatedAt: now,
    }));

    const newSeries = seriesRows.map((s) => ({
      id: seriesMap.get(s.id)!,
      databaseId: maps.databases.get(s.databaseId)!,
      dateColId: s.dateColId,
      rule: s.rule,
      template: s.template,
      materializedUntil: s.materializedUntil,
      parentSeriesId: s.parentSeriesId ? seriesMap.get(s.parentSeriesId) ?? null : null,
      createdBy: s.createdBy,
      createdAt: now,
      updatedAt: now,
    }));

    const newRows = rows.map((r) => ({
      id: maps.rows.get(r.id)!,
      // The root row stays in its own database, which is not part of the copy.
      databaseId: maps.databases.get(r.databaseId) ?? r.databaseId,
      title: r.title,
      content: remapContentIds(r.content, maps),
      properties: r.properties,
      sortOrder: r.sortOrder,
      icon: r.icon,
      iconColor: r.iconColor,
      cardCollapsed: r.cardCollapsed,
      // A copy is a new page: nobody's agent has edited it yet.
      agentEditedAt: null,
      agentTokenId: null,
      seriesId: r.seriesId ? seriesMap.get(r.seriesId) ?? null : null,
      occurrenceDate: r.occurrenceDate,
      seriesDetached: r.seriesDetached,
      createdAt: now,
      updatedAt: now,
    }));

    // Items first (a database names its item); `parent_id` is no foreign key, so a sub-page
    // may name a copied row before that row is written.
    for (const chunk of chunkBySize(newItems, 9, (r) => textSize(r.title, r.icon))) {
      await db.insert(workspaceItems).values(chunk);
      inserted.items.push(...chunk.map((r) => r.id));
    }
    for (const chunk of chunkBySize(newDatabases, 7, (r) => JSON.stringify(r.schema).length + JSON.stringify(r.views ?? []).length)) {
      await db.insert(databases).values(chunk);
      inserted.databases.push(...chunk.map((r) => r.id));
    }
    for (const chunk of chunkBySize(newSeries, 10, (r) => JSON.stringify(r.rule).length + JSON.stringify(r.template).length)) {
      await db.insert(recurrenceSeries).values(chunk);
    }
    const rootRowCopy = rootRow ? maps.rows.get(rootRow.id) : undefined;
    for (const chunk of chunkBySize(newRows, 18, (r) => textSize(r.title, r.content) + JSON.stringify(r.properties).length)) {
      await db.insert(pages).values(chunk);
      // Rows of a copied database go with it; only the root row needs its own cleanup.
      if (rootRowCopy && chunk.some((r) => r.id === rootRowCopy)) inserted.rows.push(rootRowCopy);
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
      // Blocks over a database in the branch show the copy; the rest keep their live source.
      spec: remapDashboardSpec(d.spec, maps.databases),
      createdAt: now,
      updatedAt: now,
    }));
    for (const chunk of chunkBySize(newDashboards, 5, (r) => JSON.stringify(r.spec).length)) {
      await db.insert(dashboards).values(chunk);
    }

    // Labels travel with what they describe; a human review vouches for the original only.
    const newKnowledge = [...knowledgeRows, ...rowKnowledge].flatMap((k) => {
      const copyId = k.itemType === 'database_row' ? maps.rows.get(k.itemId) : maps.items.get(k.itemId);
      if (!copyId || k.workspaceId !== workspaceId) return [];
      return [{
        id: crypto.randomUUID(),
        workspaceId,
        itemId: copyId,
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
      inserted.knowledge.push(...chunk.map((r) => r.id));
    }

    const linkSources = [
      ...newBodies.map((b) => ({ fromId: b.itemId, fromType: 'page' as const, content: b.content })),
      ...newRows.map((r) => ({ fromId: r.id, fromType: 'database_row' as const, content: r.content })),
    ].filter((src) => src.content);
    for (let i = 0; i < linkSources.length; i += 300) {
      await syncPageLinksBulk(workspaceId, linkSources.slice(i, i + 300));
    }
  } catch (err) {
    await removePartialCopy(inserted).catch(() => {});
    throw err;
  }

  const databaseOfItem = new Map<string, string>();
  for (const d of databaseRows) if (d.itemId) databaseOfItem.set(d.itemId, maps.databases.get(d.id)!);
  return { ...maps, databaseOfItem };
}

/** A failed copy must not leave half a branch in the sidebar. */
async function removePartialCopy(inserted: { items: string[]; databases: string[]; rows: string[]; knowledge: string[] }) {
  for (const chunk of chunkRows(inserted.knowledge, 1)) await db.delete(knowledgeMetadata).where(inArray(knowledgeMetadata.id, chunk));
  for (const chunk of chunkRows(inserted.rows, 1)) await db.delete(pages).where(inArray(pages.id, chunk));
  // Rows and series cascade with their database.
  for (const chunk of chunkRows(inserted.databases, 1)) await db.delete(databases).where(inArray(databases.id, chunk));
  for (const chunk of chunkRows(inserted.items, 1)) {
    await db.delete(standalonePages).where(inArray(standalonePages.itemId, chunk));
    await db.delete(dashboards).where(inArray(dashboards.itemId, chunk));
    await db.delete(workspaceItems).where(inArray(workspaceItems.id, chunk));
  }
}
