'use server';
import { db } from '@/db';
import { dashboards, workspaceItems, workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import { DASHBOARD_SPEC_VERSION, EMPTY_DASHBOARD_SPEC, validateDashboardSpec } from '@/lib/dashboard/schema';
import { resolveDashboard, type ResolvedDashboard } from '@/lib/dashboard/data';

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
 * Blocks are addressed by id, never by index — see the spec module's header.
 * A block that carries no id at all cannot be removed from here; that shape is
 * only reachable by writing the spec straight into the database, and
 * `setDashboardSpec` is the repair path for it.
 */
export async function deleteDashboardBlock(itemId: string, blockId: string): Promise<{ ok: boolean }> {
  const { version, blocks } = await loadSpecForWrite(itemId);
  const next = blocks.filter((entry) => rawBlockId(entry) !== blockId);
  if (next.length === blocks.length) return { ok: false };
  await writeSpec(itemId, { version, blocks: next });
  return { ok: true };
}

export async function moveDashboardBlock(
  itemId: string,
  blockId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean }> {
  const { version, blocks } = await loadSpecForWrite(itemId);
  const index = blocks.findIndex((entry) => rawBlockId(entry) === blockId);
  if (index < 0) return { ok: false };
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= blocks.length) return { ok: false };

  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  await writeSpec(itemId, { version, blocks: next });
  return { ok: true };
}
