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
import { pageLinks, pages, standalonePages } from '@/db/schema';
import { eq, inArray, or } from 'drizzle-orm';

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
export async function removePageLinksFor(itemId: string | string[]): Promise<void> {
  const ids = (Array.isArray(itemId) ? itemId : [itemId]).filter(Boolean);
  if (ids.length === 0) return;
  try {
    await db
      .delete(pageLinks)
      .where(or(inArray(pageLinks.fromId, ids), inArray(pageLinks.toId, ids)));
  } catch {
    // Swallow — see module doc comment.
  }
}

/** True when an internal href points at any of `ids` (page, database, or row). */
function hrefTargets(href: string, ids: Set<string>): boolean {
  const page = href.match(PAGE_HREF);
  if (page) return ids.has(page[1]);

  const dbMatch = href.match(DB_HREF);
  if (dbMatch) return ids.has(dbMatch[1]) || (!!dbMatch[2] && ids.has(dbMatch[2]));

  return false;
}

const CHILD_BLOCK_BLOCK = /<div\b[^>]*\bdata-cb-id\s*=\s*"[^"]*"[^>]*><\/div>/gi;
const PAGE_LINK_ANCHOR = /<a\b[^>]*\bdata-page-link\b[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Remove references to now-deleted items from a page body.
 *
 * childBlocks (the embedded sub-page "buttons") are dropped outright — the page
 * they open no longer exists, so the button is dead. Inline pageLinks are
 * unwrapped to their plain label text instead of being deleted, because they sit
 * mid-sentence and removing them would silently rewrite the user's prose.
 */
export function stripPageRefs(markdown: string, ids: Set<string>): string {
  if (!markdown || ids.size === 0) return markdown;

  let out = markdown.replace(CHILD_BLOCK_BLOCK, (tag) => {
    const itemId = attrValue(tag, 'data-cb-id');
    const dbId = attrValue(tag, 'data-cb-dbid');
    const dead = (itemId && ids.has(itemId)) || (dbId && ids.has(dbId));
    return dead ? '' : tag;
  });

  out = out.replace(PAGE_LINK_ANCHOR, (tag, label: string) => {
    const href = attrValue(tag, 'href');
    return href && hrefTargets(href, ids) ? label : tag;
  });

  // A removed block leaves its surrounding blank lines behind.
  return out.replace(/\n{3,}/g, '\n\n');
}

/**
 * Rewrite every page that references one of `ids`, stripping the dead links.
 *
 * Without this, deleting a page left the embedded child-block button sitting in
 * its parent's body: `removePageLinksFor` only drops the graph rows, which the
 * backlinks panel reads — it never touches the markdown that actually renders
 * the button.
 *
 * MUST run before `removePageLinksFor` for the same ids: the sources are found
 * via the very graph rows that call deletes. Best-effort, like the rest of this
 * module — a failure here leaves a stale button, it must never fail the delete.
 */
export async function purgeReferencesTo(ids: string[]): Promise<void> {
  const targets = new Set(ids.filter(Boolean));
  if (targets.size === 0) return;

  try {
    const sources = await db
      .select({ fromId: pageLinks.fromId, fromType: pageLinks.fromType })
      .from(pageLinks)
      .where(inArray(pageLinks.toId, [...targets]));

    // One rewrite per source page, even if it linked to several deleted items.
    const bySource = new Map<string, string>();
    for (const s of sources) {
      // The source is itself being deleted in this same pass — nothing to fix up.
      if (!targets.has(s.fromId)) bySource.set(s.fromId, s.fromType);
    }

    const now = new Date();
    for (const [fromId, fromType] of bySource) {
      if (fromType === 'page') {
        const [row] = await db
          .select({ content: standalonePages.content })
          .from(standalonePages)
          .where(eq(standalonePages.itemId, fromId))
          .limit(1);
        if (!row) continue;
        const next = stripPageRefs(row.content, targets);
        if (next === row.content) continue;
        await db
          .update(standalonePages)
          .set({ content: next, updatedAt: now })
          .where(eq(standalonePages.itemId, fromId));
      } else {
        const [row] = await db
          .select({ content: pages.content })
          .from(pages)
          .where(eq(pages.id, fromId))
          .limit(1);
        if (!row) continue;
        const next = stripPageRefs(row.content, targets);
        if (next === row.content) continue;
        await db
          .update(pages)
          .set({ content: next, updatedAt: now })
          .where(eq(pages.id, fromId));
      }
    }
  } catch {
    // Swallow — see module doc comment.
  }
}
