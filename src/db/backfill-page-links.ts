/**
 * Backfill — page_links (content-derived link graph, migration 0036)
 *
 * Walks every existing page body (standalone_pages + database rows in pages)
 * and re-syncs its page_links rows via the same extractPageRefs() used on the
 * live write paths — so pages saved before migration 0036 show up in the MCP
 * get_related_pages graph too.
 *
 * Idempotent (each source's rows are deleted + re-inserted, so a second run
 * converges to the same state). Run AFTER apply-0036-page-links.ts, on BOTH:
 *   npx tsx src/db/backfill-page-links.ts                              (Turso)
 *   DATABASE_URL="file:local.db" npx tsx src/db/backfill-page-links.ts (local)
 *
 * NOTE the `import 'dotenv/config'` below MUST stay the FIRST import: tsx runs
 * this file as ESM, where all imports are hoisted above statements — a
 * `dotenv.config()` *call* would run only after '@/db' has already initialized
 * its client with DATABASE_URL unset and silently fallen back to file:local.db.
 * (Bit us on 2026-07-07: a "Turso" backfill actually wrote to local.db.)
 * 'dotenv/config' runs during import evaluation, in import order, so it wins.
 */
import 'dotenv/config';

import { db } from '@/db';
import { workspaceItems, standalonePages, databases, pages, pageLinks } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { extractPageRefs } from '@/lib/services/pageLinks';

// Only bodies that can contain a reference at all — skips the bulk of rows.
const HAS_REF = (col: any) =>
  sql`(${col} LIKE '%data-page-link%' OR ${col} LIKE '%data-cb-id%')`;

async function syncOne(
  workspaceId: string,
  fromId: string,
  fromType: 'page' | 'database_row',
  content: string,
): Promise<number> {
  const refs = extractPageRefs(content).filter(r => r.toId !== fromId);
  await db.delete(pageLinks).where(eq(pageLinks.fromId, fromId));
  if (refs.length === 0) return 0;
  const now = new Date();
  await db.insert(pageLinks).values(
    refs.map(r => ({
      workspaceId,
      fromId,
      fromType,
      toId: r.toId,
      toType: r.toType,
      linkKind: r.linkKind,
      createdAt: now,
    })),
  );
  return refs.length;
}

async function main() {
  let sources = 0;
  let links = 0;

  const standalone = await db
    .select({
      itemId: standalonePages.itemId,
      workspaceId: workspaceItems.workspaceId,
      content: standalonePages.content,
    })
    .from(standalonePages)
    .innerJoin(workspaceItems, eq(standalonePages.itemId, workspaceItems.id))
    .where(HAS_REF(standalonePages.content));

  for (const p of standalone) {
    const n = await syncOne(p.workspaceId, p.itemId, 'page', p.content);
    if (n > 0) {
      sources++;
      links += n;
    }
  }

  const rows = await db
    .select({
      id: pages.id,
      workspaceId: workspaceItems.workspaceId,
      content: pages.content,
    })
    .from(pages)
    .innerJoin(databases, eq(pages.databaseId, databases.id))
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(HAS_REF(pages.content));

  for (const r of rows) {
    const n = await syncOne(r.workspaceId, r.id, 'database_row', r.content);
    if (n > 0) {
      sources++;
      links += n;
    }
  }

  console.log(`Backfill complete: ${links} link(s) extracted from ${sources} page(s).`);
}

main().catch(console.error);
