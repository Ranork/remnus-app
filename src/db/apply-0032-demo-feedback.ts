/**
 * Migration 0032 — demo feedback
 *
 * Adds `demo_feedback`: in-app feedback left by demo visitors via the "how are
 * you liking it?" prompt that fires a few minutes into a demo session
 * (sentiment + optional comment). `user_id` is ON DELETE SET NULL so feedback
 * survives the periodic demo-account cleanup and stays visible in the admin
 * dashboard.
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0032-demo-feedback.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0032-demo-feedback.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS demo_feedback (
      id          TEXT PRIMARY KEY,
      user_id     TEXT REFERENCES user(id) ON DELETE SET NULL,
      sentiment   TEXT NOT NULL,
      comment     TEXT,
      created_at  INTEGER NOT NULL
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS demo_feedback_created_at_idx ON demo_feedback (created_at)`,
  );
  console.log('Migration 0032 applied successfully.');
}

main().catch(console.error);
