/**
 * Migration 0037 — user_sessions.platform
 *
 * Adds a nullable `platform` TEXT column to `user_sessions` ('web' | 'tauri';
 * null = legacy row predating this column, treated as web). Stamped once at
 * session creation by /api/activity/ping from the `remnus_platform` cookie
 * (isTauriRequest()). Powers the admin panel's desktop-usage stats (see
 * getEngagementOverview / getUserDetail in src/lib/actions/analytics.ts).
 *
 * Idempotent (PRAGMA column check). Simple ALTER TABLE ADD COLUMN — no rebuild
 * needed (unlike 0034), since this is a plain nullable column addition.
 * Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0037-user-sessions-platform.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0037-user-sessions-platform.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function hasColumn(table: string, column: string): Promise<boolean> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => r.name === column);
}

async function main() {
  if (!(await hasColumn('user_sessions', 'platform'))) {
    await client.execute(`ALTER TABLE user_sessions ADD COLUMN platform TEXT`);
    console.log('Added user_sessions.platform');
  } else {
    console.log('user_sessions.platform already exists — skipping');
  }

  console.log('Migration 0037 applied successfully.');
}

main().catch(console.error);
