/**
 * Agent presence for the sidebar (V2 R8.8): which agents worked in the caller's
 * workspaces in the last hour, what each one last called, and which sidebar items an
 * agent changed lately. Read by the `(app)` layout, so it rides on renders that happen
 * anyway — the first load and every live-refresh `router.refresh()` an agent's write
 * triggers. It adds no request of its own and nothing to the change poll; the client
 * ages what it got on its own clock (see `components/features/AgentPresence.tsx`).
 *
 * Cost: one `db.batch` of two aggregates over the index range of `agent_activity
 * (workspace_id, created_at)` for the window — a few rows back however busy the hour
 * was. An hour without agents returns nothing and stops there; with activity, ONE more
 * `db.batch` names the connections and resolves the touched targets. Measured with
 * `npm run bench:presence`.
 *
 * Audit window: which pages an agent called is audit-log information, so it must stay
 * inside each workspace's plan window (`auditVisibleSince`, services/auditRetention.ts).
 * The presence window is clamped to the SHORTEST window any plan grants, which puts it
 * inside every workspace's window at once — the same result as clamping per workspace,
 * without reading every billing owner's plan on every render.
 */
import { and, eq, gte, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentActivity,
  agentTokens,
  databases,
  knowledgeMetadata,
  oauthAccessTokens,
  oauthClients,
  pages,
  workspaceItems,
} from '@/db/schema';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import {
  AGENT_PRESENCE_WINDOW_MS,
  EMPTY_PRESENCE,
  type AgentPresence,
  type PresenceAgent,
  type PresenceTouch,
} from '@/lib/agentPresence';
import { asEpochSeconds } from './agentMetrics';
import { activityAtOrAfter } from './auditRetention';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The shortest audit window any plan grants (Free: 7 days). See the header. */
const SHORTEST_AUDIT_MS = Math.min(...Object.values(PLAN_LIMITS).map((limits) => limits.auditDays)) * DAY_MS;

/** The window actually read: the presence window, never past any plan's audit window. */
export const PRESENCE_READ_WINDOW_MS = Math.min(AGENT_PRESENCE_WINDOW_MS, SHORTEST_AUDIT_MS);

/** The tool verbs that change something — the dashboard's `WRITE_TOOL`, as SQL. */
const WRITE_VERBS = ['create', 'update', 'delete', 'bulk', 'move', 'add', 'restore', 'set'];

/** Bulk writes log no per-item target; their items carry a knowledge stamp instead. */
const BULK_CONTENT_TOOLS = ['bulk_create_pages', 'bulk_update_pages'];

/** `mcp:<agentName>:<tokenId>` / `mcp:<tokenId>` (`actorId` in the MCP write tools). */
function tokenIdOf(generatedBy: string | null): string | null {
  if (!generatedBy?.startsWith('mcp:')) return null;
  return generatedBy.slice(generatedBy.lastIndexOf(':') + 1) || null;
}

/**
 * Presence over `workspaceIds` — the caller's visible workspaces (a project window
 * passes only its own). Best-effort by contract: the layout swallows a failure and
 * renders without presence rather than failing the page.
 */
