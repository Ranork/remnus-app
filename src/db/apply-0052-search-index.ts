/**
 * Migration 0052 — search_index
 *
 * The full-text index behind MCP `search_workspace`: a contentless FTS5 table
 * (`search_fts`), the `search_docs` table that gives every indexed page, database,
 * dashboard and database row a stable integer rowid, and the triggers that keep
 * both in step with `workspace_items`, `standalone_pages`, `pages`, `databases`
 * and `workspaces`.
 *
 * Why triggers and not application code: every write path — web actions, MCP,
 * bulk inserts, seed, trash/version restore, OKF import, cascade deletes — reaches
 * these tables, and an index maintained from app code is one forgotten call away
 * from lying. The invariant: nothing but these triggers (and the rebuild below)
 * writes `search_docs` / `search_fts`.
 *
 * Design notes (proven on a Turso dev database on 2026-09-24 — see the P10 note in
 * .ai/AGENT_OS_ROADMAP_PROMPTS.md):
 * - Contentless (`content=''`, `contentless_delete=1`): snippets are cut from the
 *   source row, so storing the text twice bought nothing (+120% vs +28% storage).
 *   A contentless table cannot UPDATE a subset of columns, so every change is
 *   delete-by-rowid + insert of all three columns. That also self-heals a
 *   document that was somehow missing.
 * - `ws` holds 'w' + the workspace id without dashes: one token, searched as
 *   `ws : "w…"` and weighted 0 in bm25, so a query only walks its own workspace.
 * - `unicode61 remove_diacritics 2` folds case and Latin accents but keeps the
 *   dotless "ı", hence `replace(…, 'ı', 'i')` on every indexed text — the same
 *   folding `foldText` (services/textFold.ts) applies on the query side.
 * - Upserts and delete-before-insert everywhere: an index trigger must never make
 *   the user's own write fail.
 *
 * Idempotent: tables/index use IF NOT EXISTS, every trigger is dropped and
 * recreated (so re-running upgrades their definitions), and the index is rebuilt
 * from the source tables in one transaction. Re-run it any time the index is in
 * doubt. Apply to BOTH local and Turso; the code falls back to the old scan while
 * the index is absent, so order against the deploy does not matter, but apply it
 * BEFORE relying on the ranking:
 *   npx tsx src/db/apply-0052-search-index.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0052-search-index.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

/** Text as it is indexed: NULL → '', dotless ı → i (the tokenizer does the rest). */
const fold = (expr: string) => `replace(coalesce(${expr}, ''), 'ı', 'i')`;
/** The workspace filter token. */
const wsToken = (expr: string) => `'w' || replace(${expr}, '-', '')`;
/** A standalone page's body; databases and dashboards have none. */
const itemBody = (itemIdExpr: string) =>
  `(SELECT sp.content FROM standalone_pages sp WHERE sp.item_id = ${itemIdExpr} LIMIT 1)`;

/** `guard` is an extra SQL condition; trigger bodies have no IF. */
const dropDocIndex = (itemIdExpr: string, guard = '1') =>
  `DELETE FROM search_fts WHERE rowid = (SELECT id FROM search_docs WHERE item_id = ${itemIdExpr}) AND (${guard});`;

const reindexItem = (itemIdExpr: string, guard = '1') => `
    ${dropDocIndex(itemIdExpr, guard)}
    INSERT INTO search_fts (rowid, ws, title, body)
      SELECT sd.id, ${wsToken('wi.workspace_id')}, ${fold('wi.title')}, ${fold(itemBody('wi.id'))}
      FROM workspace_items wi JOIN search_docs sd ON sd.item_id = wi.id
      WHERE wi.id = ${itemIdExpr} AND (${guard});`;

const reindexRow = (rowIdExpr: string) => `
    ${dropDocIndex(rowIdExpr)}
    INSERT INTO search_fts (rowid, ws, title, body)
      SELECT sd.id, ${wsToken('sd.workspace_id')}, ${fold('p.title')}, ${fold('p.content')}
      FROM pages p JOIN search_docs sd ON sd.item_id = p.id
      WHERE p.id = ${rowIdExpr};`;

