/**
 * Trash + content versions — both are `page_snapshots` rows, split by
 * `reason`. 'delete' rows (`snapshotBeforeDelete`) capture full content
 * immediately before every delete (single or bulk, web UI or MCP) so a human
 * can restore what was removed — restore is per-item, not per-subtree:
 * deleting a folder or a whole database writes one snapshot per node
 * (mirroring how `recordDeletionTombstone` already fires once per node), and
 * each restores independently. 'update' rows (`maybeSnapshotContentUpdate`)
 * capture a page's prior content when an edit changes it enough to be worth
 * keeping — see AGENTS.md → Trash & Version History for the full algorithm.
 * See migration 0047 and `.ai/FEATURE_BULK_AND_TRASH.md`.
 */
import crypto from 'crypto';
import { db } from '@/db';
import { pageSnapshots, workspaceItems, standalonePages, databases, pages } from '@/db/schema';
import { eq, and, lt, desc, asc, inArray, sql } from 'drizzle-orm';
import { syncPageLinks } from './pageLinks';

const RETENTION_DAYS = 30;
const MAX_VERSIONS_PER_PAGE = 20;
const VERSION_GAP_MS = 10 * 60 * 1000;
const VERSION_SIZE_THRESHOLD = 0.3;
// Spec explicitly leaves this number to be decided and documented — see
// AGENTS.md → Trash & Version History.
const WORKSPACE_SNAPSHOT_BYTE_CAP = 25 * 1024 * 1024;
const MAX_WORKSPACES_PER_CAP_RUN = 200;

export type SnapshotActor =
  | { kind: 'human'; userId: string; label: string }
  | { kind: 'agent'; label: string; tokenId?: string | null; oauthTokenId?: string | null };

type SnapshotInput = {
  workspaceId: string;
  originalId: string;
  itemType: 'page' | 'database' | 'database_row';
  title: string;
  content?: string | null;
  properties?: Record<string, any> | null;
  schema?: any[] | null;
  icon?: string | null;
  iconColor?: string | null;
  parentId?: string | null;
  /** database_row: the row's parent database id. database: the database's OWN
   *  `databases.id` (distinct from `originalId`, which is its workspace item
   *  id) — needed so a restore can recreate it under the same id and let its
   *  row snapshots reattach correctly. */
  databaseId?: string | null;
  sortOrder?: number | null;
  deletedBy: SnapshotActor;
};

// Best-effort, same reasoning as `recordDeletionTombstone` in
// services/workspace.ts: a trash-recording side effect must never block the
// delete it's recording.
export async function snapshotBeforeDelete(input: SnapshotInput): Promise<void> {
  try {
    const content = input.content ?? null;
    const contentHash = crypto.createHash('sha256').update(content ?? '').digest('hex');
    await db.insert(pageSnapshots).values({
      workspaceId: input.workspaceId,
      reason: 'delete',
      originalId: input.originalId,
      itemType: input.itemType,
      title: input.title,
      content,
      properties: input.properties ?? null,
      schema: input.schema ?? null,
      icon: input.icon ?? null,
      iconColor: input.iconColor ?? null,
      parentId: input.parentId ?? null,
      databaseId: input.databaseId ?? null,
      sortOrder: input.sortOrder ?? null,
      contentHash,
      deletedByKind: input.deletedBy.kind,
      deletedByLabel: input.deletedBy.label,
      deletedByUserId: input.deletedBy.kind === 'human' ? input.deletedBy.userId : null,
      tokenId: input.deletedBy.kind === 'agent' ? input.deletedBy.tokenId ?? null : null,
      oauthTokenId: input.deletedBy.kind === 'agent' ? input.deletedBy.oauthTokenId ?? null : null,
      createdAt: new Date(),
    });
  } catch {
    // Swallow — see doc comment above.
  }
}

type ContentUpdateInput = {
  workspaceId: string;
  /** The page's own id — unlike a delete snapshot, this item is NOT going
   *  away, so it isn't a "deleted item id", just the page being edited. */
  originalId: string;
  itemType: 'page' | 'database_row';
  /** Page title at the moment of the snapshot — cosmetic only (the history
   *  list is already scoped to one page; not used to disambiguate). */
  title: string;
  /** Content about to be overwritten by this write — the caller must read
   *  it BEFORE issuing the UPDATE, same discipline as delete snapshots. */
  priorContent: string;
  /** The content this write is about to save. Compared against
   *  `priorContent` to skip no-op autosave ticks, and against the last
   *  snapshot's content to evaluate the size threshold. */
  newContent: string;
  changedBy: SnapshotActor;
  /** true = human web-editor autosave (session+size gate applies).
   *  false = agent/MCP write or a deliberate restore action (always
   *  snapshots once content actually changed — these are discrete
   *  deliberate actions, not a keystroke stream). */
  debounced: boolean;
};

