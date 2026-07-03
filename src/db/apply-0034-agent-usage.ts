/**
 * Migration 0034 — agent usage metering + OAuth audit-log fix
 *
 * Rebuilds `agent_activity` (SQLite can't relax NOT NULL / change FKs in place):
 *   - `token_id` becomes NULLABLE (still FK→agent_tokens ON DELETE CASCADE) — PAT calls.
 *   - NEW `oauth_token_id` (FK→oauth_access_tokens ON DELETE SET NULL) — OAuth calls.
 *     Before this, OAuth tool calls silently failed the audit insert (token_id FK'd
 *     agent_tokens and was NOT NULL), so OAuth usage was invisible.
 *   - NEW `owner_user_id` (FK→user ON DELETE SET NULL) — token owner (PAT creator /
 *     OAuth grantee), denormalized for per-user usage sums.
 *   - NEW `response_bytes` (nullable INTEGER) — serialized response payload size;
 *     token estimate ≈ bytes/4. Null for error calls + legacy rows.
 *
 * Backfills `owner_user_id` for legacy PAT rows from `agent_tokens.created_by`,
 * EXCLUDING the planted seed token ('rmns-demo') so owner-based queries
 * (onboarding, funnel, usage) keep ignoring seed activity.
 *
 * Idempotent (PRAGMA column check gates the rebuild; stray agent_activity_new
 * from a crashed run is dropped and redone). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0034-agent-usage.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0034-agent-usage.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

const SEED_TOKEN_PREFIX = 'rmns-demo';

async function hasColumn(table: string, column: string): Promise<boolean> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => r.name === column);
}

async function main() {
  if (!(await hasColumn('agent_activity', 'response_bytes'))) {
    await client.execute(`DROP TABLE IF EXISTS agent_activity_new`);
    await client.execute(`
      CREATE TABLE agent_activity_new (
        id             TEXT PRIMARY KEY,
        token_id       TEXT REFERENCES agent_tokens(id) ON DELETE CASCADE,
        oauth_token_id TEXT REFERENCES oauth_access_tokens(id) ON DELETE SET NULL,
        owner_user_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
        workspace_id   TEXT NOT NULL,
        tool           TEXT NOT NULL,
        target_type    TEXT,
        target_id      TEXT,
        status         TEXT NOT NULL,
        response_bytes INTEGER,
        created_at     INTEGER NOT NULL
      )
    `);
    await client.execute(`
      INSERT INTO agent_activity_new (id, token_id, workspace_id, tool, target_type, target_id, status, created_at)
      SELECT id, token_id, workspace_id, tool, target_type, target_id, status, created_at FROM agent_activity
    `);
    await client.execute(`DROP TABLE agent_activity`);
    await client.execute(`ALTER TABLE agent_activity_new RENAME TO agent_activity`);
    console.log('Rebuilt agent_activity (nullable token_id + oauth_token_id + owner_user_id + response_bytes)');
  }

  // Indexes are outside the rebuild guard so a partially-applied run heals.
  await client.execute(
    `CREATE INDEX IF NOT EXISTS agent_activity_workspace_id_idx ON agent_activity (workspace_id)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS agent_activity_token_id_idx ON agent_activity (token_id)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS agent_activity_owner_created_idx ON agent_activity (owner_user_id, created_at)`,
  );

  // Backfill owner for legacy PAT rows (seed token excluded — owner-based queries
  // must keep ignoring the planted demo activity).
  const backfill = await client.execute(`
    UPDATE agent_activity
    SET owner_user_id = (SELECT created_by FROM agent_tokens WHERE agent_tokens.id = agent_activity.token_id)
    WHERE owner_user_id IS NULL
      AND token_id IN (SELECT id FROM agent_tokens WHERE token_prefix != '${SEED_TOKEN_PREFIX}')
  `);
  if (backfill.rowsAffected > 0) {
    console.log(`Backfilled owner_user_id on ${backfill.rowsAffected} legacy PAT rows`);
  }

  console.log('Migration 0034 applied successfully.');
}

main().catch(console.error);
