/**
 * One-time cleanup: content left behind by workspaces deleted before
 * `deleteWorkspaceData` (src/lib/services/workspaceDeletion.ts, 2026-09-24).
 *
 * Every workspace-deletion path used to run a bare `DELETE FROM workspaces`.
 * `databases.item_id` is ON DELETE SET NULL, so each deleted workspace left its
 * databases behind with a NULL item, together with their rows (`pages`: titles,
 * bodies, properties) and recurrence series; `page_comments.workspace_id` has no
 * FK, so comments stayed too. Nothing in the app can reach them — but it is
 * user content that a delete (and a GDPR account deletion) promised to remove.
 *
 * What counts as left behind — and nothing else:
 *   - a database whose item is NULL or no longer exists (every create path writes
 *     the item first and the item-delete paths delete the database first, so a
 *     live database never has a NULL item);
 *   - rows and recurrence series of those databases, or of no database at all;
 *   - comments of a workspace that no longer exists.
 * Rows younger than GRACE_MINUTES are skipped anyway: deletion is irreversible.
 *
 * Default is a DRY RUN (counts only; no titles or bodies are printed). Deleting
 * needs `--apply`; it runs as one batch (all-or-nothing) and recounts after.
 *   DATABASE_URL="file:local.db" npx tsx src/db/cleanup-orphaned-workspace-data.ts            (local, dry run)
 *   DATABASE_URL="file:local.db" npx tsx src/db/cleanup-orphaned-workspace-data.ts --apply    (local)
 *   npx tsx src/db/cleanup-orphaned-workspace-data.ts                                          (Turso PRODUCTION, reads .env — dry run)
 *   npx tsx src/db/cleanup-orphaned-workspace-data.ts --apply                                  (Turso PRODUCTION — only with approval)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });
const APPLY = process.argv.includes('--apply');
const GRACE_MINUTES = 10;

function target(): string {
  if (url.startsWith('file:')) return url;
  try {
    return `REMOTE ${new URL(url.replace(/^libsql:/, 'https:')).host}`;
  } catch {
    return 'REMOTE (unparseable URL)';
  }
}

// Legacy rows may hold CURRENT_TIMESTAMP text instead of epoch seconds.
const epoch = (column: string) => `(case when typeof(${column}) = 'integer' then ${column} else unixepoch(${column}) end)`;
const olderThanGrace = (column: string) => `${epoch(column)} < unixepoch('now') - ${GRACE_MINUTES * 60}`;

const ORPHAN_DATABASES = `
  select id from databases
  where (item_id is null or item_id not in (select id from workspace_items))
    and ${olderThanGrace('updated_at')}`;
const ORPHAN_ROWS_WHERE = `
  (database_id in (${ORPHAN_DATABASES}) or database_id not in (select id from databases))`;
const ORPHAN_COMMENTS_WHERE = `
  workspace_id not in (select id from workspaces) and ${olderThanGrace('created_at')}`;

async function count() {
  const result = await client.batch([
    `select count(*) as n from (${ORPHAN_DATABASES})`,
    `select count(*) as n, coalesce(sum(length(content)), 0) as chars from pages where ${ORPHAN_ROWS_WHERE}`,
    `select count(*) as n from recurrence_series where ${ORPHAN_ROWS_WHERE}`,
    `select count(*) as n, coalesce(sum(length(body)), 0) as chars from page_comments where ${ORPHAN_COMMENTS_WHERE}`,
  ], 'read');
  const [dbs, rows, series, comments] = result.map((r) => r.rows[0]);
  return {
    databases: Number(dbs.n),
    rows: Number(rows.n),
    rowBodyChars: Number(rows.chars),
    recurrenceSeries: Number(series.n),
    comments: Number(comments.n),
    commentChars: Number(comments.chars),
  };
}

async function main() {
  console.log(`Target: ${target()}`);
  console.log(`Mode:   ${APPLY ? 'APPLY (deletes, irreversible)' : 'dry run (counts only)'}`);
  const before = await count();
  console.log('Left behind by deleted workspaces:', before);

  if (!APPLY) {
    console.log('Nothing deleted. Re-run with --apply to delete exactly these.');
    return;
  }
  if (before.databases + before.rows + before.recurrenceSeries + before.comments === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Children first, so the result does not depend on the foreign_keys pragma.
  await client.batch([
    `delete from recurrence_series where ${ORPHAN_ROWS_WHERE}`,
    `delete from pages where ${ORPHAN_ROWS_WHERE}`,
    `delete from databases where id in (${ORPHAN_DATABASES})`,
    `delete from page_comments where ${ORPHAN_COMMENTS_WHERE}`,
  ], 'write');

  console.log('After:', await count());
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
