/**
 * Migration 0046 — refresh token rotation grace window
 *
 * Adds `replaced_by_token_id` / `replaced_at` to `oauth_access_tokens`. Set together
 * when a refresh grant rotates a row away (instead of only `revoked_at`), so
 * handleRefreshToken can tell a same-refresh-token replay within a short grace
 * window (a legitimate concurrent client instance losing the rotation race) apart
 * from a stale reuse well after (treated as token theft per OAuth 2.1 §4.13.2 —
 * the whole rotation chain is revoked). See .ai/FIX_OAUTH_FOLLOWUP.md §3.
 *
 * No FK on replaced_by_token_id — same loosely-referenced pattern as
 * agent_activity.workspace_id / page_comments.page_id elsewhere in this schema.
 *
 * Idempotent (PRAGMA table_info guards before each ADD COLUMN, ADD COLUMN has no
 * IF NOT EXISTS form). Apply to BOTH local and Turso, BEFORE deploying the code
 * that reads/writes these columns:
 *   npx tsx src/db/apply-0046-refresh-rotation-grace.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0046-refresh-rotation-grace.ts (local)
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

  if (!(await hasColumn('oauth_access_tokens', 'replaced_by_token_id'))) {
    await client.execute(`ALTER TABLE oauth_access_tokens ADD COLUMN replaced_by_token_id TEXT`);
  }
  if (!(await hasColumn('oauth_access_tokens', 'replaced_at'))) {
    await client.execute(`ALTER TABLE oauth_access_tokens ADD COLUMN replaced_at INTEGER`);
  }

  console.log('Migration 0046 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