export async function loadAgentPresence(workspaceIds: string[], now = Date.now()): Promise<AgentPresence> {
  if (workspaceIds.length === 0) return { ...EMPTY_PRESENCE, at: now };
  const since = new Date(now - PRESENCE_READ_WINDOW_MS);

  const epoch = asEpochSeconds(agentActivity.createdAt);
  const connection = sql<string | null>`coalesce(${agentActivity.tokenId}, ${agentActivity.oauthTokenId})`;
  const inWindow = and(
    inArray(agentActivity.workspaceId, workspaceIds),
    // The index range (integers from `since` on, plus any legacy TEXT row) …
    gte(agentActivity.createdAt, since),
    // … and the exact test that drops a legacy row older than the window.
    activityAtOrAfter(since),
  );

  // Aggregated in SQL so a busy hour returns a handful of rows, not every call
  // (measured: shipping ~300 raw rows cost ~5 ms locally and ~45 KB from Turso).
  // SQLite: with max() as the only aggregate, the bare columns come from the row
  // holding the max — each group's newest call.
  const [latest, written] = await db.batch([
    db.select({
        key: connection,
        oauth: sql<number>`${agentActivity.tokenId} is null`,
        workspaceId: agentActivity.workspaceId,
        tool: agentActivity.tool,
        targetId: agentActivity.targetId,
        items: agentActivity.itemsAffected,
        at: sql<number>`max(${epoch})`,
      })
      .from(agentActivity)
      .where(and(inWindow, sql`${connection} is not null`))
      .groupBy(connection),
    // Newest successful write per target. The NULL group (a bulk content write, which
    // names no target) only says such a call happened.
    db.select({ targetId: agentActivity.targetId, key: connection, at: sql<number>`max(${epoch})` })
      .from(agentActivity)
      .where(and(
        inWindow,
        eq(agentActivity.status, 'success'),
        sql`substr(${agentActivity.tool}, 1, instr(${agentActivity.tool}, '_') - 1) in (${sql.join(WRITE_VERBS.map((verb) => sql`${verb}`), sql`, `)})`,
        or(isNotNull(agentActivity.targetId), inArray(agentActivity.tool, BULK_CONTENT_TOOLS)),
      ))
      .groupBy(agentActivity.targetId),
  ]);

  const agents = new Map<string, PresenceAgent & { targetId: string | null; oauth: boolean }>();
  for (const row of [...latest].sort((a, b) => Number(b.at) - Number(a.at))) {
    const at = Number(row.at) * 1000;
    if (!row.key || !Number.isFinite(at)) continue;
    agents.set(row.key, {
      key: row.key,
      agentName: null,
      tokenName: null,
      workspaceId: row.workspaceId,
      lastAt: at,
      tool: row.tool,
      target: null,
      items: row.items ?? null,
      targetId: row.targetId,
      oauth: Number(row.oauth) === 1,
    });
  }
  const writes = new Map<string, PresenceTouch>(); // target id → newest successful write
  let bulkWrite = false;
  for (const row of written) {
    const at = Number(row.at) * 1000;
    if (!Number.isFinite(at)) continue;
    if (row.targetId) writes.set(row.targetId, { at, agent: row.key });
    else bulkWrite = true;
  }
  if (agents.size === 0) return { ...EMPTY_PRESENCE, at: now };

  const connections = [...agents.values()];
  const targetIds = [...new Set([...writes.keys(), ...connections.flatMap((a) => (a.targetId ? [a.targetId] : []))])];
  const patIds = connections.filter((a) => !a.oauth).map((a) => a.key);
  const oauthIds = connections.filter((a) => a.oauth).map((a) => a.key);
  const inScope = inArray(workspaceItems.workspaceId, workspaceIds);

  // One round trip for everything the calls point at. Each lookup is scoped to the
  // visible workspaces, so a target id from elsewhere resolves to nothing.
  const queries = {
    pats: patIds.length
      ? db.select({ id: agentTokens.id, name: agentTokens.name, agentName: agentTokens.agentName })
          .from(agentTokens).where(inArray(agentTokens.id, patIds))
      : null,
    oauth: oauthIds.length
      ? db.select({
            id: oauthAccessTokens.id,
            name: sql<string | null>`coalesce(${oauthAccessTokens.displayName}, ${oauthClients.clientName})`,
            agentName: oauthAccessTokens.agentName,
          })
          .from(oauthAccessTokens)
          .leftJoin(oauthClients, eq(oauthAccessTokens.clientId, oauthClients.clientId))
          .where(inArray(oauthAccessTokens.id, oauthIds))
      : null,
    items: targetIds.length
      ? db.select({ id: workspaceItems.id, title: workspaceItems.title, itemId: workspaceItems.id })
          .from(workspaceItems).where(and(inScope, inArray(workspaceItems.id, targetIds)))
      : null,
    rows: targetIds.length
      ? db.select({ id: pages.id, title: pages.title, itemId: databases.itemId })
          .from(pages)
          .innerJoin(databases, eq(pages.databaseId, databases.id))
          .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
          .where(and(inScope, inArray(pages.id, targetIds)))
      : null,
    dbs: targetIds.length
      ? db.select({ id: databases.id, title: databases.name, itemId: databases.itemId })
          .from(databases)
          .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
          .where(and(inScope, inArray(databases.id, targetIds)))
      : null,
    // A bulk write in the window: its items carry a knowledge stamp with the writer
    // (every create/update path records one), read only when such a call happened.
    // A row resolves to its database's sidebar item.
    stamps: bulkWrite
      ? db.select({
            itemId: knowledgeMetadata.itemId,
            itemType: knowledgeMetadata.itemType,
            rowItemId: databases.itemId,
            generatedBy: knowledgeMetadata.generatedBy,
            at: asEpochSeconds(knowledgeMetadata.generatedAt),
          })
          .from(knowledgeMetadata)
          .leftJoin(pages, and(eq(knowledgeMetadata.itemType, 'database_row'), eq(pages.id, knowledgeMetadata.itemId)))
          .leftJoin(databases, eq(databases.id, pages.databaseId))
          .where(and(
            inArray(knowledgeMetadata.workspaceId, workspaceIds),
            gte(knowledgeMetadata.generatedAt, since),
          ))
      : null,
  };
  const entries = Object.entries(queries).filter(([, query]) => query !== null) as [string, NonNullable<(typeof queries)[keyof typeof queries]>][];
  const results = entries.length
    ? await db.batch(entries.map(([, query]) => query) as unknown as Parameters<typeof db.batch>[0])
    : [];
  const read = <T,>(name: string): T[] => {
    const index = entries.findIndex(([key]) => key === name);
    return index === -1 ? [] : (results[index] as T[]);
  };

  for (const token of [
    ...read<{ id: string; name: string | null; agentName: string | null }>('pats'),
    ...read<{ id: string; name: string | null; agentName: string | null }>('oauth'),
  ]) {
    const agent = agents.get(token.id);
    if (agent) Object.assign(agent, { tokenName: token.name, agentName: token.agentName });
  }

  // Target id → { sidebar item, title }. Item ids map to themselves, a row to its
  // database's item, a database id to its item.
  const targets = new Map<string, { itemId: string | null; title: string | null }>();
  for (const name of ['items', 'rows', 'dbs']) {
    for (const r of read<{ id: string; title: string | null; itemId: string | null }>(name)) {
      targets.set(r.id, { itemId: r.itemId, title: r.title?.trim() || null });
    }
  }

  const touched: Record<string, PresenceTouch> = {};
  const touch = (itemId: string | null | undefined, value: PresenceTouch) => {
    if (!itemId) return;
    const current = touched[itemId];
    if (!current || value.at > current.at) touched[itemId] = value;
  };
  for (const [targetId, value] of writes) touch(targets.get(targetId)?.itemId, value);
  for (const stamp of read<{ itemId: string; itemType: string; rowItemId: string | null; generatedBy: string | null; at: number | null }>('stamps')) {
    const at = Number(stamp.at) * 1000;
    if (!Number.isFinite(at) || at < now - PRESENCE_READ_WINDOW_MS) continue;
    const agent = tokenIdOf(stamp.generatedBy);
    touch(stamp.itemType === 'database_row' ? stamp.rowItemId : stamp.itemId, { at, agent: agent && agents.has(agent) ? agent : null });
  }

  return {
    at: now,
    agents: [...agents.values()].map((agent) => ({
      key: agent.key,
      agentName: agent.agentName,
      tokenName: agent.tokenName,
      workspaceId: agent.workspaceId,
      lastAt: agent.lastAt,
      tool: agent.tool,
      target: agent.targetId ? targets.get(agent.targetId)?.title ?? null : null,
      items: agent.items,
    })),
    touched,
  };
}
