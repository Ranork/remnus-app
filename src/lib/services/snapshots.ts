/**
 * Trash — full-content snapshots captured immediately before every delete
 * (single or bulk, web UI or MCP), so a human can restore what was removed.
 * See migration 0047 and `.ai/FEATURE_BULK_AND_TRASH.md`.
 *
 * `reason` future-proofs the table for content-versioning ('update' rows, a
 * separate later feature) — only 'delete' is written here. Restore is
 * per-item, not per-subtree: deleting a folder or a whole database writes one
 * snapshot per node (mirroring how `recordDeletionTombstone` already fires
 * once per node), and each restores independently.
 */
import crypto from 'crypto';
import { db } from '@/db';
import { pageSnapshots, workspaceItems, standalonePages, databases, pages } from '@/db/schema';
import { eq, and, lt, desc, inArray } from 'drizzle-orm';

const RETENTION_DAYS = 30;

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
export async function purgeExpiredSnapshots(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(pageSnapshots)
    .where(lt(pageSnapshots.createdAt, cutoff))
    .returning({ id: pageSnapshots.id });
  return deleted.length;
}
