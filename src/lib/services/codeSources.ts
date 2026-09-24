/**
 * "Which Remnus pages rest on this file?" (P13) — the file-to-knowledge half
 * of the project map, served by `get_related_pages` with `resource`. An agent
 * asks it before changing a file, so the decision or gotcha written against
 * that file reaches it without a search.
 *
 * The answer comes from `knowledge_metadata.sources`, which calibration fills
 * with repo-relative paths. One round-trip: every labelled item and row of the
 * workspace that has sources, with its title (a calibrated workspace has a few
 * hundred), matched in memory — the match is path-aware (absolute query paths,
 * folders, line anchors), which SQL `LIKE` could not do. Cookie-free: the MCP
 * layer has already scoped the call to one workspace.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { databases, knowledgeMetadata, pages, workspaceItems } from '@/db/schema';
import { MATCH_ORDER, matchSource, normalizeQueryPath, normalizeSourcePath, type SourceMatch } from '@/lib/graph/codePaths';

export type ResourcePageRef = {
  id: string;
  title: string;
  type: 'page' | 'database' | 'database_row';
  databaseId?: string;
  match: SourceMatch;
  /** The source as the item records it. */
  source: string;
};

export type ResourcePages = {
  /** The path as it was matched (normalized), or the resource as given when it is not a path. */
  resource: string;
  pages: ResourcePageRef[];
  /** Matching items before the limit. */
  total: number;
  /** Present when no item in the workspace records a source at all — an empty answer means "unknown", not "nothing". */
  note?: string;
};

/** Default number of items returned; matches beyond it are counted in `total`. */
export const RESOURCE_PAGES_LIMIT = 25;

const plain = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();

export async function getPagesForResource(workspaceId: string, resource: string, limit = RESOURCE_PAGES_LIMIT): Promise<ResourcePages> {
  const query = normalizeQueryPath(resource);
  const hasSources = sql`json_array_length(${knowledgeMetadata.sources}) > 0`;
  const [itemRows, rowRows] = await db.batch([
    db
      .select({
        id: workspaceItems.id,
        title: workspaceItems.title,
        type: workspaceItems.type,
        databaseId: databases.id,
        sources: knowledgeMetadata.sources,
      })
      .from(knowledgeMetadata)
      .innerJoin(workspaceItems, and(eq(workspaceItems.id, knowledgeMetadata.itemId), eq(workspaceItems.workspaceId, workspaceId)))
      .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
      .where(and(eq(knowledgeMetadata.workspaceId, workspaceId), inArray(knowledgeMetadata.itemType, ['page', 'database']), hasSources)),
    db
      .select({
        id: pages.id,
        title: pages.title,
        databaseId: pages.databaseId,
        sources: knowledgeMetadata.sources,
      })
      .from(knowledgeMetadata)
      .innerJoin(pages, eq(pages.id, knowledgeMetadata.itemId))
      .innerJoin(databases, eq(databases.id, pages.databaseId))
      .innerJoin(workspaceItems, and(eq(workspaceItems.id, databases.itemId), eq(workspaceItems.workspaceId, workspaceId)))
      .where(and(eq(knowledgeMetadata.workspaceId, workspaceId), eq(knowledgeMetadata.itemType, 'database_row'), hasSources)),
  ]);

  const asked = plain(resource);
  const bestMatch = (sources: Array<{ resource: string }> | null): { match: SourceMatch; source: string } | null => {
    let best: { match: SourceMatch; source: string } | null = null;
    for (const entry of sources ?? []) {
      if (typeof entry?.resource !== 'string') continue;
      const path = normalizeSourcePath(entry.resource);
      // A URL (or anything else that is not a repo path) matches only itself.
      const match = path && query ? matchSource(query, path) : plain(entry.resource) === asked ? 'exact' : null;
      if (match && (!best || MATCH_ORDER[match] < MATCH_ORDER[best.match])) best = { match, source: entry.resource };
    }
    return best;
  };

  const found: ResourcePageRef[] = [];
  for (const row of itemRows) {
    const best = bestMatch(row.sources);
    // Dashboards carry no knowledge metadata, so only pages and databases reach here.
    if (!best || row.type === 'dashboard') continue;
    found.push({
      id: row.id,
      title: row.title,
      type: row.type,
      ...(row.type === 'database' && row.databaseId ? { databaseId: row.databaseId } : {}),
      ...best,
    });
  }
  for (const row of rowRows) {
    const best = bestMatch(row.sources);
    if (best) found.push({ id: row.id, title: row.title, type: 'database_row', databaseId: row.databaseId, ...best });
  }
  // Closest relation first; within it, the tree's own order of kinds (pages
  // and databases name areas, rows name single concepts), then by title.
  const kindOrder = { page: 0, database: 1, database_row: 2 };
  found.sort((a, b) =>
    MATCH_ORDER[a.match] - MATCH_ORDER[b.match] ||
    kindOrder[a.type] - kindOrder[b.type] ||
    a.title.localeCompare(b.title));

  return {
    resource: query ?? resource.trim(),
    pages: found.slice(0, limit),
    total: found.length,
    ...(itemRows.length + rowRows.length === 0 ? { note: 'No item in this workspace records knowledge sources yet.' } : {}),
  };
}
