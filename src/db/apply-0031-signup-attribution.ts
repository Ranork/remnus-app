/**
 * Migration 0031 — first-touch signup attribution
 *
 * Adds nullable acquisition-attribution columns to `user`, copied off the
 * `remnus_first_touch` cookie at signup (createUser event) so the admin
 * dashboard can break new users down by channel without depending on PostHog:
 *   - signup_ref          raw `?ref=` param (e.g. `scoutforge`)
 *   - signup_utm_source   / _medium / _campaign
 *   - signup_referrer     document.referrer at first touch
 *
 * Idempotent (PRAGMA column check per column). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0031-signup-attribution.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0031-signup-attribution.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function columnExists(table: string, column: string): Promise<boolean> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => (r as Record<string, unknown>).name === column);
}

const COLUMNS = [
  'signup_ref',
  'signup_utm_source',
  'signup_utm_medium',
  'signup_utm_campaign',
  'signup_referrer',
];

async function main() {
  let added = 0;
  for (const col of COLUMNS) {
    if (await columnExists('user', col)) continue;
    await client.execute(`ALTER TABLE user ADD COLUMN ${col} TEXT`);
    added++;
  }
  console.log(
    added === 0
      ? 'Migration 0031 already applied (all attribution columns exist).'
      : `Migration 0031 applied successfully (${added} column(s) added).`,
  );
}

main().catch(console.error);
