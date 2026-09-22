/**
 * What Remnus has actually saved the people using it — measured, never estimated.
 *
 * Every number here is derived from `agent_activity` rows written at call time
 * (migration 0049). The rule that governs this whole file: a call whose naive
 * alternative could not be computed exactly records NULL and is left out, rather
 * than contributing a plausible-looking guess. A savings counter that is wrong
 * once is worth less than no counter at all.
 *
 * Definitions and baseline formulas: AGENTS.md → "Agent Savings Metrics".
 */
import { and, asc, eq, gte, inArray, isNotNull, sql, type SQL, type Column } from 'drizzle-orm';
import { db } from '@/db';
import { agentActivity, pages, workspaceItems } from '@/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A timestamp column as epoch seconds, whichever way it was written.
 *
 * Rows created before the explicit-`new Date()` fix carry SQLite's
 * `CURRENT_TIMESTAMP` TEXT instead of an integer (see the createdAt gotcha in
 * AGENTS.md). Compared raw against an integer, SQLite's type ordering puts every
 * TEXT value above every number, so those rows would silently never satisfy "was
 * written earlier" — and the reuse metric would read zero forever on exactly the
 * oldest, most-worth-counting workspaces. `unixepoch()` reads the stored UTC
 * string, so this converts rather than guesses.
 */
function asEpochSeconds(column: Column): SQL<number | null> {
  return sql`(case when typeof(${column}) = 'integer' then ${column} else unixepoch(${column}) end)`;
}

/** Tools that create or update a page or row. Moves, schema and view edits aren't content. */
const CONTENT_WRITE_TOOLS = ['create_page', 'update_page', 'bulk_create_pages', 'bulk_update_pages'];

export type AgentMetrics = {
  /** Bytes not sent to the model, summed over every call with a computable baseline. All time. */
  savedBytes: number;
  /** How many calls contributed to savedBytes — the tooltip's "across N calls". */
  savedCalls: number;
  /** Pages/rows read that were already there a day earlier: knowledge not rediscovered. 30 days. */
  recalledItems: number;
  /** Pages and rows agents created or updated. 7 days. */
  agentWrites: number;
  /** Median server-side handling time, ms. 30 days. Null until anything has been timed. */
  p50Ms: number | null;
  /** Any activity at all in the last 30 days — decides whether the card has something to say. */
  recentCalls: number;
};

/**
 * Account-wide (every token this user owns) or confined to one workspace.
 * A project window must pass `workspaceId`: it is allowed to see its own
 * workspace and nothing about the account behind it.
 */
export type AgentMetricsScope = { ownerUserId: string } | { workspaceId: string };

function scopedTo(scope: AgentMetricsScope): SQL {
  return 'workspaceId' in scope
    ? eq(agentActivity.workspaceId, scope.workspaceId)
    : eq(agentActivity.ownerUserId, scope.ownerUserId);
}

export async function getAgentMetrics(scope: AgentMetricsScope): Promise<AgentMetrics> {
  const where = scopedTo(scope);
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since7 = new Date(Date.now() - 7 * DAY_MS);

  const [savedRow, recalledRow, writeRow, recentRow, timedRow] = await Promise.all([
    // Saved = baseline − what was actually sent, floored at zero: a call that
    // came out no cheaper contributes nothing, never a negative.
    db
      .select({
        bytes: sql<number>`cast(coalesce(sum(max(${agentActivity.baselineBytes} - ${agentActivity.responseBytes}, 0)), 0) as int)`,
        calls: sql<number>`cast(count(*) as int)`,
      })
      .from(agentActivity)
      .where(and(
        where,
        eq(agentActivity.status, 'success'),
        isNotNull(agentActivity.baselineBytes),
        isNotNull(agentActivity.responseBytes),
        sql`${agentActivity.baselineBytes} > ${agentActivity.responseBytes}`,
      )),

    // Knowledge reuse: distinct pages/rows an agent read that already existed a
    // full day before the read — i.e. written in some earlier session, by
    // someone or something else, and not rediscovered from scratch now.
    // Timestamps are epoch seconds, hence 86400.
    db
      .select({ n: sql<number>`cast(count(distinct ${agentActivity.targetId}) as int)` })
      .from(agentActivity)
      .leftJoin(pages, eq(pages.id, agentActivity.targetId))
      .leftJoin(workspaceItems, eq(workspaceItems.id, agentActivity.targetId))
      .where(and(
        where,
        eq(agentActivity.tool, 'get_page'),
        eq(agentActivity.status, 'success'),
        isNotNull(agentActivity.targetId),
        gte(agentActivity.createdAt, since30),
        sql`coalesce(${asEpochSeconds(pages.createdAt)}, ${asEpochSeconds(workspaceItems.createdAt)}) < ${agentActivity.createdAt} - 86400`,
      )),

    // A bulk call reports how many entries landed; a single-target call is one.
    // This counts writes, not distinct pages: a page edited twice counts twice,
    // which is what the tooltip says.
    db
      .select({ n: sql<number>`cast(coalesce(sum(coalesce(${agentActivity.itemsAffected}, 1)), 0) as int)` })
      .from(agentActivity)
      .where(and(
        where,
        inArray(agentActivity.tool, CONTENT_WRITE_TOOLS),
        eq(agentActivity.status, 'success'),
        gte(agentActivity.createdAt, since7),
      )),

    db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(agentActivity)
      .where(and(where, gte(agentActivity.createdAt, since30))),

    db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(agentActivity)
      .where(and(where, gte(agentActivity.createdAt, since30), isNotNull(agentActivity.durationMs))),
  ]);

  const timed = Number(timedRow[0]?.n ?? 0);
  const p50Ms = timed > 0
    ? (await db
        .select({ d: agentActivity.durationMs })
        .from(agentActivity)
        .where(and(where, gte(agentActivity.createdAt, since30), isNotNull(agentActivity.durationMs)))
        .orderBy(asc(agentActivity.durationMs))
        .limit(1)
        .offset(Math.floor(timed / 2)))[0]?.d ?? null
    : null;

  return {
    savedBytes: Number(savedRow[0]?.bytes ?? 0),
    savedCalls: Number(savedRow[0]?.calls ?? 0),
    recalledItems: Number(recalledRow[0]?.n ?? 0),
    agentWrites: Number(writeRow[0]?.n ?? 0),
    p50Ms,
    recentCalls: Number(recentRow[0]?.n ?? 0),
  };
}
