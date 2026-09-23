/**
 * Schema drift check — READ-ONLY.
 *
 * Compares every table, column and index declared in `src/db/schema.ts` with what the
 * target database actually has (`PRAGMA table_info` / `PRAGMA index_list`). Most
 * migrations here are hand-applied scripts outside `_journal.json`, so "which
 * migration ran where" is otherwise tracked by memory — and a table the code reads
 * that the database lacks only surfaces as a 500 in production (the 0042 incident).
 * Run it against the target before every deploy:
 *
 *   npx tsx src/scripts/check-schema-drift.ts                              (Turso — PRODUCTION, reads .env; read-only)
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/check-schema-drift.ts (local)
 *
 * Exits 1 when a declared table, column or index is missing. Extra columns/tables in
 * the database are listed but are not an error (dropped-in-code leftovers).
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  console.log(`Target: ${url.startsWith('file:') ? url : 'REMOTE (Turso)'} — read-only`);

  const tableRows = await client.execute(`select name from sqlite_master where type = 'table'`);
  const actualTables = new Set(tableRows.rows.map((r) => String(r.name)));

  const problems: string[] = [];
  const notes: string[] = [];
  const declared = new Set<string>();

  for (const value of Object.values(schema)) {
    if (!(value instanceof SQLiteTable)) continue;
    const cfg = getTableConfig(value);
    declared.add(cfg.name);

    if (!actualTables.has(cfg.name)) {
      problems.push(`missing table: ${cfg.name}`);
      continue;
    }

    const info = await client.execute(`PRAGMA table_info("${cfg.name}")`);
    const actualCols = new Set(info.rows.map((r) => String(r.name)));
    for (const col of cfg.columns) {
      if (!actualCols.has(col.name)) problems.push(`missing column: ${cfg.name}.${col.name}`);
    }
    const declaredCols = new Set(cfg.columns.map((c) => c.name));
    for (const col of actualCols) {
      if (!declaredCols.has(col)) notes.push(`extra column (not in schema.ts): ${cfg.name}.${col}`);
    }

    const indexes = await client.execute(`PRAGMA index_list("${cfg.name}")`);
    const actualIndexes = new Set(indexes.rows.map((r) => String(r.name)));
    for (const idx of cfg.indexes) {
      const name = idx.config.name;
      if (name && !actualIndexes.has(name)) problems.push(`missing index: ${cfg.name}.${name}`);
    }
  }

  for (const table of actualTables) {
    if (!declared.has(table) && !table.startsWith('sqlite_') && !table.startsWith('__') && !table.startsWith('_')) {
      notes.push(`extra table (not in schema.ts): ${table}`);
    }
  }

  for (const n of notes) console.log(`  · ${n}`);
  if (problems.length === 0) {
    console.log(`OK — all ${declared.size} declared tables, their columns and named indexes exist.`);
    return;
  }
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`${problems.length} problem(s). Apply the matching src/db/apply-00XX-*.ts script(s) before deploying.`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
