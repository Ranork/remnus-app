/**
 * Migration 0041 — prospect invite funnel tracking
 *
 * Adds `first_opened_at` (nullable) and `open_count` (default 0) to
 * `prospect_invites`, so the admin dashboard can show a real
 * Created → Opened → Claimed funnel instead of just Created/Claimed/Reverted.
 * Recorded from the public /welcome/[token] read path, best-effort.
 *
 * SQLite supports ALTER TABLE ADD COLUMN directly. Idempotent guard: checks
 * pragma table_info first since ADD COLUMN has no IF NOT EXISTS form and
 * would error on a second run otherwise. Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0041-prospect-invite-opens.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0041-prospect-invite-opens.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function hasColumn(table: string, column: string): Promise<boolean> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((row) => row.name === column);
}

async function main() {
  if (!(await hasColumn('prospect_invites', 'first_opened_at'))) {
    await client.execute(`ALTER TABLE prospect_invites ADD COLUMN first_opened_at INTEGER`);
  }
  if (!(await hasColumn('prospect_invites', 'open_count'))) {
    await client.execute(`ALTER TABLE prospect_invites ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0`);
  }

  console.log('Migration 0041 applied successfully.');
}

main().catch(console.error);
