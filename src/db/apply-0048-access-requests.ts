/**
 * Migration 0048 — workspace access requests
 *
 * Adds `workspace_access_requests`: the request a person sends to a workspace
 * owner when they run `npx remnus join` in a project they are not a member of
 * (see **Project Install** §5 in AGENTS.md). `workspace_invites` is the opposite
 * arrow — owner → email — and grants membership on acceptance, so it cannot
 * carry this.
 *
 * The UNIQUE (workspace_id, user_id) index is load-bearing twice over: it makes
 * "one open request per person per workspace" a database guarantee, and because
 * the row is reused rather than re-inserted, a `denied` row survives long enough
 * for the cooling-off window to mean something.
 *
 * Idempotent (CREATE TABLE / CREATE INDEX IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0048-access-requests.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0048-access-requests.ts (local)
 *
 * Apply BEFORE deploying the code that reads/writes this table.
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
    CREATE TABLE IF NOT EXISTS workspace_access_requests (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      scope        TEXT NOT NULL DEFAULT 'write',
      status       TEXT NOT NULL DEFAULT 'pending',
      project_name TEXT,
      note         TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      resolved_at  INTEGER,
      resolved_by  TEXT REFERENCES user(id) ON DELETE SET NULL
    )
  `);

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS workspace_access_requests_workspace_user_unique
       ON workspace_access_requests (workspace_id, user_id)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS workspace_access_requests_workspace_status_idx
       ON workspace_access_requests (workspace_id, status)`,
  );

  console.log('Migration 0048 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
