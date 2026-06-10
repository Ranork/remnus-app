/**
 * Migration 0025 — add `hidden` to workspaces
 *
 * Lets users hide workspaces (e.g. shared-docs / blog workspaces) from the sidebar by
 * default. A "Show hidden" toggle reveals them. Stored server-side so the choice persists
 * across devices/sessions.
 *
 * Idempotent (skips if the column already exists). Apply to both local and Turso:
 *   npx tsx src/db/apply-0025-workspace-hidden.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0025-workspace-hidden.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  const info = await client.execute(`PRAGMA table_info(workspaces)`);
  const hasColumn = info.rows.some(r => (r as Record<string, unknown>).name === 'hidden');

  if (hasColumn) {
    console.log('Column workspaces.hidden already exists — nothing to do.');
    return;
  }

  await client.execute(`ALTER TABLE workspaces ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`);
  console.log('Added column workspaces.hidden.');
  console.log('\nMigration 0025 applied successfully.');
}

main().catch(console.error);
