/**
 * Migration 0053 — agent_activity (workspace_id, created_at) index
 *
 * The knowledge graph (P12, `src/lib/services/graph.ts`) colours what agents read and
 * wrote in the last 7/30/90 days, which is a time window over ONE workspace's audit
 * rows. With only `agent_activity_workspace_id_idx`, SQLite reads every audit row the
 * workspace has (up to 400 days of them) to keep the window. Measured on a synthetic
 * workspace with 30,000 audit rows: the 7-day window is 1,766 rows, the scan was all
 * 30,000 (bench:graph). On Turso that is rows read, i.e. latency and billing, on every
 * graph load and every live refresh of it.
 *
 * The composite index serves every `workspace_id = ?` / `IN (…)` query the single-column
 * one did, and also lets `query_audit_log` and the dashboard `activity` block read a
 * workspace's newest rows in index order. The single-column index is then a strict
 * prefix of it — pure write cost on the one insert every MCP call makes — so it is
 * dropped in the same run.
 *
 * Index-only: no code depends on it for correctness, so apply order against a deploy
 * does not matter. Idempotent (CREATE INDEX IF NOT EXISTS / DROP INDEX IF EXISTS).
 *   npx tsx src/db/apply-0053-agent-activity-workspace-created.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0053-agent-activity-workspace-created.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

function target(): string {
  if (url.startsWith('file:')) return url;
  try {
    return `REMOTE ${new URL(url.replace(/^libsql:/, 'https:')).host}`;
  } catch {
    return 'REMOTE (unparseable URL)';
  }
}

async function main() {
  console.log(`Target: ${target()}`);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS agent_activity_workspace_created_idx ON agent_activity (workspace_id, created_at)`,
  );
  await client.execute(`DROP INDEX IF EXISTS agent_activity_workspace_id_idx`);

  const plan = await client.execute(
    `EXPLAIN QUERY PLAN SELECT target_id FROM agent_activity WHERE workspace_id = 'x' AND created_at >= 0`,
  );
  console.log(`Plan: ${plan.rows.map((row) => String(row.detail)).join(' | ')}`);
  console.log('Migration 0053 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
