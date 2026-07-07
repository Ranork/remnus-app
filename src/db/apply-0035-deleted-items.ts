/**
 * Migration 0035 — deleted items (tombstones for MCP delta-sync)
 *
 * Adds `deleted_items`: one row per hard-deleted page/database/database-row,
 * written best-effort alongside the existing delete paths (services/workspace.ts
 * deleteItemFromWorkspace, actions/workspace.ts deleteWorkspaceItemRecursive,
 * actions/page.ts deletePage). Without this, the get_changes_since MCP tool
 * (Faz 2 of the token-efficiency roadmap) has no way to tell a recurring agent
 * that something it previously saw is now gone — it would just silently
 * disappear from every future response.
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0035-deleted-items.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0035-deleted-items.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS deleted_items (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      item_id      TEXT NOT NULL,
      item_type    TEXT NOT NULL,
      title        TEXT,
      deleted_at   INTEGER NOT NULL
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS deleted_items_workspace_deleted_idx ON deleted_items (workspace_id, deleted_at)`,
  );
  console.log('Migration 0035 applied successfully.');
}

main().catch(console.error);
