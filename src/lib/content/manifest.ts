// Source-of-truth metadata for the public Wiki (/wiki) and Docs blog (/docs)
// sections. The markdown bodies live in `docs/mcp/*.md` (wiki reference) and
// `docs/blog/*.md` (blog posts) and are read + rendered at build time by
// `src/lib/content/index.ts`. No database, no shared-page runtime.
//
// Previously this metadata lived in scripts/seed-mcp-docs.ts + seed-blog.ts,
// which seeded the DB as shared pages served at /share/docs/mcp/* and
// /share/blog/*. Those URLs now 301-redirect here (see next.config.ts).
//
// Icons are Lucide component references (not emoji) — no 'server-only' guard
// on this file, so it's safe to import directly from client components too
// (see WikiSidebar, which looks icons up locally rather than receiving them
// as props, since function values can't cross the server→client RSC boundary).

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Rocket,
  Plug,
  KeyRound,
  Search,
  PencilLine,
  Package,
  Lightbulb,
  Brain,
  Gauge,
  Wrench,
  Bot,
  Scale,
} from 'lucide-react';
import { NotionMark, AppFlowyMark, AffineMark, ObsidianMark } from '@/components/docs/CompetitorMark';

// A blog post icon is either a Lucide icon or one of the brand marks above —
// both render as `<Icon size={n} />`, so they're interchangeable everywhere
// BlogPost.icon is used (BlogCard, the article header).
type PostIcon = LucideIcon | ComponentType<{ size?: number; className?: string }>;

// ── Wiki (MCP reference, left-sidebar tree) ────────────────────────────────────

export type WikiPage = {
  /** URL slug relative to /wiki. Empty string = the /wiki overview. */
  slug: string;
  /** File under docs/mcp/. */
  file: string;
  title: string;
  icon: LucideIcon;
  order: number;
};

export const WIKI_PAGES: WikiPage[] = [
  { slug: '',                 file: 'README.md',           title: 'MCP Documentation',  icon: BookOpen,    order: 0 },
  { slug: 'getting-started',  file: 'getting-started.md',  title: 'Getting Started',    icon: Rocket,      order: 1 },
  { slug: 'connect-editors',  file: 'connect-editors.md',  title: 'Connect Your Editor', icon: Plug,       order: 2 },
  { slug: 'authentication',   file: 'authentication.md',   title: 'Authentication',     icon: KeyRound,    order: 3 },
  { slug: 'read-tools',       file: 'read-tools.md',       title: 'Read Tools',         icon: Search,      order: 4 },
  { slug: 'write-tools',      file: 'write-tools.md',      title: 'Write Tools',        icon: PencilLine,  order: 5 },
  { slug: 'resources',        file: 'resources.md',        title: 'Resources',          icon: Package,     order: 6 },
  { slug: 'prompts',          file: 'prompts.md',          title: 'Prompts',            icon: Lightbulb,   order: 7 },
  { slug: 'agent-memory',     file: 'agent-memory.md',     title: 'Agent Memory',       icon: Brain,       order: 8 },
  { slug: 'token-efficient-usage', file: 'token-efficient-usage.md', title: 'Token-Efficient Usage', icon: Gauge, order: 9 },
];

// ── Docs (blog, article layout) ────────────────────────────────────────────────

export type BlogPost = {
  /** URL slug relative to /docs. */
  slug: string;
  /** File under docs/blog/. */
  file: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) — publication date. */
  date: string;
  icon: PostIcon;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'agent-token-efficiency',
    file: 'agent-token-efficiency.md',
    title: 'How Many Tokens Does Your Agent Burn Reading Your Notes?',
    description:
      'A measured look at what an AI agent spends reading a workspace over MCP — and how field projection, outline mode, the digest, and delta sync cut it 80–90%.',
    date: '2026-07-07',
    icon: Gauge,
  },
  {
    slug: 'how-i-built-mcp-native',
    file: 'how-i-built-mcp-native.md',
    title: 'How I Built an MCP-Native Open-Source Notion Alternative',
    description:
      "The build story, from the headless agent that Notion's MCP could not run to the token contract that made Remnus.",
    date: '2026-06-23',
    icon: Wrench,
  },
  {
    slug: 'remnus-vs-notion-mcp',
    file: 'remnus-vs-notion-mcp.md',
    title: 'Remnus vs Notion: Full Comparison',
    description:
      'An honest, fact-checked look at Remnus vs Notion: workspace features, MCP authentication, agent tooling, pricing tiers, and audit trails.',
    date: '2026-07-03',
    icon: NotionMark,
  },
  {
    slug: 'remnus-vs-appflowy',
    file: 'remnus-vs-appflowy.md',
    title: 'Remnus vs AppFlowy: Full Comparison',
    description:
      "A fact-checked comparison of two AGPL-3.0 Notion alternatives: AppFlowy's mature editor versus Remnus's first-party MCP server and agent tooling.",
    date: '2026-07-03',
    icon: AppFlowyMark,
  },
  {
    slug: 'remnus-vs-affine',
    file: 'remnus-vs-affine.md',
    title: 'Remnus vs AFFiNE: Full Comparison',
    description:
      "A fact-checked comparison of AFFiNE's mature editor and offline-first design against Remnus's first-party MCP server and open self-hosting.",
    date: '2026-07-03',
    icon: AffineMark,
  },
  {
    slug: 'remnus-vs-obsidian',
    file: 'remnus-vs-obsidian.md',
    title: 'Remnus vs Obsidian: Full Comparison',
    description:
      "A fact-checked comparison of Obsidian's local-first notes and plugin ecosystem against Remnus's first-party MCP server for team workspaces.",
    date: '2026-07-03',
    icon: ObsidianMark,
  },
  {
    slug: 'mcp-native-vs-integrated',
    file: 'mcp-native-vs-integrated.md',
    title: 'MCP-Native vs MCP-Integrated',
    description:
      'Two architectural approaches to AI agent access and why the distinction matters.',
    date: '2026-06-08',
    icon: Bot,
  },
  {
    slug: 'why-agpl-3',
    file: 'why-agpl-3.md',
    title: 'Why We Chose AGPL-3.0 for Remnus',
    description:
      'Licensing philosophy: why not MIT, why not BSL, and what AGPL actually protects.',
    date: '2026-06-08',
    icon: Scale,
  },
];
