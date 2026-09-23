'use server';
import { db } from '@/db';
import { dashboards, databases, workspaceItems, workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import { DASHBOARD_SPEC_VERSION, EMPTY_DASHBOARD_SPEC, validateDashboardSpec } from '@/lib/dashboard/schema';
import { resolveDashboard, type ResolvedDashboard } from '@/lib/dashboard/data';
import { DashboardInputError, patchDashboard, type DashboardPatch } from '@/lib/services/dashboards';

/**
 * Session-aware actions for dashboard items. The cookie-free half (spec
 * resolution) lives in `src/lib/dashboard/data.ts`; this file only adds auth,
 * validation and cache invalidation on top of it.
 *
 * A dashboard is workspace CONTENT, so these use
 * `getCurrentUserAllowingWorkspaceLock()` + `assertWorkspaceLockAllows()` —
 * without that opt-in every one of them would throw inside a project window
 * (AGENTS.md -> Project Install §4).
 */

async function assertWorkspaceAccess(workspaceId: string): Promise<string> {
  const user = await getCurrentUserAllowingWorkspaceLock();
  // Project windows are confined to their workspace — checked before any admin shortcut.
  await assertWorkspaceLockAllows(user, workspaceId);
  if (user.role === 'admin') return user.id;

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
  return user.id;
}

export type DashboardItem = {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  iconColor: string | null;
  parentId: string | null;
  updatedAt: Date;
};

export async function createDashboard(
  workspaceId: string,
  title: string,
  parentId?: string,
  options?: { spec?: unknown; icon?: string | null; iconColor?: string | null },
) {
  await assertWorkspaceAccess(workspaceId);

  const validated = options?.spec === undefined ? { ok: true as const, spec: EMPTY_DASHBOARD_SPEC } : validateDashboardSpec(options.spec);
  if (!validated.ok) throw new Error(`Invalid dashboard spec: ${validated.error}`);

  const itemId = crypto.randomUUID();
  const dashboardId = crypto.randomUUID();
  const now = new Date();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'dashboard',
    title: title || 'Untitled',
    parentId: parentId ?? null,
    sortOrder: 0,
    icon: options?.icon ?? null,
    iconColor: options?.iconColor ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(dashboards).values({
    id: dashboardId,
    itemId,
    spec: validated.spec,
    createdAt: now,
    updatedAt: now,
  });

  // Structural sidebar mutation — the one case where a full layout revalidate
  // is correct (AGENTS.md -> Critical conventions).
  revalidatePath('/', 'layout');
  return { itemId, dashboardId };
}

/** Item + resolved blocks, ready to render. Null when the item isn't a dashboard. */
export async function getDashboardByItemId(
  itemId: string,
): Promise<{ item: DashboardItem; resolved: ResolvedDashboard } | null> {
  const [item] = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item || item.type !== 'dashboard') return null;

  await assertWorkspaceAccess(item.workspaceId);

  const [row] = await db
    .select({ spec: dashboards.spec })
    .from(dashboards)
    .where(eq(dashboards.itemId, itemId))
    .limit(1);

  const resolved = await resolveDashboard(item.workspaceId, row?.spec ?? EMPTY_DASHBOARD_SPEC);

  return {
    item: {
      id: item.id,
      workspaceId: item.workspaceId,
      title: item.title,
      icon: item.icon,
      iconColor: item.iconColor,
      parentId: item.parentId,
      updatedAt: item.updatedAt,
    },
    resolved,
  };
}

/**
 * The stored spec as a RAW block list.
 *
 * Deliberately not strict-validated: a block this build cannot read must
 * survive an edit to a different block. Validating the whole document here and
 * writing back only what parsed would quietly delete an agent's unreadable
 * block the first time a human moved an unrelated tile — a silent data loss
 * dressed up as a reorder. Blocks pass through verbatim; only
 * `setDashboardSpec` (a full replacement) validates.
 */
async function loadSpecForWrite(itemId: string): Promise<{ workspaceId: string; version: unknown; blocks: unknown[] }> {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);
  if (!item || item.type !== 'dashboard') throw new Error('Dashboard not found');

  await assertWorkspaceAccess(item.workspaceId);

  const [row] = await db
    .select({ spec: dashboards.spec })
    .from(dashboards)
    .where(eq(dashboards.itemId, itemId))
    .limit(1);

  let doc: unknown = row?.spec ?? EMPTY_DASHBOARD_SPEC;
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc);
    } catch {
      doc = EMPTY_DASHBOARD_SPEC;
    }
  }
  const shell = (doc ?? {}) as { version?: unknown; blocks?: unknown };
  return {
    workspaceId: item.workspaceId,
    version: shell.version ?? DASHBOARD_SPEC_VERSION,
    blocks: Array.isArray(shell.blocks) ? shell.blocks : [],
  };
}

