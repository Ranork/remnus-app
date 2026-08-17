/**
 * Migration 0042 — per-card collapse state for Kanban/Calendar
 *
 * Adds `card_collapsed` (boolean, default false) to `pages`, so a Kanban/
 * Calendar card can be collapsed to just its title (hiding the property list)
 * and have that stick across reloads instead of resetting every time.
 *
 * SQLite supports ALTER TABLE ADD COLUMN directly. Idempotent guard: checks
 * pragma table_info first since ADD COLUMN has no IF NOT EXISTS form and
 * would error on a second run otherwise. Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0042-page-card-collapsed.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0042-page-card-collapsed.ts (local)
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
  if (!(await hasColumn('pages', 'card_collapsed'))) {
    await client.execute(`ALTER TABLE pages ADD COLUMN card_collapsed INTEGER NOT NULL DEFAULT 0`);
  }

  console.log('Migration 0042 applied successfully.');
}

main().catch(console.error);
