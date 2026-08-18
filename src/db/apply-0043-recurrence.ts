/**
 * Migration 0043 — recurring calendar cards
 *
 * Adds:
 *   • `recurrence_series` — one row per repeating rule + the template its
 *     occurrences are stamped from. A "this and following" edit inserts a NEW
 *     series pointing back via `parent_series_id` rather than mutating the
 *     old rule, which is what keeps already-materialized past cards frozen.
 *   • `pages.series_id` / `pages.occurrence_date` / `pages.series_detached` —
 *     an occurrence is a real row, so the link lives on `pages`. Dedicated
 *     columns, not `properties` keys: system state must not leak into Table
 *     columns, exports, filters or MCP row reads (same call as `card_collapsed`).
 *
 * The unique index on (series_id, occurrence_date) is what makes top-up
 * idempotent — the read-triggered and cron materializers can race without
 * producing duplicate cards. SQLite treats NULLs as distinct in a unique index,
 * so the (NULL, NULL) pair every non-recurring row carries never collides.
 *
 * Idempotent: every statement is guarded, since ADD COLUMN has no IF NOT EXISTS
 * form. Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0043-recurrence.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0043-recurrence.ts (local)
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
  console.log(`Target: ${url.startsWith('file:') ? url : 'REMOTE (Turso)'}`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS recurrence_series (
      id                 TEXT PRIMARY KEY,
      database_id        TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
      date_col_id        TEXT NOT NULL,
      rule               TEXT NOT NULL,
      template           TEXT NOT NULL,
      materialized_until TEXT,
      parent_series_id   TEXT,
      created_by         TEXT,
      created_at         INTEGER NOT NULL,
      updated_at         INTEGER NOT NULL
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS recurrence_series_database_id_idx ON recurrence_series (database_id)`,
  );

  if (!(await hasColumn('pages', 'series_id'))) {
    await client.execute(`ALTER TABLE pages ADD COLUMN series_id TEXT`);
  }
  if (!(await hasColumn('pages', 'occurrence_date'))) {
    await client.execute(`ALTER TABLE pages ADD COLUMN occurrence_date TEXT`);
  }
  if (!(await hasColumn('pages', 'series_detached'))) {
    await client.execute(`ALTER TABLE pages ADD COLUMN series_detached INTEGER NOT NULL DEFAULT 0`);
  }

  await client.execute(`CREATE INDEX IF NOT EXISTS pages_series_id_idx ON pages (series_id)`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS pages_series_occurrence_idx ON pages (series_id, occurrence_date)`,
  );

  console.log('Migration 0043 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
