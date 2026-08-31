/**
 * Migration 0045 — page comments
 *
 * Adds `page_comments`: a time-ordered comment thread attached to a standalone
 * page or database row, separate from its markdown body. Both humans and
 * agents can write; agent comments are append-only (no update/delete tool) so
 * the thread stays a record of what an agent did rather than editable prose.
 *
 * `page_id` has no FK — it can point at either `standalone_pages`/`workspace_items`
 * or `pages` (database rows), same pattern as `agent_activity.workspace_id`.
 * `author_label` is denormalized at write time so the byline survives token
 * revocation (`token_id`/`oauth_token_id` are ON DELETE SET NULL).
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0045-page-comments.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0045-page-comments.ts (local)
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
    CREATE TABLE IF NOT EXISTS page_comments (
      id              TEXT PRIMARY KEY,
      page_id         TEXT NOT NULL,
      workspace_id    TEXT NOT NULL,
      body            TEXT NOT NULL,
      kind            TEXT NOT NULL DEFAULT 'note',
      author_kind     TEXT NOT NULL,
      author_user_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
      author_label    TEXT NOT NULL,
      token_id        TEXT REFERENCES agent_tokens(id) ON DELETE SET NULL,
      oauth_token_id  TEXT REFERENCES oauth_access_tokens(id) ON DELETE SET NULL,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS page_comments_page_created_idx ON page_comments (page_id, created_at)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS page_comments_workspace_id_idx ON page_comments (workspace_id)`,
  );

  console.log('Migration 0045 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
