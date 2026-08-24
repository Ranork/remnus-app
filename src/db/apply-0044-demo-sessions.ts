/**
 * Migration 0044 — durable demo usage log
 *
 * Adds `demo_sessions`: one row per "Try the demo" click, holding when the demo
 * started, when it was last seen, and how many seconds of real presence it
 * accumulated.
 *
 * Why a table and not a query: demo accounts are ephemeral — `purgeDemoUser`
 * reaps them (and cascades their `user_sessions`) 6h after signup, so the admin
 * panel could only ever show demos that were still alive. Nothing survived to
 * answer "how many demos ran last Tuesday, and for how long". `user_id` is
 * ON DELETE SET NULL so the row outlives the account it describes (same pattern
 * as `demo_feedback`, migration 0032).
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0044-demo-sessions.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0044-demo-sessions.ts (local)
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
    CREATE TABLE IF NOT EXISTS demo_sessions (
      id             TEXT PRIMARY KEY,
      user_id        TEXT REFERENCES user(id) ON DELETE SET NULL,
      started_at     INTEGER NOT NULL,
      last_seen_at   INTEGER NOT NULL,
      active_seconds INTEGER NOT NULL DEFAULT 0
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS demo_sessions_started_at_idx ON demo_sessions (started_at)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS demo_sessions_user_id_idx ON demo_sessions (user_id)`,
  );

  console.log('Migration 0044 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
