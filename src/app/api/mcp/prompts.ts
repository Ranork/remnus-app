import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getAnyPageById,
  queryDatabaseRows,
  searchWorkspace,
  listWorkspaceItems,
  buildContentOutline,
  getRelatedPages,
  type RelatedPageRef,
} from '@/lib/services/workspace';
import type { TokenContext } from './context';

const MEMORY_TYPE_LABELS: Record<string, string> = {
  decision: 'Decision',
  preference: 'Preference',
  gotcha: 'Gotcha',
  fact: 'Fact',
};

export function registerPrompts(server: McpServer, ctx: TokenContext) {
  // 1. summarize-page
  server.registerPrompt(
    'summarize-page',
    {
      description: 'Summarize a Remnus page or database row.',
      argsSchema: {
        page_id: z.string().describe('The workspace item ID or database row ID to summarize'),
        style: z.enum(['bullet', 'paragraph', 'tldr']).optional().default('paragraph').describe('Summary style: bullet list, paragraph, or TL;DR'),
      },
    },
    async ({ page_id, style }) => {
      const page = await getAnyPageById(ctx.workspaceId, page_id);
      let pageText = `# ${page.title || 'Untitled'}\n\n`;
      if (page.properties && Object.keys(page.properties).length > 0) {
        for (const [k, v] of Object.entries(page.properties)) {
          if (k === 'title') continue;
          const valStr = Array.isArray(v) ? v.join(', ') : String(v ?? '');
          if (valStr) pageText += `**${k}:** ${valStr}\n`;
        }
        pageText += '\n';
      }
      pageText += page.content || '(no content)';

      const styleInstruction =
        style === 'bullet'    ? 'Write the summary as a bullet-point list of key points.'
        : style === 'tldr'    ? 'Write a single-sentence TL;DR summary.'
        : 'Write the summary as a concise paragraph.';

      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: `${styleInstruction}\n\nPage content:\n\n${pageText}` },
        }],
      };
    },
  );

  // 2. weekly-status-report
  server.registerPrompt(
    'weekly-status-report',
    {
      description: 'Generate a weekly status report from a task database.',
      argsSchema: {
        database_id: z.string().describe('Database ID to generate the report from'),
        period: z.string().optional().default('last week').describe('Reporting period, e.g. "last week", "this sprint"'),
      },
    },
    async ({ database_id, period }) => {
      const result = await queryDatabaseRows(ctx.workspaceId, database_id, 200);
      const rows = result.rows ?? [];
      const schema = result.schema ?? [];

      const formatted = rows.map(row => {
        const parts: string[] = [`**${row.title || 'Untitled'}**`];
        for (const col of schema) {
          if (col.id === 'title') continue;
          const val = row.properties?.[col.id];
          if (val == null || val === '') continue;
          parts.push(`${col.name}: ${Array.isArray(val) ? val.join(', ') : String(val)}`);
        }
        return parts.join(' · ');
      }).join('\n') || '(no rows found)';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Generate a concise weekly status report for the period "${period}". Group items by status (Done / In Progress / Blocked / Backlog). Highlight any blockers and key wins.\n\nTask data:\n${formatted}`,
          },
        }],
      };
    },
  );

  // 3. kanban-triage
  server.registerPrompt(
    'kanban-triage',
    {
      description: 'Review a kanban board and suggest prioritization, blockers, and next actions.',
      argsSchema: {
        database_id: z.string().describe('Database ID of the kanban board to triage'),
      },
    },
    async ({ database_id }) => {
      const result = await queryDatabaseRows(ctx.workspaceId, database_id, 200);
      const rows = result.rows ?? [];
      const schema = result.schema ?? [];

      const formatted = rows.map(row => {
        const parts: string[] = [`- ${row.title || 'Untitled'}`];
        for (const col of schema) {
          if (col.id === 'title') continue;
          const val = row.properties?.[col.id];
          if (val == null || val === '') continue;
          parts.push(`  ${col.name}: ${Array.isArray(val) ? val.join(', ') : String(val)}`);
        }
        return parts.join('\n');
      }).join('\n') || '(no rows found)';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Triage the following kanban board. For each item identify: what needs immediate attention, what is blocked and why, what can be deprioritized, and what the next 3 actions should be.\n\nBoard items:\n${formatted}`,
          },
        }],
      };
    },
  );

  // 4. extract-tasks
  server.registerPrompt(
    'extract-tasks',
    {
      description: 'Extract all actionable tasks from a page.',
      argsSchema: {
        page_id: z.string().describe('The workspace item ID or database row ID to extract tasks from'),
      },
    },
    async ({ page_id }) => {
      const page = await getAnyPageById(ctx.workspaceId, page_id);
      const content = `# ${page.title || 'Untitled'}\n\n${page.content || '(no content)'}`;
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Extract all actionable tasks from the following page. For each task provide: action (what needs to be done), owner (if mentioned), deadline (if mentioned), priority (if indicated). Return the result as a markdown checklist.\n\nPage content:\n\n${content}`,
          },
        }],
      };
    },
  );

  // 5. search-and-create
  server.registerPrompt(
    'search-and-create',
    {
      description: 'Search for similar existing pages and suggest content for a new page to avoid duplication.',
      argsSchema: {
        title: z.string().describe('Title of the page you want to create'),
        query: z.string().describe('Search query to find similar existing content'),
      },
    },
    async ({ title, query }) => {
      const results = await searchWorkspace(ctx.workspaceId, query, 10);
      const formatted = results.length > 0
        ? results.map((r: { title: string; id: string; type: string }) => `- [${r.type}] ${r.title} (id: ${r.id})`).join('\n')
        : '(no similar items found)';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `I want to create a new page titled "${title}".\n\nExisting similar items in the workspace:\n${formatted}\n\nSuggest what content to include in the new page so it complements (and does not duplicate) the existing items. Return a markdown outline.`,
          },
        }],
      };
    },
  );

  // 6. save-memory
  server.registerPrompt(
    'save-memory',
    {
      description: 'Persist a durable memory (a decision, preference, gotcha, or fact) into your Agent Memory database as a structured, human-readable record you can recall later with recall-context.',
      argsSchema: {
        content: z.string().describe('The thing to remember, in plain language'),
        memory_type: z.enum(['decision', 'preference', 'gotcha', 'fact']).optional().default('fact').describe('Kind of memory: decision, preference, gotcha, or fact'),
        tags: z.string().optional().describe('Comma-separated tags, e.g. "architecture, api"'),
        database_id: z.string().optional().describe('Target memory database ID. If omitted, the prompt locates an existing Agent Memory database and otherwise instructs you to create one.'),
      },
    },
    async ({ content, memory_type, tags, database_id }) => {
      const typeLabel = MEMORY_TYPE_LABELS[memory_type ?? 'fact'] ?? 'Fact';
      const tagList = (tags ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const tagsJson = JSON.stringify(tagList);
      const today = new Date().toISOString().slice(0, 10);

      // Resolve the target database's databases.id. When not supplied, look for a
      // database whose title reads like a memory store (list_workspace exposes
      // databases.id as `databaseId`).
      let targetDbId = database_id ?? null;
      let targetDbTitle: string | null = null;
      if (!targetDbId) {
        try {
          const { items } = await listWorkspaceItems(ctx.workspaceId, undefined, 200);
          const memDb = items.find(i => i.type === 'database' && /memor/i.test(i.title) && i.databaseId);
          if (memDb?.databaseId) {
            targetDbId = memDb.databaseId;
            targetDbTitle = memDb.title;
          }
        } catch {
          // best-effort resolution; fall through to the "create one" instruction
        }
      }

      const text = targetDbId
        ? `Save the following as a new memory in the "${targetDbTitle ?? 'Agent Memory'}" database.\n\n`
          + `Use the create_page write tool:\n`
          + `- databaseId: "${targetDbId}"\n`
          + `- title: a concise one-line summary of the memory (understandable on its own, ≤ 80 chars)\n`
          + `- properties:\n`
          + `    - Type: "${typeLabel}"\n`
          + `    - Tags: ${tagsJson}\n`
          + `    - Date: "${today}"\n`
          + `- content: the full memory below, plus any extra context worth keeping.\n\n`
          + `Memory to save:\n${content}\n\n`
          + `Keep it human-readable — someone scanning the database later should understand the memory from the title alone.`
        : `No Agent Memory database was found in this workspace. First create one, then save the memory into it.\n\n`
          + `1. Create the database with create_database:\n`
          + `   - title: "Agent Memory"\n`
          + `   - columns:\n`
          + `       { "name": "Type", "type": "select", "options": ["Decision", "Preference", "Gotcha", "Fact"] }\n`
          + `       { "name": "Tags", "type": "multi_select" }\n`
          + `       { "name": "Date", "type": "date" }\n`
          + `   (a Title column is added automatically.)\n\n`
          + `2. Add this memory as a row with create_page (databaseId = the new database's id):\n`
          + `   - title: a concise one-line summary (≤ 80 chars)\n`
          + `   - properties: Type="${typeLabel}", Tags=${tagsJson}, Date="${today}"\n`
          + `   - content: the full memory below.\n\n`
          + `Memory to save:\n${content}`;

      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text },
        }],
      };
    },
  );

  // 7. recall-context
  server.registerPrompt(
    'recall-context',
    {
      description: 'Recall what the workspace already knows about a topic in one compact package: the top matching pages, each collapsed to a token-cheap outline, plus the link-graph neighborhood of the best match. Use it to reload prior context before starting work instead of many search + get_page round-trips.',
      argsSchema: {
        topic: z.string().describe('What to recall context about'),
        limit: z.number().optional().default(6).describe('Maximum pages to include (default 6)'),
      },
    },
    async ({ topic, limit }) => {
      const n = Math.min(Math.max(limit ?? 6, 1), 12);
      const results = await searchWorkspace(ctx.workspaceId, topic, n);

      const sections: string[] = [];
      for (const r of results) {
        try {
          const page = await getAnyPageById(ctx.workspaceId, r.id);
          const propLine = page.properties && Object.keys(page.properties).length > 0
            ? Object.entries(page.properties)
                .filter(([k, v]) => k !== 'title' && v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                .join(' · ')
            : '';
          const body = (page.content ?? '').trim();
          const outline = body ? buildContentOutline(body) : '(no content)';
          const head = `### ${page.title || 'Untitled'}  ·  ${r.type}  ·  id: ${r.id}`;
          sections.push(`${head}${propLine ? `\n${propLine}` : ''}\n${outline}`);
        } catch {
          // skip inaccessible / deleted hits
        }
      }

      // Link-graph neighborhood of the top hit — the surrounding pages an agent
      // might want to pull next, titles + ids only.
      let neighborhood = '';
      if (results[0]) {
        try {
          const rel = await getRelatedPages(ctx.workspaceId, results[0].id);
          const fmt = (arr: RelatedPageRef[]) =>
            arr.length ? arr.map(x => `${x.title} (id: ${x.id})`).join(', ') : '—';
          neighborhood =
            `Neighborhood of "${rel.page.title}":\n`
            + `- Parent: ${rel.parent ? `${rel.parent.title} (id: ${rel.parent.id})` : '—'}\n`
            + `- Children: ${fmt(rel.children)}\n`
            + `- Links out: ${fmt(rel.outgoingLinks)}\n`
            + `- Backlinks: ${fmt(rel.backlinks)}`;
        } catch {
          // best-effort — omit the neighborhood if it can't be built
        }
      }

      const packageText = sections.length ? sections.join('\n\n') : '(no matching pages found)';
      const text =
        `Recalled context for "${topic}" from the workspace. Use it as background before answering or acting; `
        + `each page is shown as an outline (headings + first line per section) — fetch the full body with get_page only when an outline shows you need the detail.\n\n`
        + `${packageText}`
        + `${neighborhood ? `\n\n---\n${neighborhood}` : ''}`;

      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text },
        }],
      };
    },
  );
}
