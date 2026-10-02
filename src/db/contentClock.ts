/**
 * The workspace content clock (migration 0056, V2 R9.8).
 *
 * `workspaces.content_updated_at` is the newest `updated_at` (epoch seconds) of any
 * page body, database or database row in the workspace. SQLite triggers keep it current
 * on every insert and every `updated_at` change, whichever code path writes — web
 * action, MCP, bulk, share, recurrence, import, seed — so no write path has to remember
 * it. The live-refresh change signal (services/changeVersion.ts) reads one row per
 * workspace instead of seeking every item's body, database and rows on each poll.
 *
 * Same rule as the 0052 `search_*` triggers: a migration that rebuilds
 * `standalone_pages`, `databases`, `pages` or `workspaces` drops these triggers, so run
 * `src/db/apply-0056-content-clock.ts` again afterwards (`npm run db:drift` reports a
 * missing one). Shared by the apply script and `bench:change-signal`.
 */

/** Epoch seconds: the year 5138. Legacy TEXT timestamps and ms values stay out, as in changeVersion.ts. */
const CEILING = 100_000_000_000;

export const CONTENT_CLOCK_COLUMN_SQL = 'ALTER TABLE workspaces ADD COLUMN content_updated_at integer';

// The workspace a written row belongs to.
const BODY_WORKSPACE = 'SELECT workspace_id FROM workspace_items WHERE id = NEW.item_id';
const ROW_WORKSPACE = 'SELECT wi.workspace_id FROM databases d JOIN workspace_items wi ON wi.id = d.item_id WHERE d.id = NEW.database_id';

function trigger(name: string, event: string, table: string, workspaceOf: string): string {
  // Moves forward only, so a burst of writes in the same second updates the row once.
  return `CREATE TRIGGER IF NOT EXISTS ${name} AFTER ${event} ON ${table}
WHEN typeof(NEW.updated_at) = 'integer' AND NEW.updated_at < ${CEILING}
BEGIN
  UPDATE workspaces SET content_updated_at = NEW.updated_at
  WHERE id = (${workspaceOf})
    AND (content_updated_at IS NULL OR content_updated_at < NEW.updated_at);
END`;
}

export const CONTENT_CLOCK_TRIGGERS: Array<[name: string, sql: string]> = [
  ['content_clock_body_ai', trigger('content_clock_body_ai', 'INSERT', 'standalone_pages', BODY_WORKSPACE)],
  ['content_clock_body_au', trigger('content_clock_body_au', 'UPDATE OF updated_at', 'standalone_pages', BODY_WORKSPACE)],
  ['content_clock_databases_ai', trigger('content_clock_databases_ai', 'INSERT', 'databases', BODY_WORKSPACE)],
  ['content_clock_databases_au', trigger('content_clock_databases_au', 'UPDATE OF updated_at', 'databases', BODY_WORKSPACE)],
  ['content_clock_rows_ai', trigger('content_clock_rows_ai', 'INSERT', 'pages', ROW_WORKSPACE)],
  ['content_clock_rows_au', trigger('content_clock_rows_au', 'UPDATE OF updated_at', 'pages', ROW_WORKSPACE)],
];

/**
 * Sets each workspace's clock from the rows already there — the same maximum the change
 * signal computed before 0056. Idempotent: it only ever moves a clock forward, so running
 * it again (or after the triggers have advanced a clock) changes nothing.
 */
export const CONTENT_CLOCK_BACKFILL_SQL = `UPDATE workspaces SET content_updated_at = max(coalesce(content_updated_at, 0), coalesce((
  SELECT max(max(
    coalesce((SELECT max(updated_at) FROM standalone_pages WHERE item_id = i.id AND updated_at < ${CEILING}), 0),
    coalesce((SELECT max(updated_at) FROM databases WHERE item_id = i.id AND updated_at < ${CEILING}), 0),
    coalesce((SELECT max((SELECT max(p.updated_at) FROM pages p WHERE p.database_id = d.id AND p.updated_at < ${CEILING}))
              FROM databases d WHERE d.item_id = i.id), 0)
  ))
  FROM workspace_items i WHERE i.workspace_id = workspaces.id
), 0))`;
