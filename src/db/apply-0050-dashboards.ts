/**
 * Migration 0050 — dashboards
 *
 * Adds `dashboards`: the 1:1 detail table for the new `dashboard` item type,
 * the same shape `standalone_pages` has for `page` items. `spec` holds the
 * versioned JSON document validated by `src/lib/dashboard/schema.ts`.
 *
 * `workspace_items.type` needs NO DDL here: the column is plain TEXT with no
 * CHECK constraint (SQLite/Drizzle enums are TS-only), so 'dashboard' is
 * already storable. The same is true of `page_snapshots.item_type` and
 * `deleted_items.item_type`, which now also accept 'dashboard'.
 *
 * Idempotent (CREATE TABLE / CREATE INDEX IF NOT EXISTS). Apply to BOTH local
 * and Turso, BEFORE deploying the code that reads/writes this table:
 *   npx tsx src/db/apply-0050-dashboards.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0050-dashboards.ts (local)
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
    CREATE TABLE IF NOT EXISTS dashboards (
      id         TEXT PRIMARY KEY,
      item_id    TEXT NOT NULL REFERENCES workspace_items(id) ON DELETE CASCADE,
      spec       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS dashboards_item_id_idx ON dashboards (item_id)`,
  );

  console.log('Migration 0050 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
