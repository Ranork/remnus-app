/**
 * Migration 0033 — mailing (AWS SES)
 *
 * Adds:
 *   - `email_campaigns`: admin-composed newsletters (markdown body, draft →
 *     sending → sent lifecycle, sent/failed counters).
 *   - `email_log`: one row per sent/failed email — idempotency guard for the
 *     one-shot lifecycle emails (welcome / agent_nudge / agent_connected /
 *     inactivity) + the admin dashboard's send history. `user_id` is
 *     ON DELETE SET NULL so history survives user/demo cleanup.
 *   - `user.email_unsubscribed_at` (user clicked unsubscribe — mutes all but
 *     the transactional welcome) and `user.email_suppressed`
 *     ('bounced'|'complained', written by the SES→SNS webhook — mutes all).
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS + PRAGMA column checks).
 * Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0033-mailing.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0033-mailing.ts (local)
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
  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id              TEXT PRIMARY KEY,
      subject         TEXT NOT NULL,
      preheader       TEXT,
      body_md         TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'draft',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      sent_count      INTEGER NOT NULL DEFAULT 0,
      failed_count    INTEGER NOT NULL DEFAULT 0,
      created_by      TEXT REFERENCES user(id) ON DELETE SET NULL,
      created_at      INTEGER NOT NULL,
      sent_at         INTEGER
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT REFERENCES user(id) ON DELETE SET NULL,
      email       TEXT NOT NULL,
      kind        TEXT NOT NULL,
      campaign_id TEXT REFERENCES email_campaigns(id) ON DELETE SET NULL,
      subject     TEXT NOT NULL,
      status      TEXT NOT NULL,
      error       TEXT,
      created_at  INTEGER NOT NULL
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS email_log_user_kind_idx ON email_log (user_id, kind)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON email_log (created_at)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS email_log_campaign_id_idx ON email_log (campaign_id)`,
  );

  if (!(await hasColumn('user', 'email_unsubscribed_at'))) {
    await client.execute(`ALTER TABLE user ADD COLUMN email_unsubscribed_at INTEGER`);
    console.log('Added user.email_unsubscribed_at');
  }
  if (!(await hasColumn('user', 'email_suppressed'))) {
    await client.execute(`ALTER TABLE user ADD COLUMN email_suppressed TEXT`);
    console.log('Added user.email_suppressed');
  }

  console.log('Migration 0033 applied successfully.');
}

main().catch(console.error);
