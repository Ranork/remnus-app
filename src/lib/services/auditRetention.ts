/**
 * The audit log's retention promise (`PlanLimits.auditDays`: Free 7 days … Enterprise
 * 365), enforced in two layers.
 *
 * 1. **Visibility window.** Every surface that shows `agent_activity` to a customer —
 *    `query_audit_log`, the `audit-log/recent` resource, the AI Agents activity list and
 *    the dashboard `activity` block — hides rows older than the plan of the workspace's
 *    billing owner allows. Upgrading shows the older history immediately, and a lapsed
 *    plan hides it again: the window is a view over the data, not the data.
 *
 * 2. **Hard limit.** Rows older than AUDIT_HARD_RETENTION_DAYS (just past the largest
 *    plan's window) are deleted by the nightly cron, so the table cannot grow forever.
 *    Before they go, their savings are added to `agent_savings_rollup` in the SAME
 *    transaction, so the all-time "tokens saved" counter never shrinks and a row is
 *    never counted twice or lost between the two statements.
 *
 * The window is deliberately NOT applied to what isn't the audit log: the savings
 * card's 7/30-day figures, onboarding's "an agent has connected" check and the admin
 * funnels read the retained rows directly — deleting at 7 days would have broken all
 * three for every Free workspace.
 */
import { and, eq, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { agentActivity } from '@/db/schema';
import { getPlanForWorkspace } from './billing';
import { asEpochSeconds } from './agentMetrics';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Past the largest plan window (365) with a margin, so no visible row is ever deleted. */
export const AUDIT_HARD_RETENTION_DAYS = 400;

/** The oldest moment a workspace's audit log may show, per its billing owner's plan. */
export async function auditVisibleSince(workspaceId: string, now = Date.now()): Promise<Date> {
  const { limits } = await getPlanForWorkspace(workspaceId);
  return new Date(now - limits.auditDays * DAY_MS);
}

/** `auditVisibleSince` for several workspaces (each can have a different owner and plan). */
export async function auditVisibleSinceMany(workspaceIds: string[], now = Date.now()): Promise<Map<string, Date>> {
  const unique = [...new Set(workspaceIds)];
  const cutoffs = await Promise.all(unique.map((id) => auditVisibleSince(id, now)));
  return new Map(unique.map((id, i) => [id, cutoffs[i]]));
}

/**
 * `agent_activity.created_at >= since`, also for legacy rows that stored SQLite's
 * CURRENT_TIMESTAMP text — compared raw, TEXT sorts above every integer and those rows
 * would pass every window forever.
 */
export function activityAtOrAfter(since: Date): SQL {
  return sql`${asEpochSeconds(agentActivity.createdAt)} >= ${Math.floor(since.getTime() / 1000)}`;
}

/** The visibility window over several workspaces at once, as one condition. */
export function activityVisibleIn(cutoffs: Map<string, Date>): SQL | undefined {
  const clauses = [...cutoffs].map(([workspaceId, since]) =>
    and(eq(agentActivity.workspaceId, workspaceId), activityAtOrAfter(since)),
  );
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

/**
 * Deletes activity older than the hard limit, carrying its savings into
 * `agent_savings_rollup` first. One transaction: the upsert and the delete select the
 * same rows by the same cutoff, so nothing is double counted or dropped. The savings
 * condition must stay identical to `getAgentMetrics`' saved-bytes query.
 */
export async function pruneAgentActivity(now = new Date()): Promise<{ pruned: number }> {
  const cutoff = Math.floor((now.getTime() - AUDIT_HARD_RETENTION_DAYS * DAY_MS) / 1000);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const createdAt = `(case when typeof(created_at) = 'integer' then created_at else unixepoch(created_at) end)`;

  const [, deleted] = await db.$client.batch([
    {
      // A NULL owner never conflicts (SQLite UNIQUE treats NULLs as distinct), so such a
      // group becomes a row of its own — rare, and still summed per workspace.
      sql: `
        insert into agent_savings_rollup (id, workspace_id, owner_user_id, saved_bytes, saved_calls, updated_at)
        select lower(hex(randomblob(16))), workspace_id, owner_user_id,
               sum(baseline_bytes - response_bytes), count(*), ?
        from agent_activity
        where ${createdAt} < ?
          and status = 'success'
          and baseline_bytes is not null
          and response_bytes is not null
          and baseline_bytes > response_bytes
        group by workspace_id, owner_user_id
        on conflict (workspace_id, owner_user_id) do update set
          saved_bytes = saved_bytes + excluded.saved_bytes,
          saved_calls = saved_calls + excluded.saved_calls,
          updated_at  = excluded.updated_at`,
      args: [nowSeconds, cutoff],
    },
    { sql: `delete from agent_activity where ${createdAt} < ?`, args: [cutoff] },
  ], 'write');

  return { pruned: deleted.rowsAffected };
}
