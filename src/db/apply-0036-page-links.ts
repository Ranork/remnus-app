/**
 * Migration 0036 — page_links (content-derived link graph)
 *
 * Adds `page_links`: one row per pageLink (<a data-page-link>) or childBlock
 * (<div data-cb-id>) reference found in a page's markdown body. Kept in sync
 * on every content write by syncPageLinks() (src/lib/services/pageLinks.ts);
 * existing content is backfilled by src/db/backfill-page-links.ts. Powers the
 * MCP get_related_pages tool (Faz 3 of the token-efficiency roadmap) —
 * outgoing links + backlinks without re-reading page bodies.
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS). Apply to BOTH local and Turso:
 *   npx tsx src/db/apply-0036-page-links.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/apply-0036-page-links.ts (local)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL!;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(url.startsWith('file:') ? { url } : { url, authToken });

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS page_links (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      from_id      TEXT NOT NULL,
      from_type    TEXT NOT NULL,
      to_id        TEXT NOT NULL,
      to_type      TEXT NOT NULL,
      link_kind    TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS page_links_from_idx ON page_links (from_id)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS page_links_to_idx ON page_links (to_id)`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS page_links_from_to_kind_idx ON page_links (from_id, to_id, link_kind)`,
  );
  console.log('Migration 0036 applied successfully.');
}

main().catch(console.error);