const UPSERT = `ON CONFLICT (item_id) DO UPDATE SET workspace_id = excluded.workspace_id, kind = excluded.kind`;

/** A row's document: only while its database hangs off an item (and so a workspace). */
const upsertRowDoc = (rowIdExpr: string, databaseIdExpr: string) => `
    INSERT INTO search_docs (item_id, workspace_id, kind)
      SELECT ${rowIdExpr}, wi.workspace_id, 'row'
      FROM databases d JOIN workspace_items wi ON wi.id = d.item_id
      WHERE d.id = ${databaseIdExpr}
      ${UPSERT};`;

const TRIGGERS: Array<[name: string, sql: string]> = [
  ['search_items_ai', `
    CREATE TRIGGER search_items_ai AFTER INSERT ON workspace_items BEGIN
      INSERT INTO search_docs (item_id, workspace_id, kind) VALUES (new.id, new.workspace_id, 'item') ${UPSERT};
      ${reindexItem('new.id')}
    END`],
  ['search_items_au', `
    CREATE TRIGGER search_items_au AFTER UPDATE OF title, workspace_id ON workspace_items
    WHEN new.title IS NOT old.title OR new.workspace_id IS NOT old.workspace_id BEGIN
      INSERT INTO search_docs (item_id, workspace_id, kind) VALUES (new.id, new.workspace_id, 'item') ${UPSERT};
      ${reindexItem('new.id')}
    END`],
  ['search_items_ad', `
    CREATE TRIGGER search_items_ad AFTER DELETE ON workspace_items BEGIN
      ${dropDocIndex('old.id')}
      DELETE FROM search_docs WHERE item_id = old.id;
    END`],
  ['search_body_ai', `
    CREATE TRIGGER search_body_ai AFTER INSERT ON standalone_pages BEGIN
      ${reindexItem('new.item_id')}
    END`],
  ['search_body_au', `
    CREATE TRIGGER search_body_au AFTER UPDATE OF content, item_id ON standalone_pages
    WHEN new.content IS NOT old.content OR new.item_id IS NOT old.item_id BEGIN
      ${reindexItem('old.item_id', 'old.item_id IS NOT new.item_id')}
      ${reindexItem('new.item_id')}
    END`],
  ['search_body_ad', `
    CREATE TRIGGER search_body_ad AFTER DELETE ON standalone_pages BEGIN
      ${reindexItem('old.item_id')}
    END`],
  ['search_rows_ai', `
    CREATE TRIGGER search_rows_ai AFTER INSERT ON pages BEGIN
      ${upsertRowDoc('new.id', 'new.database_id')}
      ${reindexRow('new.id')}
    END`],
  ['search_rows_au', `
    CREATE TRIGGER search_rows_au AFTER UPDATE OF title, content, database_id ON pages
    WHEN new.title IS NOT old.title OR new.content IS NOT old.content OR new.database_id IS NOT old.database_id BEGIN
      ${upsertRowDoc('new.id', 'new.database_id')}
      ${reindexRow('new.id')}
    END`],
  ['search_rows_ad', `
    CREATE TRIGGER search_rows_ad AFTER DELETE ON pages BEGIN
      ${dropDocIndex('old.id')}
      DELETE FROM search_docs WHERE item_id = old.id;
    END`],
  // A database re-linked to an item (or unlinked by ON DELETE SET NULL) moves all its
  // rows in or out of a workspace. Rare, so the whole set is simply re-derived.
  ['search_databases_au', `
    CREATE TRIGGER search_databases_au AFTER UPDATE OF item_id ON databases
    WHEN new.item_id IS NOT old.item_id BEGIN
      DELETE FROM search_fts WHERE rowid IN (
        SELECT sd.id FROM search_docs sd JOIN pages p ON p.id = sd.item_id WHERE p.database_id = new.id);
      DELETE FROM search_docs WHERE item_id IN (SELECT id FROM pages WHERE database_id = new.id);
      INSERT INTO search_docs (item_id, workspace_id, kind)
        SELECT p.id, wi.workspace_id, 'row'
        FROM pages p JOIN workspace_items wi ON wi.id = new.item_id
        WHERE p.database_id = new.id
        ${UPSERT};
      INSERT INTO search_fts (rowid, ws, title, body)
        SELECT sd.id, ${wsToken('sd.workspace_id')}, ${fold('p.title')}, ${fold('p.content')}
        FROM pages p JOIN search_docs sd ON sd.item_id = p.id
        WHERE p.database_id = new.id;
    END`],
  // Deleting a workspace cascades to its items but only SET NULLs its databases,
  // whose rows would otherwise stay indexed under the dead workspace.
  ['search_workspaces_ad', `
    CREATE TRIGGER search_workspaces_ad AFTER DELETE ON workspaces BEGIN
      DELETE FROM search_fts WHERE rowid IN (SELECT id FROM search_docs WHERE workspace_id = old.id);
      DELETE FROM search_docs WHERE workspace_id = old.id;
    END`],
];

