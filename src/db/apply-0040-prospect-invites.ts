/**
 * Migration 0040 — prospect invites (Scout Forge gift-signup outreach)
 *
 * Adds `prospect_invites`: personalized, single-use invite links for cold
 * outreach (e.g. Scout Forge app owners). Distinct from `workspace_invites` —
 * this invites a NEW prospect into a fresh account (not an existing
 * workspace) and carries an editable snapshot of a Scout Forge app's public
 * info (name/logo/tagline) alongside a time-boxed plan grant (gift_tier for
 * gift_days, reverted by the /api/cron/prospect-gifts cron job).
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0040-prospect-invites.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0040-prospect-invites.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS prospect_invites (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      app_idstr TEXT NOT NULL,
      app_name TEXT NOT NULL,
      app_logo_url TEXT,
      app_tagline TEXT,
      app_url TEXT,
      gift_tier TEXT NOT NULL DEFAULT 'startup',
      gift_days INTEGER NOT NULL DEFAULT 30,
      link_expires_at INTEGER,
      created_by TEXT REFERENCES user(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      claimed_at INTEGER,
      claimed_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      reverted_at INTEGER
    )
  `);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS prospect_invites_token_unique ON prospect_invites(token)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS prospect_invites_app_idstr_idx ON prospect_invites(app_idstr)`);

  console.log('Migration 0040 applied successfully.');
}

main().catch(console.error);
