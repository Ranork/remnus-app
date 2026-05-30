import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  searchWorkspace,
  listWorkspaceItems,
  getAnyPageById,
  getDatabaseSchema,
  queryDatabaseRows,
} from '@/lib/services/workspace';
import { logActivity, type TokenContext } from '../context';

export function registerReadTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'search',
    {
      description: 'Search pages and databases in the workspace by title.',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Maximum results (default 10)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      try {
        const results = await searchWorkspace(ctx.workspaceId, query, limit ?? 10);
        await logActivity(ctx, 'search', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        await logActivity(ctx, 'search', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_workspace',
    {
      description: 'List workspace items (pages and databases). Optionally filter by parent.',
      inputSchema: {
        parentId: z.string().optional().describe('Parent item ID (omit for root items)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ parentId }) => {
      try {
        const items = await listWorkspaceItems(ctx.workspaceId, parentId);
        await logActivity(ctx, 'list_workspace', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
      } catch (err) {
        await logActivity(ctx, 'list_workspace', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_page',
    {
      description: 'Get full content of a workspace page or database row by its ID. Auto-detects the type — no flags needed.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId }) => {
      try {
        const page = await getAnyPageById(ctx.workspaceId, pageId);
        await logActivity(ctx, 'get_page', 'success', 'page', pageId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(page, null, 2) }] };
      } catch (err) {
        await logActivity(ctx, 'get_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_database_schema',
    {
      description: 'Get only the column schema of a database, without fetching any rows. Use this to inspect column names, types, and select options before querying.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ databaseId }) => {
      try {
        const result = await getDatabaseSchema(ctx.workspaceId, databaseId);
        await logActivity(ctx, 'get_database_schema', 'success', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        await logActivity(ctx, 'get_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'query_database',
    {
      description: 'Get schema and rows of a database. Optionally filter rows by property values.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        limit: z.number().optional().default(50).describe('Maximum rows (default 50)'),
        filters: z.record(z.string(), z.any()).optional().describe('Filter rows by property value, e.g. {"status": "Done"} or {"col_xxx": ["Tag1"]}'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ databaseId, limit, filters }) => {
      try {
        const result = await queryDatabaseRows(ctx.workspaceId, databaseId, limit ?? 50, filters);
        await logActivity(ctx, 'query_database', 'success', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        await logActivity(ctx, 'query_database', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