/** Rebuild the whole index from the source tables — one transaction. */
const REBUILD = [
  `DELETE FROM search_docs WHERE kind = 'item' AND item_id NOT IN (SELECT id FROM workspace_items)`,
  `DELETE FROM search_docs WHERE kind = 'row' AND item_id NOT IN (
     SELECT p.id FROM pages p JOIN databases d ON d.id = p.database_id JOIN workspace_items wi ON wi.id = d.item_id)`,
  `INSERT INTO search_docs (item_id, workspace_id, kind)
     SELECT id, workspace_id, 'item' FROM workspace_items WHERE true ${UPSERT}`,
  `INSERT INTO search_docs (item_id, workspace_id, kind)
     SELECT p.id, wi.workspace_id, 'row'
     FROM pages p JOIN databases d ON d.id = p.database_id JOIN workspace_items wi ON wi.id = d.item_id
     WHERE true ${UPSERT}`,
  `INSERT INTO search_fts (search_fts) VALUES ('delete-all')`,
  `INSERT INTO search_fts (rowid, ws, title, body)
     SELECT sd.id, ${wsToken('wi.workspace_id')}, ${fold('wi.title')}, ${fold(itemBody('wi.id'))}
     FROM search_docs sd JOIN workspace_items wi ON wi.id = sd.item_id
     WHERE sd.kind = 'item'`,
  `INSERT INTO search_fts (rowid, ws, title, body)
     SELECT sd.id, ${wsToken('sd.workspace_id')}, ${fold('p.title')}, ${fold('p.content')}
     FROM search_docs sd JOIN pages p ON p.id = sd.item_id
     WHERE sd.kind = 'row'`,
];

function target(): string {
  if (url.startsWith('file:')) return url;
  try {
    return `REMOTE ${new URL(url.replace(/^libsql:/, 'https:')).host}`;
  } catch {
    return 'REMOTE (Turso)';
  }
}

async function main() {
  console.log(`Target: ${target()}`);

  // DDL one statement at a time: libsql's batch() can silently skip DDL (AGENTS.md → Migration Notes).
  await client.execute(`
    CREATE TABLE IF NOT EXISTS search_docs (
      id           INTEGER PRIMARY KEY,
      item_id      TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      kind         TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS search_docs_item_id_idx ON search_docs (item_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS search_docs_workspace_idx ON search_docs (workspace_id)`);
  await client.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
      ws, title, body,
      content = '', contentless_delete = 1,
      tokenize = 'unicode61 remove_diacritics 2'
    )
  `);

  // Triggers BEFORE the rebuild, so a write landing in between is indexed by them.
  for (const [name, sql] of TRIGGERS) {
    await client.execute(`DROP TRIGGER IF EXISTS ${name}`);
    await client.execute(sql);
  }

  const started = Date.now();
  await client.batch(REBUILD, 'write');
  const [docs] = (await client.execute('SELECT count(*) AS n FROM search_docs')).rows;
  console.log(`Index rebuilt: ${docs.n} documents in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  console.log('Migration 0052 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
