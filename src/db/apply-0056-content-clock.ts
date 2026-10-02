/**
 * Migration 0056 — the workspace content clock (V2 R9.8)
 *
 * Every open tab polls the change signal (services/changeVersion.ts). After 0055 the
 * only part of that poll still growing with the workspace was "the newest body, database
 * or row edit": one seek per item into standalone_pages, databases and pages, because
 * those tables carry no workspace_id (~1,500 of the 1,866 rows a 500-item workspace read
 * per poll). This adds `workspaces.content_updated_at`, keeps it current with triggers
 * (src/db/contentClock.ts — every write path, nothing to remember in code) and backfills
 * it from the rows already there. The signal then reads one row per workspace.
 *
 * Additive: ADD COLUMN (no table rebuild, the `search_*` triggers are untouched), six
 * triggers, and a backfill that only moves a clock forward. Idempotent — safe to run
 * again, and must be run again after any migration that rebuilds standalone_pages,
 * databases, pages or workspaces. Apply BEFORE deploying the code that reads the
 * column; the old code ignores it.
 *
 *   npx tsx src/db/apply-0056-content-clock.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0056-content-clock.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';
import { CONTENT_CLOCK_BACKFILL_SQL, CONTENT_CLOCK_COLUMN_SQL, CONTENT_CLOCK_TRIGGERS } from './contentClock';

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

async function main() {
  console.log(`Target: ${target()}`);
  const columns = await client.execute('PRAGMA table_info(workspaces)');
  if (columns.rows.some((row) => row.name === 'content_updated_at')) console.log('Column content_updated_at already present.');
  else {
    await client.execute(CONTENT_CLOCK_COLUMN_SQL);
    console.log('Added workspaces.content_updated_at.');
  }
  // Triggers first, then the backfill: a write landing in between is caught by both.
  for (const [, statement] of CONTENT_CLOCK_TRIGGERS) await client.execute(statement);
  const backfill = await client.execute(CONTENT_CLOCK_BACKFILL_SQL);
  console.log(`Triggers: ${CONTENT_CLOCK_TRIGGERS.length}. Backfill touched ${backfill.rowsAffected} workspace(s).`);
  console.log('Migration 0056 applied successfully.');
}

main().catch((err) => {
  console.error('Migration 0056 failed:', err);
  process.exit(1);
});
