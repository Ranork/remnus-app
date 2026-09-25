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
import { chunkRows } from './sqlChunk';

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
 * `syncPageLinks` for many source pages at once, collapsed into ONE round-trip.
 *
 * Same delete-then-insert contract per `from_id` as the single-page version —
 * but the whole set ships as one libsql `batch()` (a delete over `from_id IN
 * (…)` plus one multi-row insert) instead of two statements per page. The bulk
 * write path creates 50-150 pages in a call and each round-trip to a remote
 * Turso costs real latency, so this is the difference between a link sync that
 * is free and one that dominates the call.
 *
 * Best-effort like the rest of this module: a failure here leaves the graph
 * stale, it must never fail the write that produced the content.
 */
export async function syncPageLinksBulk(
  workspaceId: string,
  sources: { fromId: string; fromType: 'page' | 'database_row'; content: string }[],
): Promise<void> {
  if (sources.length === 0) return;
  try {
    const fromIds = [...new Set(sources.map(s => s.fromId))];
    // Deduped by (from_id, to_id, link_kind) — the table's unique index. A
    // source listed twice in one call would otherwise collide with itself.
    const rows = new Map<string, {
      workspaceId: string; fromId: string; fromType: 'page' | 'database_row';
      toId: string; toType: PageRef['toType']; linkKind: PageRef['linkKind']; createdAt: Date;
    }>();
    const now = new Date();
    for (const source of sources) {
      for (const ref of extractPageRefs(source.content)) {
        if (ref.toId === source.fromId) continue;
        rows.set(`${source.fromId}|${ref.toId}|${ref.linkKind}`, {
          workspaceId, fromId: source.fromId, fromType: source.fromType,
          toId: ref.toId, toType: ref.toType, linkKind: ref.linkKind, createdAt: now,
        });
      }
    }

    const statements: any[] = [db.delete(pageLinks).where(inArray(pageLinks.fromId, fromIds))];
    // 8 bind params per row (id comes from $defaultFn) — chunked well under
    // SQLite's bind-parameter ceiling.
    for (const chunk of chunkRows([...rows.values()], 8)) {
      statements.push(db.insert(pageLinks).values(chunk));
    }
    await db.batch(statements as [any, ...any[]]);
  } catch {
    // Swallow — see module doc comment.
  }
}

/**
 * Drop the link-graph rows a deleted item's own body produced, and keep the rows
 * other pages hold TO it. An item deleted to the Trash keeps its id, so the links
 * pointing at it work again the moment it is restored; they are stripped only
 * once its trash copy is gone for good (`releaseTrashedReferences`).
 */
export async function removeOutgoingPageLinks(ids: string[]): Promise<void> {
  const from = ids.filter(Boolean);
  if (from.length === 0) return;
  try {
    await db.delete(pageLinks).where(inArray(pageLinks.fromId, from));
  } catch {
    // Swallow — see module doc comment.
  }
}

/**
 * Drop every link-graph row touching an item that is gone for good (as source or
 * target): its trash copy expired, or it was deleted without one.
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
 * Only for items that can never come back — a trash copy that expired or was
 * evicted, or a delete that writes none. A delete to the Trash leaves these
 * links in place (the editor dims them) so a restore needs no repair.
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
