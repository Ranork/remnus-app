'use client';
import { getAllWorkspaceItems, type WorkspaceItemRow } from '@/lib/actions/workspace';

// Lightweight, cached client-side index of all linkable workspace items
// (standalone pages + databases the current user can access). Shared by the
// inline "@" page-mention suggestion and the block "Link to page" picker so
// neither needs the user to type a raw URL.
//
// DASHBOARDS ARE DELIBERATELY EXCLUDED. `page_links.to_type` only knows
// 'page' | 'database' | 'database_row', so a link to a dashboard would have to
// be recorded as one of those — a lie that `getRelatedPages` and the backlinks
// panel would then repeat. Dashboards therefore stay out of the content link
// graph in both directions: they reference databases through their spec, which
// the renderer resolves live (and shows as "source removed" when it can't),
// rather than through the graph. Revisit together if dashboards ever need
// backlinks — half-connected is the one state to avoid.

export type PageLinkItem = {
  id: string;
  title: string;
  type: 'page' | 'database';
  icon: string | null;
  iconColor: string | null;
  databaseId: string | null;
  href: string;
};

let cache: PageLinkItem[] | null = null;
let inflight: Promise<PageLinkItem[]> | null = null;
let fetchedAt = 0;
const TTL = 30_000; // 30s — keeps the picker snappy without going stale for long

export function pageLinkHref(item: { type: string; id: string; databaseId: string | null }): string {
  return item.type === 'database' ? `/db/${item.databaseId || item.id}` : `/page/${item.id}`;
}

function isLinkable(row: WorkspaceItemRow): boolean {
  return row.type === 'page' || row.type === 'database';
}

function toLinkItem(row: WorkspaceItemRow): PageLinkItem {
  return {
    id: row.id,
    title: row.title || 'Untitled',
    type: row.type as 'page' | 'database',
    icon: row.icon,
    iconColor: row.iconColor,
    databaseId: row.databaseId,
    href: pageLinkHref(row),
  };
}

async function load(): Promise<PageLinkItem[]> {
  if (cache && Date.now() - fetchedAt < TTL) return cache;
  if (inflight) return inflight;
  inflight = getAllWorkspaceItems()
    .then(rows => {
      cache = rows.filter(isLinkable).map(toLinkItem);
      fetchedAt = Date.now();
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Drop the cache so the next picker open reflects freshly created/renamed items.
export function invalidatePageLinkCache() {
  cache = null;
  fetchedAt = 0;
}

export async function searchPageItems(query: string, limit = 8): Promise<PageLinkItem[]> {
  const items = await load();
  const q = query.trim().toLowerCase();
  const matched = q
    ? items.filter(i => i.title.toLowerCase().includes(q))
    : items;
  return matched.slice(0, limit);
}
