/**
 * What one live-refresh poll costs on Turso (V2 R9): rows read and query time of the
 * change signal, before and after migration 0055 + the index-friendly query.
 *
 * Runs against the **Turso DEV** database in `.env.turso-dev` (TURSO_DEV_DATABASE_URL,
 * TURSO_DEV_AUTH_TOKEN) through the HTTP pipeline API, because only Turso's own answer
 * carries `rows_read` — the number it bills and the work it does. Never the production
 * database: it refuses a URL equal to `.env`'s, refuses a database holding tables it did
 * not create, and drops everything it created at the end. Prints the host only.
 *
 *   (PowerShell — Turso hosts do not resolve from Git Bash here)
 *   $env:DATABASE_URL='file:local.db'; npm run bench:change-signal
 *
 * Seeds the shape of a multi-tenant production table set: the caller with three
 * workspaces (one large: 500 items, 2,000 rows) and 60 other tenants' workspaces, with
 * 3% legacy TEXT timestamps. Reports per poll: the old pair (membership read + the
 * CASE-max UNION) and the new single statement, on the old indexes and on 0055's, and
 * checks both answer the same version.
 */
import { readFileSync } from 'fs';
import { createClient } from '@libsql/client';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { changeSignalSql } from '@/lib/services/changeVersion';
import { CONTENT_CLOCK_BACKFILL_SQL, CONTENT_CLOCK_COLUMN_SQL, CONTENT_CLOCK_TRIGGERS } from '@/db/contentClock';

function readEnvFile(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
  );
}

const dev = readEnvFile('.env.turso-dev');
const prodUrl = readEnvFile('.env').DATABASE_URL ?? '';
const devUrl = dev.TURSO_DEV_DATABASE_URL ?? '';
const host = devUrl.replace(/^libsql:\/\//, '').replace(/^https:\/\//, '').replace(/\/.*$/, '');
if (!devUrl || devUrl === prodUrl || prodUrl.includes(host)) {
  console.error('Refusing: TURSO_DEV_DATABASE_URL is missing or points at the production database.');
  process.exit(1);
}

type Stmt = { sql: string; args?: unknown[] };
type StmtResult = { rows: unknown[][]; rows_read: number; query_duration_ms: number };

function hranaValue(v: unknown) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}

async function pipeline(stmts: Stmt[]): Promise<StmtResult[]> {
  const res = await fetch(`https://${host}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${dev.TURSO_DEV_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        ...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args ?? []).map(hranaValue) } })),
        { type: 'close' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json() as { results: Array<{ type: string; error?: { message: string }; response?: { result: { rows: Array<Array<{ value?: unknown }>>; rows_read: number; query_duration_ms: number } } }> };
  return body.results.slice(0, stmts.length).map((r, i) => {
    if (r.type !== 'ok') throw new Error(`statement ${i} failed: ${r.error?.message} — ${stmts[i].sql.slice(0, 120)}`);
    const out = r.response!.result;
    return { rows: out.rows.map((row) => row.map((c) => c.value ?? null)), rows_read: out.rows_read, query_duration_ms: out.query_duration_ms };
  });
}

// ── Schema: the tables the signal reads, copied from local.db minus foreign keys ──

const TABLES = ['workspaces', 'workspace_members', 'workspace_items', 'standalone_pages', 'databases', 'pages', 'page_comments', 'deleted_items'];
const OLD_INDEXES = [
  'CREATE INDEX IF NOT EXISTS workspace_items_workspace_id_idx ON workspace_items (workspace_id)',
  'CREATE INDEX IF NOT EXISTS standalone_pages_item_id_idx ON standalone_pages (item_id)',
  'CREATE INDEX IF NOT EXISTS databases_item_id_idx ON databases (item_id)',
  'CREATE INDEX IF NOT EXISTS pages_database_id_idx ON pages (database_id)',
  'CREATE INDEX IF NOT EXISTS page_comments_page_created_idx ON page_comments (page_id, created_at)',
  'CREATE INDEX IF NOT EXISTS deleted_items_workspace_deleted_idx ON deleted_items (workspace_id, deleted_at)',
  'CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members (user_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_unique ON workspace_members (workspace_id, user_id)',
];
// The same statements as src/db/apply-0055-change-signal-indexes.ts.
const MIGRATION_0055 = [
  'CREATE INDEX IF NOT EXISTS workspace_items_workspace_updated_idx ON workspace_items (workspace_id, updated_at)',
  'DROP INDEX IF EXISTS workspace_items_workspace_id_idx',
  'CREATE INDEX IF NOT EXISTS standalone_pages_item_updated_idx ON standalone_pages (item_id, updated_at)',
  'DROP INDEX IF EXISTS standalone_pages_item_id_idx',
  'CREATE INDEX IF NOT EXISTS databases_item_updated_idx ON databases (item_id, updated_at)',
  'DROP INDEX IF EXISTS databases_item_id_idx',
  'CREATE INDEX IF NOT EXISTS pages_database_updated_idx ON pages (database_id, updated_at)',
  'DROP INDEX IF EXISTS pages_database_id_idx',
  'CREATE INDEX IF NOT EXISTS page_comments_workspace_updated_idx ON page_comments (workspace_id, updated_at)',
];

async function localDdl(): Promise<string[]> {
  const local = createClient({ url: 'file:local.db' });
  const out: string[] = [];
  for (const name of TABLES) {
    const r = await local.execute({ sql: "select sql from sqlite_master where type = 'table' and name = ?", args: [name] });
    let ddl = String(r.rows[0].sql);
    ddl = ddl.replace(/,\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES[^,)]*\([^)]*\)(\s+ON\s+(UPDATE|DELETE)\s+(no action|cascade|set null|restrict|set default))*/gi, '');
    ddl = ddl.replace(/\s+REFERENCES\s+[`"]?\w+[`"]?\s*\([^)]*\)(\s+ON\s+(UPDATE|DELETE)\s+(no action|cascade|set null|restrict|set default))*/gi, '');
    out.push(ddl);
  }
  local.close();
  return out;
}

