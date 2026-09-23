/**
 * Migration 0051 — agent_savings_rollup
 *
 * Adds `agent_savings_rollup`: the lifetime savings of `agent_activity` rows that the
 * audit-log hard limit deletes (older than AUDIT_HARD_RETENTION_DAYS, see
 * `src/lib/services/auditRetention.ts`). The nightly prune upserts into it in the
 * same transaction that deletes the rows, and `getAgentMetrics` adds it to the live
 * rows, so the all-time "tokens saved" counter never shrinks.
 *
 * Purely additive: nothing reads it until this code deploys, and the running code
 * never touches it. Idempotent (CREATE TABLE / CREATE INDEX IF NOT EXISTS). Apply to
 * BOTH local and Turso, BEFORE deploying the code that reads/writes this table:
 *   npx tsx src/db/apply-0051-agent-savings-rollup.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0051-agent-savings-rollup.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  console.log(`Target: ${url.startsWith('file:') ? url : 'REMOTE (Turso)'}`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS agent_savings_rollup (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL,
      owner_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      saved_bytes   INTEGER NOT NULL,
      saved_calls   INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    )
  `);

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS agent_savings_rollup_ws_owner_idx ON agent_savings_rollup (workspace_id, owner_user_id)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS agent_savings_rollup_owner_idx ON agent_savings_rollup (owner_user_id)`,
  );

  console.log('Migration 0051 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