/** The id of a raw block entry, or null when it doesn't carry one. */
function rawBlockId(entry: unknown): string | null {
  if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string') {
    return (entry as { id: string }).id;
  }
  return null;
}

async function writeSpec(itemId: string, spec: { version: unknown; blocks: unknown[] }): Promise<void> {
  const now = new Date();
  await db.update(dashboards).set({ spec, updatedAt: now }).where(eq(dashboards.itemId, itemId));
  await db.update(workspaceItems).set({ updatedAt: now }).where(eq(workspaceItems.id, itemId));
  revalidatePath(`/dashboard/${itemId}`);
}

/** Replace the whole spec. Rejects an invalid document outright — never partially. */
export async function setDashboardSpec(itemId: string, rawSpec: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await loadSpecForWrite(itemId);
  const validated = validateDashboardSpec(rawSpec);
  if (!validated.ok) return { ok: false, error: validated.error };
  await writeSpec(itemId, validated.spec);
  return { ok: true };
}

/**
 * Every block edit a human makes goes through the same service as an agent's
 * `update_dashboard` (`src/lib/services/dashboards.ts`): addressed by id,
 * compare-and-swap on the stored spec, unknown blocks passed through verbatim.
 * A block that carries no id at all cannot be edited from here; that shape is
 * only reachable by writing the spec straight into the database, and
 * `setDashboardSpec` is the repair path for it.
 */
async function patchAsUser(itemId: string, patch: DashboardPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId } = await loadSpecForWrite(itemId);
  try {
    await patchDashboard(workspaceId, itemId, patch);
  } catch (err) {
    // The service's messages are written for agents, in English; the editor
    // shows its own localized error and the detail goes to the console.
    if (err instanceof DashboardInputError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/dashboard/${itemId}`);
  return { ok: true };
}

export async function deleteDashboardBlock(itemId: string, blockId: string): Promise<{ ok: boolean }> {
  return patchAsUser(itemId, { remove: [blockId] });
}

export async function moveDashboardBlock(
  itemId: string,
  blockId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean }> {
  const { blocks } = await loadSpecForWrite(itemId);
  const ids = blocks.map(rawBlockId);
  const index = ids.indexOf(blockId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length || !ids[target]) return { ok: false };
  // The two ids to swap, by id: whatever else moved meanwhile stays put.
  const order = ids.filter((id): id is string => !!id);
  const a = order.indexOf(blockId);
  const b = order.indexOf(ids[target] as string);
  [order[a], order[b]] = [order[b], order[a]];
  return patchAsUser(itemId, { order });
}

/** Add a new block, or swap an existing one (same id) for the edited version. */
export async function saveDashboardBlock(
  itemId: string,
  block: Record<string, unknown>,
  mode: 'add' | 'replace',
): Promise<{ ok: true } | { ok: false; error: string }> {
  return patchAsUser(itemId, mode === 'add' ? { add: [block] } : { replace: [block] });
}

export type DashboardEditorDatabase = {
  id: string;
  name: string;
  columns: { id: string; name: string; type: string; options: string[] }[];
  views: { id: string; name: string; type: string }[];
};

export type DashboardEditorOptions = {
  databases: DashboardEditorDatabase[];
  items: { id: string; title: string; type: 'page' | 'database' | 'dashboard' }[];
};

/**
 * What the block editor's pickers offer: this workspace's databases (columns,
 * select options, views) and its sidebar items for link blocks. Loaded when
 * the editor opens, not with the page — a reader who never edits never pays.
 */
export async function getDashboardEditorOptions(itemId: string): Promise<DashboardEditorOptions> {
  const { workspaceId } = await loadSpecForWrite(itemId);
  const [dbRows, items] = await Promise.all([
    db
      .select({ id: databases.id, name: databases.name, schema: databases.schema, views: databases.views })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type })
      .from(workspaceItems)
      .where(eq(workspaceItems.workspaceId, workspaceId)),
  ]);

  return {
    databases: dbRows
      .map((d) => ({
        id: d.id,
        name: d.name,
        columns: ((d.schema ?? []) as { id?: unknown; name?: unknown; type?: unknown; options?: unknown[] }[])
          .filter((c) => typeof c?.id === 'string')
          .map((c) => ({
            id: c.id as string,
            name: String(c.name ?? c.id),
            type: String(c.type ?? 'text'),
            options: (c.options ?? [])
              .map((o) => (typeof o === 'string' ? o : (o as { value?: unknown })?.value))
              .filter((v): v is string => typeof v === 'string'),
          })),
        views: ((d.views ?? []) as { id?: unknown; name?: unknown; config?: { type?: unknown } }[])
          .filter((v) => typeof v?.id === 'string' && (v.config?.type === 'table' || v.config?.type === 'kanban'))
          .map((v) => ({ id: v.id as string, name: String(v.name ?? ''), type: String(v.config?.type) })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    items: items
      .filter((i) => i.id !== itemId)
      .map((i) => ({ id: i.id, title: i.title, type: i.type }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}
