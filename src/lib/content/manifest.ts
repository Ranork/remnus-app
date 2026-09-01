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
  ShieldCheck,
  Wrench,
  Bot,
  SquareKanban,
  Scale,
  History,
  Layers,
  Lock,
  Server,
  Blocks,
  Coins,
  Users,
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
  { slug: 'context-first',    file: 'context-first.md',    title: 'Context-First MCP',  icon: ShieldCheck, order: 9 },
  { slug: 'token-efficient-usage', file: 'token-efficient-usage.md', title: 'Token-Efficient Usage', icon: Gauge, order: 10 },
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
    slug: 'claude-cursor-codex-shared-workspace',
    file: 'claude-cursor-codex-shared-workspace.md',
    title: 'How Claude, Cursor, and Codex Can Share One AI Workspace',
    description:
      'How Claude Code, Cursor, and OpenAI Codex can participate in the same project without treating any one tool\'s private chat history as the source of truth — what to share, what to keep tool-specific, conflict prevention, and a fictional multi-agent workflow.',
    date: '2026-09-01',
    icon: Users,
  },
  {
    slug: 'reduce-token-usage-mcp-agent-workflows',
    file: 'reduce-token-usage-mcp-agent-workflows.md',
    title: 'How to Reduce Token Usage in MCP Agent Workflows',
    description:
      'Where tokens go in an MCP agent loop and the concrete patterns that cut avoidable reads — workspace digests, outline-first reads, targeted search, schema-before-rows, field projection, change tracking, and separating durable memory from task context.',
    date: '2026-08-27',
    icon: Coins,
  },
  {
    slug: 'remote-vs-local-mcp-servers',
    file: 'remote-vs-local-mcp-servers.md',
    title: 'Remote vs Local MCP Servers: Which Should You Use?',
    description:
      'A neutral, spec-grounded comparison of local (stdio) and remote (Streamable HTTP) MCP servers — setup, auth, team access, headless workflows, security responsibilities, hybrid bridging, and how Remnus fits both models.',
    date: '2026-08-19',
    icon: Server,
  },
  {
    slug: 'mcp-tools-vs-resources-vs-prompts',
    file: 'mcp-tools-vs-resources-vs-prompts.md',
    title: 'MCP Tools vs Resources vs Prompts: A Practical Guide',
    description:
      'A practical, spec-grounded guide to the three MCP primitives — model-controlled tools, application-controlled resources, and user-controlled prompts — with verified Remnus examples and one complete workflow.',
    date: '2026-08-21',
    icon: Blocks,
  },
  {
    slug: 'mcp-security-guide',
    file: 'mcp-security-guide.md',
    title: 'MCP Security Guide: OAuth, Tokens, Scopes, and Audit Logs',
    description:
      'A verified guide to MCP security: the threat model (malicious servers, prompt injection, excessive permissions, credential leakage), OAuth and PATs, least privilege, destructive-action confirmation, audit logs, and how Remnus applies each control.',
    date: '2026-08-14',
    icon: Lock,
  },
  {
    slug: 'run-headless-ai-agents-with-mcp',
    file: 'run-headless-ai-agents-with-mcp.md',
    title: 'How to Run Headless AI Agents Without Login Prompts',
    description:
      'A practical, verified guide to authenticating headless AI agents against a Remnus workspace: OAuth vs personal access tokens, secure token storage, minimum-permission scopes, and a real headless Claude Code example.',
    date: '2026-08-12',
    icon: KeyRound,
  },
  {
    slug: 'ai-agent-memory-vs-rag-vs-context-window',
    file: 'ai-agent-memory-vs-rag-vs-context-window.md',
    title: 'AI Agent Memory vs RAG vs Context Windows',
    description:
      'A technical comparison of context windows, retrieval-augmented generation, and persistent agent memory: primary-source definitions, a direct comparison table, and where to store what in a real project.',
    date: '2026-08-10',
    icon: Layers,
  },
  {
    slug: 'why-coding-agents-forget-your-project',
    file: 'why-coding-agents-forget-your-project.md',
    title: 'Why Coding Agents Forget Your Project Between Sessions',
    description:
      'Why Claude Code, Cursor, and Codex lose project context between sessions, and how instruction files, documentation, task tracking, and memory combine into a context system that actually persists.',
    date: '2026-08-07',
    icon: History,
  },
  {
    slug: 'okf-context-engine-for-ai-agents',
    file: 'okf-context-engine-for-ai-agents.md',
    title: 'How Remnus Uses OKF to Give AI Agents Better Context',
    description:
      'How Remnus combines portable OKF knowledge, exact-revision human review, Context Pack v2, and Smart or Strict MCP policies for AI agents.',
    date: '2026-08-04',
    icon: ShieldCheck,
  },
  {
    slug: 'ai-agent-manage-kanban-board',
    file: 'ai-agent-manage-kanban-board.md',
    title: 'How to Let an AI Agent Manage Your Kanban Board',
    description:
      'Learn how to use an AI kanban board safely with agent-assisted triage, task updates, human approvals, MCP workflows, prompts, and failure controls.',
    date: '2026-08-04',
    icon: SquareKanban,
  },
  {
    slug: 'ai-agent-project-management-guide',
    file: 'ai-agent-project-management-guide.md',
    title: 'AI Agent Project Management: The Complete Guide',
    description:
      'A practical guide to AI agent project management: realistic responsibilities, human oversight, project lifecycles, safeguards, and MCP-enabled workflows.',
    date: '2026-07-31',
    icon: Bot,
  },
  {
    slug: 'connect-openai-codex-to-remnus-mcp',
    file: 'connect-openai-codex-to-remnus-mcp.md',
    title: 'How to Connect OpenAI Codex to Remnus with MCP',
    description:
      'Connect OpenAI Codex to a Remnus MCP workspace for requirements, tasks, decisions, documentation, status reports, and durable agent memory.',
    date: '2026-07-28',
    icon: Plug,
  },
  {
    slug: 'connect-cursor-to-remnus-mcp',
    file: 'connect-cursor-to-remnus-mcp.md',
    title: 'How to Connect Cursor to Remnus with MCP',
    description:
      'Connect Cursor to a Remnus workspace over MCP: verified mcp.json setup, OAuth vs personal access tokens, global vs project config, five workflows, and troubleshooting.',
    date: '2026-07-22',
    icon: Plug,
  },
  {
    slug: 'what-is-an-mcp-native-workspace',
    file: 'what-is-an-mcp-native-workspace.md',
    title: 'What Is an MCP-Native Workspace? A Complete Guide',
    description:
      'An MCP-native workspace is built for AI agents from the start: readable, writable, scoped, and audited over the Model Context Protocol. Here is how the model works and where it fits.',
    date: '2026-07-21',
    icon: BookOpen,
  },
  {
    slug: 'connect-claude-code-to-remnus-mcp',
    file: 'connect-claude-code-to-remnus-mcp.md',
    title: 'How to Connect Claude Code to Remnus with MCP',
    description:
      'A verified, step-by-step guide to connecting Claude Code to a Remnus workspace over MCP — OAuth vs personal access tokens, scopes, first workflows, and troubleshooting.',
    date: '2026-07-20',
    icon: Plug,
  },
  {
    slug: 'claude-code-persistent-memory-workspace',
    file: 'claude-code-persistent-memory-workspace.md',
    title: 'How to Give Claude Code Persistent Memory and a Shared Workspace',
    description:
      'Learn how to combine Claude Code memory, CLAUDE.md, project tasks, and an MCP workspace for reliable long-running software work.',
    date: '2026-07-14',
    icon: Brain,
  },
  {
    slug: 'agent-token-efficiency',
    file: 'agent-token-efficiency.md',
    title: 'How Many Tokens Does Your Agent Burn Reading Your Notes?',
    description:
      'A measured look at agent workspace reads, plus how projection, outlines, digest, delta sync, and OKF-aware Context Pack v2 control context cost.',
    date: '2026-07-07',
    icon: Gauge,
  },
  {
    slug: 'how-i-built-mcp-native',
    file: 'how-i-built-mcp-native.md',
    title: 'How I Built Remnus, an MCP-Native Open-Source Workspace',
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