// ── Seed ─────────────────────────────────────────────────────────────────────

let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const NOW = Math.floor(Date.now() / 1000);
const stamp = () => (rand() < 0.03 ? '2026-06-01 10:00:00' : NOW - Math.floor(rand() * 90 * 86400));

const rows: Record<string, unknown[][]> = Object.fromEntries(TABLES.map((t) => [t, []]));
const COLS: Record<string, string[]> = {
  workspaces: ['id', 'name', 'sort_order', 'created_at', 'updated_at'],
  workspace_members: ['id', 'workspace_id', 'user_id', 'role', 'created_at'],
  workspace_items: ['id', 'workspace_id', 'type', 'title', 'parent_id', 'sort_order', 'created_at', 'updated_at'],
  standalone_pages: ['id', 'item_id', 'content', 'created_at', 'updated_at'],
  databases: ['id', 'name', 'item_id', 'schema', 'created_at', 'updated_at'],
  pages: ['id', 'database_id', 'title', 'content', 'properties', 'sort_order', 'created_at', 'updated_at'],
  page_comments: ['id', 'page_id', 'workspace_id', 'body', 'kind', 'author_kind', 'author_label', 'created_at', 'updated_at'],
  deleted_items: ['id', 'workspace_id', 'item_id', 'item_type', 'deleted_at'],
};
let n = 0;
const id = (p: string) => `${p}-${(++n).toString(36)}`;

function workspace(userId: string, size: { pages: number; dbs: number; rows: number; comments: number; tombstones: number }) {
  const ws = id('ws');
  rows.workspaces.push([ws, ws, 0, NOW - 86400 * 100, NOW - Math.floor(rand() * 86400 * 30)]);
  rows.workspace_members.push([id('m'), ws, userId, 'owner', NOW - 86400 * 100]);
  for (let i = 0; i < size.pages; i++) {
    const item = id('i');
    const t = stamp();
    rows.workspace_items.push([item, ws, 'page', 'p', null, i, t, t]);
    rows.standalone_pages.push([id('sp'), item, '', t, stamp()]);
  }
  for (let d = 0; d < size.dbs; d++) {
    const item = id('i');
    const db = id('db');
    rows.workspace_items.push([item, ws, 'database', 'd', null, d, NOW, stamp()]);
    rows.databases.push([db, 'd', item, '[]', NOW, stamp()]);
    for (let r = 0; r < size.rows / size.dbs; r++) rows.pages.push([id('r'), db, 't', '', '{}', r, NOW, stamp()]);
  }
  for (let c = 0; c < size.comments; c++) rows.page_comments.push([id('c'), 'x', ws, 'b', 'note', 'human', 'h', NOW, stamp()]);
  for (let t = 0; t < size.tombstones; t++) rows.deleted_items.push([id('t'), ws, 'x', 'page', stamp()]);
  return ws;
}

const TARGET = 'user-target';
const lockedTo = workspace(TARGET, { pages: 494, dbs: 6, rows: 2000, comments: 120, tombstones: 40 });
workspace(TARGET, { pages: 78, dbs: 2, rows: 300, comments: 20, tombstones: 5 });
workspace(TARGET, { pages: 19, dbs: 1, rows: 40, comments: 4, tombstones: 1 });
for (let t = 0; t < 60; t++) workspace(`user-${t}`, { pages: 148, dbs: 2, rows: 600, comments: 15, tombstones: 10 });