// Content-version snapshots (`reason: 'update'`) — see AGENTS.md → Trash &
// Version History for the full algorithm write-up. Reuses the `deletedBy*`
// columns for "who made the edit being superseded" — the names read oddly
// for an update row, but a migration just to rename them isn't worth it.
// Best-effort, same reasoning as `snapshotBeforeDelete`: a versioning
// failure must never block the actual content save.
export async function maybeSnapshotContentUpdate(input: ContentUpdateInput): Promise<void> {
  try {
    if (input.newContent === input.priorContent) return; // autosave tick with no real change

    const [lastSnap] = await db
      .select({ id: pageSnapshots.id, createdAt: pageSnapshots.createdAt, content: pageSnapshots.content })
      .from(pageSnapshots)
      .where(and(
        eq(pageSnapshots.workspaceId, input.workspaceId),
        eq(pageSnapshots.originalId, input.originalId),
        eq(pageSnapshots.reason, 'update'),
      ))
      .orderBy(desc(pageSnapshots.createdAt))
      .limit(1);

    if (input.debounced && lastSnap) {
      const gapMs = Date.now() - lastSnap.createdAt.getTime();
      const lastLen = (lastSnap.content ?? '').length;
      const sizeChangeRatio = lastLen > 0 ? Math.abs(input.newContent.length - lastLen) / lastLen : 1;
      if (gapMs <= VERSION_GAP_MS && sizeChangeRatio <= VERSION_SIZE_THRESHOLD) return; // still the same "session"
    }
    // Not debounced (agent/MCP/restore), or debounced with no prior snapshot
    // (first tracked edit — establish a baseline), or the gap/size gate
    // tripped: snapshot the content about to be lost.

    const contentHash = crypto.createHash('sha256').update(input.priorContent).digest('hex');
    await db.insert(pageSnapshots).values({
      workspaceId: input.workspaceId,
      reason: 'update',
      originalId: input.originalId,
      itemType: input.itemType,
      title: input.title,
      content: input.priorContent,
      contentHash,
      deletedByKind: input.changedBy.kind,
      deletedByLabel: input.changedBy.label,
      deletedByUserId: input.changedBy.kind === 'human' ? input.changedBy.userId : null,
      tokenId: input.changedBy.kind === 'agent' ? input.changedBy.tokenId ?? null : null,
      oauthTokenId: input.changedBy.kind === 'agent' ? input.changedBy.oauthTokenId ?? null : null,
      createdAt: new Date(),
    });

    // Per-page cap — enforced at write time since a page can accumulate
    // versions indefinitely over months (unlike a delete snapshot, which is
    // naturally one-shot per item).
    const existing = await db
      .select({ id: pageSnapshots.id })
      .from(pageSnapshots)
      .where(and(
        eq(pageSnapshots.workspaceId, input.workspaceId),
        eq(pageSnapshots.originalId, input.originalId),
        eq(pageSnapshots.reason, 'update'),
      ))
      .orderBy(desc(pageSnapshots.createdAt));
    if (existing.length > MAX_VERSIONS_PER_PAGE) {
      const staleIds = existing.slice(MAX_VERSIONS_PER_PAGE).map((r) => r.id);
      await db.delete(pageSnapshots).where(inArray(pageSnapshots.id, staleIds));
    }
  } catch {
    // Swallow — see doc comment above.
  }
}

export type TrashEntry = {
  id: string;
  workspaceId: string;
  itemType: 'page' | 'database' | 'database_row';
  title: string;
  /** Ancestor titles, root-to-immediate-parent order, workspace name and the
   *  item's own title excluded (the workspace is shown as a section header,
   *  the title as the row's own label) — e.g. ['Sprint Board', 'Backlog']
   *  for a row that lived in a 'Backlog' view of a 'Sprint Board' database. */
  breadcrumb: string[];
  deletedByKind: 'human' | 'agent';
  deletedByLabel: string;
  createdAt: Date;
};

const MAX_BREADCRUMB_DEPTH = 8;

