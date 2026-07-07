/**
 * Content-derived link graph (page_links table) — cookie-free service.
 *
 * A page's markdown body can reference other workspace items two ways:
 *   - inline pageLink:  <a data-page-link href="/page/<id>|/db/<dbId>[/<rowId>]">…</a>
 *   - childBlock:       <div data-cb-id="<itemId>" data-cb-type="page|database" …></div>
 * (serialization formats owned by PageLinkNode.ts / ChildBlockExtension.ts).
 *
 * extractPageRefs() pulls those references out of raw markdown with regexes —
 * no Tiptap/DOM needed, so it runs in server actions, MCP handlers, and tsx
 * scripts alike. syncPageLinks() re-syncs the page_links rows for one source
 * page (delete + insert) and is called from every content write path (web
 * save actions AND MCP write tools). Both mutation helpers are best-effort:
 * a lost link-graph row degrades get_related_pages freshness, not content,
 * so failures are swallowed rather than surfaced to the caller of the save.
 *
 * Target ids are stored as-written (unresolved): a database target can appear
 * as databases.id (from a /db/<dbId> href) OR as its workspace item id (from a
 * childBlock's data-cb-id) — getRelatedPages resolves both forms at read time,
 * keeping writes lookup-free.
 */
import { db } from '@/db';
import { pageLinks } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export type PageRef = {
  toId: string;
  toType: 'page' | 'database' | 'database_row';
  linkKind: 'page_link' | 'child_block';
};

// Root-relative internal hrefs only — share links, external URLs, and the
// sanitized '#' fallback carry no graph information.
const PAGE_HREF = /^\/page\/([^/?#]+)/;
const DB_HREF = /^\/db\/([^/?#]+)(?:\/([^/?#]+))?/;

const PAGE_LINK_TAG = /<a\b[^>]*\bdata-page-link\b[^>]*>/gi;
const CHILD_BLOCK_TAG = /<div\b[^>]*\bdata-cb-id\s*=\s*"([^"]+)"[^>]*>/gi;

function attrValue(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

export function extractPageRefs(markdown: string): PageRef[] {
  if (!markdown) return [];
  const refs = new Map<string, PageRef>();
  const add = (ref: PageRef) => {
    if (!ref.toId) return;
    refs.set(`${ref.toId}|${ref.linkKind}`, ref);
  };

  for (const [tag] of markdown.matchAll(PAGE_LINK_TAG)) {
    const href = attrValue(tag, 'href');
    if (!href) continue;
    const page = href.match(PAGE_HREF);
    if (page) {
      add({ toId: page[1], toType: 'page', linkKind: 'page_link' });
      continue;
    }
    const dbMatch = href.match(DB_HREF);
    if (dbMatch) {
      add(
        dbMatch[2]
          ? { toId: dbMatch[2], toType: 'database_row', linkKind: 'page_link' }
          : { toId: dbMatch[1], toType: 'database', linkKind: 'page_link' },
      );
    }
  }

  for (const [tag, itemId] of markdown.matchAll(CHILD_BLOCK_TAG)) {
    const itemType = attrValue(tag, 'data-cb-type') === 'database' ? 'database' : 'page';
    add({ toId: itemId, toType: itemType, linkKind: 'child_block' });
  }

  return [...refs.values()];
}

/**
 * Re-sync the link-graph rows derived from one page's content: drop everything
 * previously extracted from this source, then insert the current reference set.
 * Self-references are skipped. Call whenever a page body is written; an empty
 * body simply clears the page's outgoing links.
 */
export async function syncPageLinks(
  workspaceId: string,
  fromId: string,
  fromType: 'page' | 'database_row',
  content: string,
): Promise<void> {
  try {
    const refs = extractPageRefs(content).filter(r => r.toId !== fromId);
    await db.delete(pageLinks).where(eq(pageLinks.fromId, fromId));
    if (refs.length === 0) return;
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
  } catch {
    // Swallow — see module doc comment.
  }
}

/**
 * Drop every link-graph row touching a hard-deleted item (as source or target).
 * Called best-effort from the same delete paths that write deletion tombstones.
 */
export async function removePageLinksFor(itemId: string): Promise<void> {
  try {
    await db
      .delete(pageLinks)
      .where(or(eq(pageLinks.fromId, itemId), eq(pageLinks.toId, itemId)));
  } catch {
    // Swallow — see module doc comment.
  }
}