function insertStatements(): Stmt[] {
  const out: Stmt[] = [];
  for (const table of TABLES) {
    const cols = COLS[table];
    const per = Math.floor(800 / cols.length);
    for (let i = 0; i < rows[table].length; i += per) {
      const chunk = rows[table].slice(i, i + per);
      out.push({
        sql: `insert into ${table} (${cols.join(', ')}) values ${chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')}`,
        args: chunk.flat(),
      });
    }
  }
  return out;
}

// ── The two versions of the poll ─────────────────────────────────────────────

const caseMax = (col: string) => `max(case when typeof(${col}) = 'integer' then ${col} else 0 end)`;
function oldUnion(ids: string[]): Stmt {
  const inList = `(${ids.map(() => '?').join(', ')})`;
  const parts = [
    `select ${caseMax('workspace_items.updated_at')} from workspace_items where workspace_items.workspace_id in ${inList}`,
    `select ${caseMax('standalone_pages.updated_at')} from standalone_pages inner join workspace_items on standalone_pages.item_id = workspace_items.id where workspace_items.workspace_id in ${inList}`,
    `select ${caseMax('databases.updated_at')} from databases inner join workspace_items on databases.item_id = workspace_items.id where workspace_items.workspace_id in ${inList}`,
    `select ${caseMax('pages.updated_at')} from pages inner join databases on pages.database_id = databases.id inner join workspace_items on databases.item_id = workspace_items.id where workspace_items.workspace_id in ${inList}`,
    `select ${caseMax('page_comments.updated_at')} from page_comments where page_comments.workspace_id in ${inList}`,
    `select ${caseMax('deleted_items.deleted_at')} from deleted_items where deleted_items.workspace_id in ${inList}`,
    `select ${caseMax('workspaces.updated_at')} from workspaces where workspaces.id in ${inList}`,
  ];
  return { sql: parts.join(' union all '), args: parts.flatMap(() => ids) };
}

function newStatement(lock: string | null): Stmt {
  const q = new SQLiteSyncDialect().sqlToQuery(changeSignalSql(TARGET, lock));
  return { sql: q.sql, args: q.params };
}

// The R9 single statement (before 0056): one pass over every item for body, schema and
// row edits. Measured before the content clock exists, and compared against it after.
function r9Statement(lock: string | null): Stmt {
  const c = 100_000_000_000;
  const ws = lock ? 'select workspace_id as id from workspace_members where user_id = ? and workspace_id = ?' : 'select workspace_id as id from workspace_members where user_id = ?';
  return {
    sql: `with ws(id) as (${ws})
select max(m) as m, (select count(*) from ws) as n from (
  select (select max(updated_at) from workspace_items where workspace_id = ws.id and updated_at < ${c}) as m from ws
  union all select (select max(updated_at) from page_comments where workspace_id = ws.id and updated_at < ${c}) from ws
  union all select (select max(deleted_at) from deleted_items where workspace_id = ws.id and deleted_at < ${c}) from ws
  union all select max(updated_at) from workspaces where id in (select id from ws) and updated_at < ${c}
  union all select max(max(
    coalesce((select max(updated_at) from standalone_pages where item_id = i.id and updated_at < ${c}), 0),
    coalesce((select max(updated_at) from databases where item_id = i.id and updated_at < ${c}), 0),
    coalesce((select max((select max(p.updated_at) from pages p where p.database_id = d.id and p.updated_at < ${c})) from databases d where d.item_id = i.id), 0)
  )) from workspace_items i where i.workspace_id in (select id from ws)
)`,
    args: lock ? [TARGET, lock] : [TARGET],
  };
}

/** Before 0056 the R9 statement is the "new" one; after it, the content-clock statement is
 *  measured and the R9 statement only checks the version. */
let current: (lock: string | null) => Stmt = r9Statement;