// Cross-workspace trash listing (powers the sidebar Trash modal, mirroring
// AgentsModal's cross-workspace `getUserWorkspacesWithTokens`). Reconstructs
// each entry's location by walking its ancestor chain — an ancestor may
// itself have been deleted, so the walk checks the CURRENT `workspace_items`
// first, then falls back to another snapshot in the same batch. Three
// prefetched queries total regardless of trash size; no per-entry round trip.
export async function listTrashForWorkspaces(workspaceIds: string[]): Promise<TrashEntry[]> {
  if (workspaceIds.length === 0) return [];

  const snaps = await db
    .select()
    .from(pageSnapshots)
    .where(and(inArray(pageSnapshots.workspaceId, workspaceIds), eq(pageSnapshots.reason, 'delete')))
    .orderBy(desc(pageSnapshots.createdAt));
  if (snaps.length === 0) return [];

  const items = await db
    .select({ id: workspaceItems.id, title: workspaceItems.title, parentId: workspaceItems.parentId, workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(inArray(workspaceItems.workspaceId, workspaceIds));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const dbRows = await db
    .select({ id: databases.id, itemId: databases.itemId })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(inArray(workspaceItems.workspaceId, workspaceIds));
  const dbById = new Map(dbRows.map((d) => [d.id, d]));

  // Keyed by workspaceId:originalId (or :databaseId for the database lookup)
  // since ids from different workspaces could theoretically collide in the
  // wrong map otherwise.
  const snapByOriginalId = new Map(
    snaps.filter((s) => s.itemType !== 'database_row').map((s) => [`${s.workspaceId}:${s.originalId}`, s]),
  );
  const dbSnapByDatabaseId = new Map(
    snaps.filter((s) => s.itemType === 'database' && s.databaseId).map((s) => [`${s.workspaceId}:${s.databaseId}`, s]),
  );

  function walkAncestors(workspaceId: string, startParentId: string | null): string[] {
    const crumbs: string[] = [];
    let cursor = startParentId;
    let depth = 0;
    while (cursor && depth < MAX_BREADCRUMB_DEPTH) {
      depth++;
      const item = itemById.get(cursor);
      if (item && item.workspaceId === workspaceId) {
        crumbs.push(item.title);
        cursor = item.parentId;
        continue;
      }
      const ancestorSnap = snapByOriginalId.get(`${workspaceId}:${cursor}`);
      if (ancestorSnap) {
        crumbs.push(ancestorSnap.title);
        cursor = ancestorSnap.parentId;
        continue;
      }
      break; // unknown ancestor — stop rather than guess
    }
    return crumbs.reverse();
  }

  return snaps.map((s) => {
    let breadcrumb: string[];
    if (s.itemType === 'database_row' && s.databaseId) {
      const liveDb = dbById.get(s.databaseId);
      if (liveDb) {
        const dbItem = liveDb.itemId ? itemById.get(liveDb.itemId) : undefined;
        const ancestry = walkAncestors(s.workspaceId, dbItem?.parentId ?? null);
        breadcrumb = dbItem ? [...ancestry, dbItem.title] : ancestry;
      } else {
        const dbSnap = dbSnapByDatabaseId.get(`${s.workspaceId}:${s.databaseId}`);
        breadcrumb = dbSnap ? [...walkAncestors(s.workspaceId, dbSnap.parentId), dbSnap.title] : [];
      }
    } else {
      breadcrumb = walkAncestors(s.workspaceId, s.parentId);
    }
    return {
      id: s.id,
      workspaceId: s.workspaceId,
      itemType: s.itemType,
      title: s.title,
      breadcrumb,
      deletedByKind: s.deletedByKind,
      deletedByLabel: s.deletedByLabel,
      createdAt: s.createdAt,
    };
  });
}

export type RestoreResult =
  | { restored: true; id: string; itemType: 'page' | 'database' | 'database_row'; databaseId?: string; rerootedToRoot?: boolean }
  | { restored: false; reason: string };

// Each snapshot restores on its own — restoring a database brings back the
// empty shell (schema included); its rows restore separately and reattach
// correctly because the database exists again by the time they're restored.
export async function restoreSnapshot(workspaceId: string, snapshotId: string): Promise<RestoreResult> {
  const [snap] = await db
    .select()
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.id, snapshotId), eq(pageSnapshots.workspaceId, workspaceId)))
    .limit(1);
  if (!snap) return { restored: false, reason: 'Snapshot not found' };

  const now = new Date();

  if (snap.itemType === 'page' || snap.itemType === 'database') {
    let parentId = snap.parentId;
    let rerooted = false;
    if (parentId) {
      const [parent] = await db
        .select({ id: workspaceItems.id })
        .from(workspaceItems)
        .where(and(eq(workspaceItems.id, parentId), eq(workspaceItems.workspaceId, workspaceId)))
        .limit(1);
      if (!parent) {
        parentId = null;
        rerooted = true;
      }
    }

    if (snap.itemType === 'database' && !snap.databaseId) {
      return { restored: false, reason: 'Snapshot is missing its database id' };
    }

    await db.insert(workspaceItems).values({
      id: snap.originalId,
      workspaceId,
      type: snap.itemType,
      title: snap.title,
      parentId,
      sortOrder: snap.sortOrder ?? 0,
      icon: snap.icon,
      iconColor: snap.iconColor,
      createdAt: now,
      updatedAt: now,
    });

    if (snap.itemType === 'page') {
      await db.insert(standalonePages).values({
        id: crypto.randomUUID(),
        itemId: snap.originalId,
        content: snap.content ?? '',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db.insert(databases).values({
        id: snap.databaseId!,
        name: snap.title,
        itemId: snap.originalId,
        schema: (snap.schema as any[]) ?? [],
        views: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.delete(pageSnapshots).where(eq(pageSnapshots.id, snapshotId));
    return { restored: true, id: snap.originalId, itemType: snap.itemType, rerootedToRoot: rerooted };
  }

  // database_row — no "root" to fall back to; the target database must exist.
  if (!snap.databaseId) return { restored: false, reason: 'Snapshot is missing its database id' };
  const [targetDb] = await db
    .select({ id: databases.id })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(and(eq(databases.id, snap.databaseId), eq(workspaceItems.workspaceId, workspaceId)))
    .limit(1);
  if (!targetDb) {
    return { restored: false, reason: 'The database this row belonged to no longer exists' };
  }

  await db.insert(pages).values({
    id: snap.originalId,
    databaseId: snap.databaseId,
    title: snap.title,
    content: snap.content ?? '',
    properties: (snap.properties as Record<string, any>) ?? {},
    sortOrder: snap.sortOrder ?? 0,
    icon: snap.icon,
    iconColor: snap.iconColor,
    createdAt: now,
    updatedAt: now,
  });

  await db.delete(pageSnapshots).where(eq(pageSnapshots.id, snapshotId));
  return { restored: true, id: snap.originalId, itemType: 'database_row', databaseId: snap.databaseId };
}

// Called from the daily recurrence cron (see AGENTS.md's "don't add a new
// scheduler" instruction — this reuses the existing daily maintenance job).
// No `reason` filter — ages out both trash ('delete') and version ('update')
// rows alike.
export async function purgeExpiredSnapshots(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(pageSnapshots)
    .where(lt(pageSnapshots.createdAt, cutoff))
    .returning({ id: pageSnapshots.id });
  return deleted.length;
}

// Workspace-level total byte cap across ALL snapshots (any reason) — the
// per-page 20-version cap bounds one page, but a workspace with hundreds of
// actively-edited pages has no other ceiling. Called from the same daily
// cron as `purgeExpiredSnapshots`. Bounded per run (mirrors the recurrence
// cron's own MAX_SERIES_PER_RUN guard) as a safety net; not expected to bite
// at current scale.
export async function enforceWorkspaceSnapshotByteCaps(): Promise<number> {
  const totals = await db
    .select({
      workspaceId: pageSnapshots.workspaceId,
      bytes: sql<number>`coalesce(sum(length(coalesce(${pageSnapshots.content}, '')) + length(coalesce(${pageSnapshots.properties}, '')) + length(coalesce(${pageSnapshots.schema}, ''))), 0)`,
    })
    .from(pageSnapshots)
    .groupBy(pageSnapshots.workspaceId)
    .having(sql`coalesce(sum(length(coalesce(${pageSnapshots.content}, '')) + length(coalesce(${pageSnapshots.properties}, '')) + length(coalesce(${pageSnapshots.schema}, ''))), 0) > ${WORKSPACE_SNAPSHOT_BYTE_CAP}`)
    .limit(MAX_WORKSPACES_PER_CAP_RUN);

  let totalDeleted = 0;
  for (const { workspaceId, bytes } of totals) {
    let over = bytes - WORKSPACE_SNAPSHOT_BYTE_CAP;
    const rows = await db
      .select({ id: pageSnapshots.id, content: pageSnapshots.content, properties: pageSnapshots.properties, schema: pageSnapshots.schema })
      .from(pageSnapshots)
      .where(eq(pageSnapshots.workspaceId, workspaceId))
      .orderBy(asc(pageSnapshots.createdAt));

    const staleIds: string[] = [];
    for (const row of rows) {
      if (over <= 0) break;
      const size = (row.content?.length ?? 0) + JSON.stringify(row.properties ?? '').length + JSON.stringify(row.schema ?? '').length;
      staleIds.push(row.id);
      over -= size;
    }
    if (staleIds.length > 0) {
      await db.delete(pageSnapshots).where(inArray(pageSnapshots.id, staleIds));
      totalDeleted += staleIds.length;
    }
  }
  return totalDeleted;
}

export type ContentVersion = {
  id: string;
  content: string;
  changedByKind: 'human' | 'agent';
  changedByLabel: string;
  createdAt: Date;
};

// Up to MAX_VERSIONS_PER_PAGE entries (the cap is enforced at write time, so
// no separate limit needed here), newest first. Full `content` included —
// needed for preview + the UI's character-delta indicator, and the capped
// count keeps the payload trivial for an on-demand modal.
export async function listContentVersions(workspaceId: string, pageId: string): Promise<ContentVersion[]> {
  const rows = await db
    .select({
      id: pageSnapshots.id,
      content: pageSnapshots.content,
      changedByKind: pageSnapshots.deletedByKind,
      changedByLabel: pageSnapshots.deletedByLabel,
      createdAt: pageSnapshots.createdAt,
    })
    .from(pageSnapshots)
    .where(and(
      eq(pageSnapshots.workspaceId, workspaceId),
      eq(pageSnapshots.originalId, pageId),
      eq(pageSnapshots.reason, 'update'),
    ))
    .orderBy(desc(pageSnapshots.createdAt));
  return rows.map((r) => ({ ...r, content: r.content ?? '' }));
}

export type RestoreVersionResult = { restored: true } | { restored: false; reason: string };

// Reverting is itself a recorded, undo-able version (spec: "geri dönmek de
// bir sürüm üretir") — the CURRENT content is snapshotted (non-debounced,
// this is a deliberate one-off action, not a keystroke stream) before being
// overwritten by the target version's content. No MCP tool exists for this —
// human-only, same reasoning as trash restore: an agent reverting a human's
// edit would defeat the point of the edit.
export async function restoreContentVersion(
  workspaceId: string,
  pageId: string,
  snapshotId: string,
  actor: SnapshotActor,
): Promise<RestoreVersionResult> {
  const [snap] = await db
    .select({ id: pageSnapshots.id, content: pageSnapshots.content })
    .from(pageSnapshots)
    .where(and(
      eq(pageSnapshots.id, snapshotId),
      eq(pageSnapshots.workspaceId, workspaceId),
      eq(pageSnapshots.originalId, pageId),
      eq(pageSnapshots.reason, 'update'),
    ))
    .limit(1);
  if (!snap) return { restored: false, reason: 'Version not found' };
  const restoredContent = snap.content ?? '';

  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, title: workspaceItems.title })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, pageId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) return { restored: false, reason: 'Access denied' };
    const [current] = await db.select({ content: standalonePages.content }).from(standalonePages).where(eq(standalonePages.itemId, pageId)).limit(1);
    const priorContent = current?.content ?? '';
    await maybeSnapshotContentUpdate({
      workspaceId, originalId: pageId, itemType: 'page', title: item.title,
      priorContent, newContent: restoredContent, changedBy: actor, debounced: false,
    });
    await db.update(standalonePages).set({ content: restoredContent, updatedAt: new Date() }).where(eq(standalonePages.itemId, pageId));
    await syncPageLinks(workspaceId, pageId, 'page', restoredContent);
    return { restored: true };
  }

  const [row] = await db
    .select({ databaseId: pages.databaseId, title: pages.title, content: pages.content })
    .from(pages)
    .innerJoin(databases, eq(pages.databaseId, databases.id))
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(and(eq(pages.id, pageId), eq(workspaceItems.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return { restored: false, reason: 'Page not found' };

  await maybeSnapshotContentUpdate({
    workspaceId, originalId: pageId, itemType: 'database_row', title: row.title,
    priorContent: row.content ?? '', newContent: restoredContent, changedBy: actor, debounced: false,
  });
  await db.update(pages).set({ content: restoredContent, updatedAt: new Date() }).where(eq(pages.id, pageId));
  await syncPageLinks(workspaceId, pageId, 'database_row', restoredContent);
  return { restored: true };
}
