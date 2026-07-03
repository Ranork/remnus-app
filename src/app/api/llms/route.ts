import { NextResponse } from 'next/server';
import { WIKI_PAGES, BLOG_POSTS } from '@/lib/content/manifest';
import { getWikiPage, getBlogPost } from '@/lib/content';
import { METADATA_BASE_URL } from '@/lib/metadata';

// Serves /llms.txt (see llmstxt.org) via a next.config.ts rewrite — a plain
// markdown map of the site's most important content for LLMs/AI agents, so
// they don't have to crawl+guess structure. Built from the same manifest that
// drives /wiki and /docs, so it can never drift out of sync with the real
// pages. Content is deterministic at build time, so this is safely force-static.
export const dynamic = 'force-static';

function line(title: string, url: string, description: string | undefined): string {
  return description ? `- [${title}](${url}): ${description}` : `- [${title}](${url})`;
}

export function GET() {
  const wikiLines = [...WIKI_PAGES]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const url = p.slug ? `${METADATA_BASE_URL}/wiki/${p.slug}` : `${METADATA_BASE_URL}/wiki`;
      const page = getWikiPage(p.slug);
      return line(p.title, url, page?.description);
    })
    .join('\n');

  const blogLines = [...BLOG_POSTS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => {
      const url = `${METADATA_BASE_URL}/docs/${p.slug}`;
      return line(p.title, url, getBlogPost(p.slug)?.meta.description ?? p.description);
    })
    .join('\n');

  const body = `# Remnus

> Remnus is the MCP-Native workspace for vibe coders — pages and databases that Claude, Cursor, and any MCP-compatible AI agent can read and write over a standard HTTP API.

Remnus pairs a Notion-like editor (pages, databases, kanban/table/calendar views) with a built-in Model Context Protocol (MCP) server, so an AI agent can search, read, and write workspace content directly instead of copy-pasting through a chat window.

## Wiki

MCP reference documentation — endpoint, authentication, tools, resources, and prompts.

${wikiLines}

## Docs

Articles on the project's architecture, licensing, and build decisions.

${blogLines}

## Optional

${line('Pricing', `${METADATA_BASE_URL}/pricing`, 'Plans and limits')}
${line('Security', `${METADATA_BASE_URL}/security`, 'Auth methods, token scopes, and responsible disclosure')}
${line('Download', `${METADATA_BASE_URL}/download`, 'Desktop and mobile apps')}
`;

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
