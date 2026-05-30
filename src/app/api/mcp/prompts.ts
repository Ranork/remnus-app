import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAnyPageById, queryDatabaseRows, searchWorkspace } from '@/lib/services/workspace';
import type { TokenContext } from './context';

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
}
