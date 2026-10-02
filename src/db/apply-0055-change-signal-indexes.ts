/**
 * Migration 0055 — indexes for the live-refresh change signal (V2 R9)
 *
 * Every open tab polls `/api/activity/changes` (every 2.5 s while something is
 * happening, every 30 s otherwise), and each poll computes the newest `updated_at`
 * across the caller's workspaces (services/changeVersion.ts). That maximum used to be a
 * `max(case when typeof(col) = 'integer' …)` — an expression no index can answer — so
 * every poll read every item and every row of every database of every workspace the
 * caller belongs to, and the whole `page_comments` table (it had no workspace index).
 * The query now takes `max(col)` under a numeric upper bound (which drops the legacy
 * TEXT timestamps exactly as the CASE did), and SQLite answers a max on an index's
 * second column, under equality on the first, with one seek. These indexes make that
 * possible:
 *
 *   workspace_items   (workspace_id, updated_at)  replaces (workspace_id)
 *   standalone_pages  (item_id, updated_at)       replaces (item_id)
 *   databases         (item_id, updated_at)       replaces (item_id)
 *   pages             (database_id, updated_at)   replaces (database_id)
 *   page_comments     (workspace_id, updated_at)  new
 *
 * Each replaced index is a strict prefix of its replacement, so every query and every
 * foreign-key cascade that used it keeps an index with the same leading column, and
 * the write cost stays one index per table. Index-only: no table is rebuilt (the
 * `search_*` triggers are untouched) and no code depends on these for correctness, so
 * apply order against a deploy does not matter — before it, the new query is correct
 * but scans. Idempotent (CREATE INDEX IF NOT EXISTS / DROP INDEX IF EXISTS); prints the
 * query plans it was made for.
 *
 *   npx tsx src/db/apply-0055-change-signal-indexes.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0055-change-signal-indexes.ts (local)
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

const MIGRATION_0055 = [
  'CREATE INDEX IF NOT EXISTS workspace_items_workspace_updated_idx ON workspace_items (workspace_id, updated_at)',
  'DROP INDEX IF EXISTS workspace_items_workspace_id_idx',
  'CREATE INDEX IF NOT EXISTS standalone_pages_item_updated_idx ON standalone_pages (item_id, updated_at)',
  'DROP INDEX IF EXISTS standalone_pages_item_id_idx',
  'CREATE INDEX IF NOT EXISTS databases_item_updated_idx ON databases (item_id, updated_at)',
  'DROP INDEX IF EXISTS databases_item_id_idx',
  'CREATE INDEX IF NOT EXISTS pages_database_updated_idx ON pages (database_id, updated_at)',
  'DROP INDEX IF EXISTS pages_database_id_idx',
  'CREATE INDEX IF NOT EXISTS page_comments_workspace_updated_idx ON page_comments (workspace_id, updated_at)',
];

async function main() {
  console.log(`Target: ${target()}`);
  // Each CREATE comes before the DROP of the index it replaces, so a table is never
  // without an index on its leading column, even between two statements.
  for (const statement of MIGRATION_0055) await client.execute(statement);

  for (const probe of [
    `SELECT max(updated_at) FROM workspace_items WHERE workspace_id = 'x' AND updated_at < 100000000000`,
    `SELECT max(updated_at) FROM pages WHERE database_id = 'x' AND updated_at < 100000000000`,
    `SELECT max(updated_at) FROM page_comments WHERE workspace_id = 'x' AND updated_at < 100000000000`,
  ]) {
    const plan = await client.execute(`EXPLAIN QUERY PLAN ${probe}`);
    console.log(`Plan: ${plan.rows.map((row) => String(row.detail)).join(' | ')}`);
  }
  console.log('Migration 0055 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
