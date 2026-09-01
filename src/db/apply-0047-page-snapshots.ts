/**
 * Migration 0047 — page snapshots (trash)
 *
 * Adds `page_snapshots`: a full-content copy captured immediately before every
 * delete (single or bulk, web UI or MCP) so a human can restore it from the
 * new Trash tab in Workspace Settings. Powers the `bulk_delete_pages` /
 * `bulk_move_items` MCP tools' safety net (see `.ai/FEATURE_BULK_AND_TRASH.md`).
 *
 * `reason` future-proofs the table for content-versioning ('update' rows,
 * a separate later feature) without a second migration — only 'delete' is
 * written today. `original_id` has no FK — the row it pointed at is gone by
 * the time this is read, same pattern as `deleted_items.item_id`.
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0047-page-snapshots.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0047-page-snapshots.ts (local)
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
    CREATE TABLE IF NOT EXISTS page_snapshots (
      id                 TEXT PRIMARY KEY,
      workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      reason             TEXT NOT NULL,
      original_id        TEXT NOT NULL,
      item_type          TEXT NOT NULL,
      title              TEXT NOT NULL,
      content            TEXT,
      properties         TEXT,
      schema             TEXT,
      icon               TEXT,
      icon_color         TEXT,
      parent_id          TEXT,
      database_id        TEXT,
      sort_order         INTEGER,
      content_hash       TEXT NOT NULL,
      deleted_by_kind    TEXT NOT NULL,
      deleted_by_label   TEXT NOT NULL,
      deleted_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      token_id           TEXT REFERENCES agent_tokens(id) ON DELETE SET NULL,
      oauth_token_id     TEXT REFERENCES oauth_access_tokens(id) ON DELETE SET NULL,
      created_at         INTEGER NOT NULL
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS page_snapshots_workspace_created_idx ON page_snapshots (workspace_id, created_at)`,
  );

  console.log('Migration 0047 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
