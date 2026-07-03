import 'server-only';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { Marked } from 'marked';
import { WIKI_PAGES, BLOG_POSTS, type WikiPage, type BlogPost } from './manifest';

export { WIKI_PAGES, BLOG_POSTS } from './manifest';
export type { WikiPage, BlogPost } from './manifest';

// ── Markdown → HTML (server-side, SEO-first) ───────────────────────────────────

export type DocHeading = { depth: 2 | 3; text: string; id: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '')   // strip any tags from parsed inline
    .replace(/[^\w\s-]/g, '')  // \w keeps a-z0-9_ so tool names like query_audit_log survive
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// Rewrite links authored for the old shared-page URLs to the new routes:
//  - relative wiki cross-refs:  (getting-started.md#x) → (/wiki/getting-started#x)
//  - absolute share links:      /share/docs/mcp/x → /wiki/x ; /share/blog/x → /docs/x
function rewriteLinks(md: string): string {
  return md
    .replace(/\]\(([a-z0-9-]+)\.md(#[^)]+)?\)/gi, '](/wiki/$1$2)')
    .replace(/https?:\/\/(?:www\.)?remnus\.com\/share\/docs\/mcp/g, '/wiki')
    .replace(/\/share\/docs\/mcp/g, '/wiki')
    .replace(/https?:\/\/(?:www\.)?remnus\.com\/share\/blog/g, '/docs')
    .replace(/\/share\/blog/g, '/docs');
}

// Drop the leading "# Title" line — the page renders its title from the manifest,
// so the in-body H1 would duplicate it.
function stripLeadingH1(md: string): string {
  return md.replace(/^﻿?\s*#\s+.+\r?\n+/, '');
}

/**
 * Render trusted, repo-authored markdown to HTML. Adds slugified `id`s to h2/h3
 * (for anchor links + the on-page TOC) and collects those headings.
 */
export function renderMarkdown(md: string): { html: string; headings: DocHeading[] } {
  const headings: DocHeading[] = [];
  const counts = new Map<string, number>();
  const m = new Marked({ gfm: true });

  m.use({
    renderer: {
      heading(token) {
        const inner = this.parser.parseInline(token.tokens);
        const plain = stripTags(inner);
        let id = slugify(plain);
        const seen = counts.get(id) ?? 0;
        counts.set(id, seen + 1);
        if (seen > 0) id = `${id}-${seen}`;
        if (token.depth === 2 || token.depth === 3) {
          headings.push({ depth: token.depth, text: plain, id });
        }
        return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
      },
    },
  });

  const html = m.parse(rewriteLinks(md), { async: false }) as string;
  return { html, headings };
}

function firstParagraph(md: string): string {
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('>') || line.startsWith('|') || line.startsWith('```')) {
      continue;
    }
    return line.replace(/[#*`\[\]_>]/g, '').replace(/\(([^)]*)\)/g, '').trim();
  }
  return '';
}

// Truncates at a word boundary (never mid-word) for clean meta descriptions.
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

function readContent(kind: 'mcp' | 'blog', file: string): string {
  return readFileSync(join(process.cwd(), 'docs', kind, file), 'utf8');
}

// Real last-edited date for a content file, from git history (build-time only —
// these pages are statically generated via generateStaticParams). Returns null
// on a shallow clone or missing git history rather than guess, so JSON-LD simply
// omits `dateModified` instead of showing a misleading one.
function getFileLastModified(kind: 'mcp' | 'blog', file: string): string | null {
  try {
    const out = execSync(`git log -1 --format=%aI -- "docs/${kind}/${file}"`, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

// ── Wiki ───────────────────────────────────────────────────────────────────────

const wikiBySlug = new Map<string, WikiPage>(WIKI_PAGES.map((p) => [p.slug, p]));

// Icon is deliberately omitted: it's a Lucide component reference (a function),
// which can't be serialized across the server→client RSC boundary. WikiSidebar
// (a client component) looks icons up itself via a direct manifest import instead.
export type WikiNavItem = { slug: string; title: string };

export function getWikiNav(): WikiNavItem[] {
  return [...WIKI_PAGES]
    .sort((a, b) => a.order - b.order)
    .map(({ slug, title }) => ({ slug, title }));
}

export function getWikiPage(slug: string): {
  meta: WikiPage;
  html: string;
  headings: DocHeading[];
  description: string;
  lastModified: string | null;
} | null {
  const meta = wikiBySlug.get(slug);
  if (!meta) return null;
  const raw = readContent('mcp', meta.file);
  const description = truncateAtWord(firstParagraph(raw), 160);
  const { html, headings } = renderMarkdown(stripLeadingH1(raw));
  const lastModified = getFileLastModified('mcp', meta.file);
  return { meta, html, headings, description, lastModified };
}

// ── Docs (blog) ─────────────────────────────────────────────────────────────────

const blogBySlug = new Map<string, BlogPost>(BLOG_POSTS.map((p) => [p.slug, p]));

/** Blog posts sorted newest-first. */
export function getAllBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getBlogPost(slug: string): {
  meta: BlogPost;
  html: string;
  headings: DocHeading[];
  readingTime: number;
  lastModified: string | null;
} | null {
  const meta = blogBySlug.get(slug);
  if (!meta) return null;
  const raw = readContent('blog', meta.file);
  const words = raw.trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(words / 200));
  const { html, headings } = renderMarkdown(stripLeadingH1(raw));
  const lastModified = getFileLastModified('blog', meta.file);
  return { meta, html, headings, readingTime, lastModified };
}

/** Adjacent posts (in display order) for prev/next navigation. */
export function getAdjacentPosts(slug: string): { prev: BlogPost | null; next: BlogPost | null } {
  const ordered = getAllBlogPosts();
  const i = ordered.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? ordered[i - 1] : null,
    next: i < ordered.length - 1 ? ordered[i + 1] : null,
  };
}
