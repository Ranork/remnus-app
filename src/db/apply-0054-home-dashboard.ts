/**
 * Migration 0054 — workspaces.home_dashboard_item_id
 *
 * The sidebar pins two buttons at the top of every project: Pano (dashboard) and the
 * knowledge map. "Pano" needs to know WHICH dashboard is the workspace's own, so
 * `workspaces` gets one nullable column pointing at a `workspace_items` row.
 *
 * Plain `ALTER TABLE ... ADD COLUMN`: rebuilding `workspaces` would drop the `search_*`
 * triggers (AI.md → Critical conventions). The column is deliberately NOT a foreign key —
 * it is validated at read time (`HOME_DASHBOARD_SQL` in services/dashboards.ts), so a
 * deleted home dashboard reads as "none" and one restored from the trash reads as home
 * again, with no bookkeeping in the delete paths.
 *
 * Backfill (idempotent, only where the column is still NULL): a workspace that has
 * EXACTLY ONE dashboard gets it as its home. That is almost always the status screen the
 * calibration built. A workspace with several is left alone — picking one would be a
 * guess; its Pano button offers to create one and they can choose later. Note this moves
 * that dashboard out of the sidebar tree and onto the pinned button.
 *
 *   npx tsx src/db/apply-0054-home-dashboard.ts                              (Turso — PRODUCTION, reads .env)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0054-home-dashboard.ts (local)
 *
 * Apply order against a deploy: run this BEFORE the new code serves traffic — the
 * workspace list query selects the column.
 */
import 'dotenv/config';

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

function target(): string {
  if (url.startsWith('file:')) return url;
  try {
    return `REMOTE ${new URL(url.replace(/^libsql:/, 'https:')).host}`;
  } catch {
    return 'REMOTE (unparseable URL)';
  }
}

async function main() {
  console.log(`Target: ${target()}`);

  const columns = await client.execute(`PRAGMA table_info(workspaces)`);
  const has = columns.rows.some((row) => String(row.name) === 'home_dashboard_item_id');
  if (has) {
    console.log('Column workspaces.home_dashboard_item_id already exists.');
  } else {
    await client.execute(`ALTER TABLE workspaces ADD COLUMN home_dashboard_item_id text`);
    console.log('Added workspaces.home_dashboard_item_id.');
  }

  const single = `
    home_dashboard_item_id IS NULL
    AND (SELECT COUNT(*) FROM workspace_items wi WHERE wi.workspace_id = workspaces.id AND wi.type = 'dashboard') = 1`;
  const candidates = await client.execute(`SELECT COUNT(*) AS n FROM workspaces WHERE ${single}`);
  console.log(`Workspaces with exactly one dashboard and no home yet: ${candidates.rows[0].n}`);

  await client.execute(`
    UPDATE workspaces
    SET home_dashboard_item_id =
      (SELECT wi.id FROM workspace_items wi WHERE wi.workspace_id = workspaces.id AND wi.type = 'dashboard')
    WHERE ${single}`);

  const summary = await client.execute(`
    SELECT
      COUNT(*) AS workspaces,
      SUM(CASE WHEN home_dashboard_item_id IS NOT NULL THEN 1 ELSE 0 END) AS with_home
    FROM workspaces`);
  console.log(`Workspaces: ${summary.rows[0].workspaces}, with a home dashboard: ${summary.rows[0].with_home}`);
  console.log('Migration 0054 applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
