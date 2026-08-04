/**
 * Migration 0039 — canonical knowledge metadata + context policy/runtime.
 *
 * Adds:
 * - knowledge_metadata: first-class OKF-aligned metadata for native content
 * - knowledge_reviews: authenticated reviews bound to a content hash
 * - workspace_context_policies: manual/smart/strict context behavior
 * - context_runs: short-lived prepare_context preflight handles
 *
 * Idempotent. Apply to BOTH local and Turso before deploying code that reads
 * these tables:
 *   npx tsx src/db/apply-0039-knowledge-context.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0039-knowledge-context.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS knowledge_metadata (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('page', 'database', 'database_row')),
      concept_type TEXT,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      sources TEXT NOT NULL DEFAULT '[]',
      status TEXT CHECK (status IN ('draft', 'stable', 'deprecated')),
      stale_after TEXT,
      owner_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      generated_by TEXT,
      generated_at INTEGER,
      external_verified TEXT NOT NULL DEFAULT '[]',
      external_frontmatter TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS knowledge_metadata_workspace_item_unique
      ON knowledge_metadata (workspace_id, item_id, item_type)`,
    `CREATE INDEX IF NOT EXISTS knowledge_metadata_workspace_status_idx
      ON knowledge_metadata (workspace_id, status)`,
    `CREATE INDEX IF NOT EXISTS knowledge_metadata_owner_idx
      ON knowledge_metadata (owner_user_id)`,
    `CREATE TABLE IF NOT EXISTS knowledge_reviews (
      id TEXT PRIMARY KEY,
      metadata_id TEXT NOT NULL REFERENCES knowledge_metadata(id) ON DELETE CASCADE,
      reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      revoked_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS knowledge_reviews_metadata_idx
      ON knowledge_reviews (metadata_id, reviewed_at)`,
    `CREATE INDEX IF NOT EXISTS knowledge_reviews_reviewer_idx
      ON knowledge_reviews (reviewer_user_id)`,
    `CREATE TABLE IF NOT EXISTS workspace_context_policies (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'smart' CHECK (mode IN ('manual', 'smart', 'strict')),
      auto_max_tokens INTEGER NOT NULL DEFAULT 2000,
      trust_policy TEXT NOT NULL DEFAULT 'prefer-human-reviewed'
        CHECK (trust_policy IN ('any', 'prefer-human-reviewed', 'human-reviewed-only')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS context_runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      token_id TEXT REFERENCES agent_tokens(id) ON DELETE CASCADE,
      oauth_token_id TEXT REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
      owner_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      task_hash TEXT NOT NULL,
      concept_set_hash TEXT NOT NULL,
      knowledge_revision TEXT NOT NULL,
      trust_policy TEXT NOT NULL,
      estimated_tokens INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS context_runs_workspace_created_idx
      ON context_runs (workspace_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS context_runs_token_expires_idx
      ON context_runs (token_id, expires_at)`,
    `CREATE INDEX IF NOT EXISTS context_runs_oauth_expires_idx
      ON context_runs (oauth_token_id, expires_at)`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_metadata_delete_workspace_item
      AFTER DELETE ON workspace_items
      BEGIN
        DELETE FROM knowledge_metadata
        WHERE workspace_id = OLD.workspace_id AND item_id = OLD.id;
      END`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_metadata_delete_database_row
      AFTER DELETE ON pages
      BEGIN
        DELETE FROM knowledge_metadata WHERE item_id = OLD.id AND item_type = 'database_row';
      END`,
  ], 'write');

  console.log('Migration 0039 applied successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