async function measure(label: string, lock: string | null, runs = 5) {
  const oldReads: number[] = [], oldMs: number[] = [], newReads: number[] = [], newMs: number[] = [];
  let oldV = 0, newV = 0, newN = 0;
  for (let i = 0; i < runs; i++) {
    const [members] = await pipeline([{ sql: 'select workspace_id from workspace_members where user_id = ?', args: [TARGET] }]);
    const ids = members.rows.map((r) => String(r[0])).filter((w) => !lock || w === lock);
    const [union] = await pipeline([oldUnion(ids)]);
    oldReads.push(members.rows_read + union.rows_read);
    oldMs.push(members.query_duration_ms + union.query_duration_ms);
    oldV = Math.max(...union.rows.map((r) => Number(r[0] ?? 0)));

    const [one] = await pipeline([current(lock)]);
    newReads.push(one.rows_read);
    newMs.push(one.query_duration_ms);
    newV = Number(one.rows[0][0] ?? 0);
    newN = Number(one.rows[0][1] ?? 0);
    if (current !== r9Statement) {
      const [r9] = await pipeline([r9Statement(lock)]);
      if (Number(r9.rows[0][0] ?? 0) !== newV) oldV = -1; // reported as DIFFERS below
    }
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(`${label.padEnd(34)} old: ${String(med(oldReads)).padStart(6)} rows ${med(oldMs).toFixed(1).padStart(6)} ms, 2 round trips   new: ${String(med(newReads)).padStart(6)} rows ${med(newMs).toFixed(1).padStart(6)} ms, 1 round trip   version ${oldV === newV ? 'equal' : `DIFFERS old ${oldV} new ${newV}`} (n=${newN})`);
  return oldV === newV;
}

async function main() {
  console.log(`Turso dev database: ${host}`);
  const [existing] = await pipeline([{ sql: "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_litestream%' and name not like 'libsql_%'" }]);
  const names = existing.rows.map((r) => String(r[0]));
  const foreign = names.filter((t) => !TABLES.includes(t));
  if (foreign.length) throw new Error(`Refusing: the dev database holds tables this bench did not create (${foreign.join(', ')}).`);
  if (names.length) await pipeline(TABLES.map((t) => ({ sql: `drop table if exists ${t}` })));

  try {
    await pipeline([...(await localDdl()).map((sql) => ({ sql })), ...OLD_INDEXES.map((sql) => ({ sql }))]);
    const inserts = insertStatements();
    for (let i = 0; i < inserts.length; i += 25) await pipeline(inserts.slice(i, i + 25));
    console.log(`seeded: ${Object.entries(rows).map(([t, r]) => `${t} ${r.length}`).join(', ')}`);

    let ok = true;
    ok = (await measure('indexes before 0055, all workspaces', null)) && ok;
    ok = (await measure('indexes before 0055, project window', lockedTo)) && ok;
    await pipeline(MIGRATION_0055.map((sql) => ({ sql })));
    ok = (await measure('after 0055, all workspaces', null)) && ok;
    ok = (await measure('after 0055, project window', lockedTo)) && ok;
    if (process.env.BENCH_COVERING === '1') {
      // Variant: the items index also carries the id, so the item pass never reads the table.
      await pipeline([
        { sql: 'CREATE INDEX IF NOT EXISTS workspace_items_ws_upd_id_idx ON workspace_items (workspace_id, updated_at, id)' },
        { sql: 'DROP INDEX IF EXISTS workspace_items_workspace_updated_idx' },
      ]);
      ok = (await measure('covering (ws, updated_at, id), all', null)) && ok;
      ok = (await measure('covering (ws, updated_at, id), window', lockedTo)) && ok;
    }
    // Migration 0056: the content clock (column, triggers, backfill) — the same statements
    // as src/db/apply-0056-content-clock.ts. The bench tables are copied from local.db, so
    // the column is there when 0056 is applied locally; added here otherwise.
    const [cols] = await pipeline([{ sql: 'select name from pragma_table_info(?)', args: ['workspaces'] }]);
    if (!cols.rows.some((r) => r[0] === 'content_updated_at')) await pipeline([{ sql: CONTENT_CLOCK_COLUMN_SQL }]);
    await pipeline([...CONTENT_CLOCK_TRIGGERS.map(([, sql]) => ({ sql })), { sql: CONTENT_CLOCK_BACKFILL_SQL }]);
    current = newStatement;
    ok = (await measure('after 0056 (content clock), all', null)) && ok;
    ok = (await measure('after 0056 (content clock), window', lockedTo)) && ok;
    // A row edit through the trigger moves the clock exactly as the R9 statement sees it.
    const [rowsOf] = await pipeline([{ sql: 'select p.id from pages p join databases d on d.id = p.database_id join workspace_items wi on wi.id = d.item_id where wi.workspace_id = ? limit 1', args: [lockedTo] }]);
    await pipeline([{ sql: 'update pages set updated_at = ? where id = ?', args: [NOW + 7, String(rowsOf.rows[0][0])] }]);
    const [after] = await pipeline([newStatement(lockedTo)]);
    const [r9After] = await pipeline([r9Statement(lockedTo)]);
    const followed = Number(after.rows[0][0]) === NOW + 7 && Number(r9After.rows[0][0]) === NOW + 7;
    console.log(`row edit after 0056: clock ${followed ? 'follows the trigger' : `DIFFERS (${after.rows[0][0]} vs ${r9After.rows[0][0]})`}`);
    ok = followed && ok;

    const plan = await pipeline([{ sql: `explain query plan ${newStatement(null).sql}`, args: newStatement(null).args }]);
    console.log('plan (new, after 0055):');
    for (const row of plan[0].rows) console.log('  ', String(row[3]));
    if (!ok) process.exitCode = 1;
  } finally {
    await pipeline(TABLES.map((t) => ({ sql: `drop table if exists ${t}` })));
    console.log('dropped the bench tables');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
