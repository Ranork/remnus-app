/**
 * Migration 0049 — agent_activity savings/latency columns
 *
 * Adds three nullable INTEGER columns to `agent_activity`:
 *   • baseline_bytes  — what the same information would have cost the naive way,
 *                       when that is exactly computable. NULL = no claim.
 *   • duration_ms     — server-side handling time of the request.
 *   • items_affected  — pages/rows one bulk call created or updated.
 *
 * Powers the savings card (see AGENTS.md → "Agent Savings Metrics"). Legacy rows
 * keep NULL in all three and are simply excluded from each metric — no backfill
 * is possible, and inventing one would be exactly the dishonesty this avoids.
 *
 * Idempotent (PRAGMA column check). Plain ALTER TABLE ADD COLUMN — no rebuild
 * (unlike 0034, which had to relax a NOT NULL).
 * Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0049-agent-metrics.ts                              (Turso — PRODUCTION)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0049-agent-metrics.ts (local)
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

async function addColumn(column: string) {
  if (await hasColumn('agent_activity', column)) {
    console.log(`agent_activity.${column} already exists — skipping`);
    return;
  }
  await client.execute(`ALTER TABLE agent_activity ADD COLUMN ${column} INTEGER`);
  console.log(`Added agent_activity.${column}`);
}

async function main() {
  console.log(`Target: ${url.startsWith('file:') ? url : 'REMOTE (Turso)'}`);
  await addColumn('baseline_bytes');
  await addColumn('duration_ms');
  await addColumn('items_affected');
  console.log('Migration 0049 applied successfully.');
}

main().catch(console.error);
