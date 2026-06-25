import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  searchWorkspace,
  listWorkspaceItems,
  listWorkspaceMembers,
  queryAuditLog,
  getAnyPageById,
  getDatabaseSchema,
  queryDatabaseRows,
} from '@/lib/services/workspace';
import { logActivity, type TokenContext } from '../context';

export function registerReadTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'search_workspace',
    {
      description: 'Search pages and databases in the workspace by title.',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Maximum results (default 10)'),
      },
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string().describe('Item ID'),
          type: z.string().describe('Item type (page | database)'),
          title: z.string().describe('Item title'),
          snippet: z.string().describe('Matching content snippet (pages only)'),
        }).passthrough()).describe('Matching items'),
      }),
      annotations: { title: 'Search workspace', readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      try {
        const results = await searchWorkspace(ctx.workspaceId, query, limit ?? 10);
        await logActivity(ctx, 'search_workspace', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }], structuredContent: { results } };
      } catch (err) {
        await logActivity(ctx, 'search_workspace', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_workspace',
    {
      description: 'List workspace items (pages and databases). Optionally filter by parent. Supports cursor-based pagination.',
      inputSchema: {
        parentId: z.string().optional().describe('Parent item ID (omit for root items)'),
        limit: z.number().optional().default(100).describe('Maximum items per page (default 100)'),
        cursor: z.string().optional().describe('Pagination cursor from a previous response\'s nextCursor field'),
      },
      outputSchema: z.object({
        items: z.array(z.object({
          id: z.string().describe('Item ID'),
          type: z.string().describe('Item type (page | database)'),
          title: z.string().describe('Item title'),
          parentId: z.string().nullable().optional().describe('Parent item ID, or null at root'),
          icon: z.string().nullable().optional().describe('Item icon'),
          databaseId: z.string().optional().describe('Database ID (database items only)'),
        }).passthrough()).describe('Workspace items on this page'),
        hasMore: z.boolean().describe('Whether more items exist beyond this page'),
        nextCursor: z.string().optional().describe('Cursor for the next page (present when hasMore)'),
      }),
      annotations: { title: 'List workspace items', readOnlyHint: true, openWorldHint: false },
    },
    async ({ parentId, limit, cursor }) => {
      try {
        const result = await listWorkspaceItems(ctx.workspaceId, parentId, limit ?? 100, cursor);
        await logActivity(ctx, 'list_workspace', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
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
      outputSchema: z.object({
        id: z.string().describe('Page ID'),
        type: z.string().describe('Resolved type (page | database)'),
        title: z.string().optional().describe('Page title'),
        content: z.string().optional().describe('Markdown content'),
        icon: z.string().nullable().optional().describe('Page icon'),
        properties: z.any().optional().describe('Database-row properties (database rows only)'),
        databaseId: z.string().nullable().optional().describe('Associated database ID (database items only)'),
      }).passthrough(),
      annotations: { title: 'Get page', readOnlyHint: true, openWorldHint: false },
    },
    async ({ pageId }) => {
      try {
        const page = await getAnyPageById(ctx.workspaceId, pageId);
        await logActivity(ctx, 'get_page', 'success', 'page', pageId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(page, null, 2) }], structuredContent: page };
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
      outputSchema: z.object({
        name: z.string().describe('Database name'),
        schema: z.array(z.any()).nullable().describe('Column definitions (id, name, type, options)'),
      }).passthrough(),
      annotations: { title: 'Get database schema', readOnlyHint: true, openWorldHint: false },
    },
    async ({ databaseId }) => {
      try {
        const result = await getDatabaseSchema(ctx.workspaceId, databaseId);
        await logActivity(ctx, 'get_database_schema', 'success', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'get_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'query_audit_log',
    {
      description: 'Query the MCP agent activity audit log for this workspace. Supports filtering by tool name, status, and date range.',
      inputSchema: {
        tool: z.string().optional().describe('Filter by tool name (e.g. "create_page", "query_database")'),
        status: z.enum(['success', 'error']).optional().describe('Filter by call status'),
        from: z.string().optional().describe('Start of date range (ISO 8601, e.g. "2025-01-01T00:00:00Z")'),
        to: z.string().optional().describe('End of date range (ISO 8601, e.g. "2025-12-31T23:59:59Z")'),
        limit: z.number().optional().default(50).describe('Maximum results (default 50)'),
      },
      outputSchema: z.object({
        entries: z.array(z.object({
          id: z.string().describe('Activity row ID'),
          tool: z.string().describe('Tool that was called'),
          status: z.string().describe('Call status (success | error)'),
          targetType: z.string().nullable().optional().describe('Target resource type'),
          targetId: z.string().nullable().optional().describe('Target resource ID'),
          createdAt: z.any().describe('When the call happened'),
          agentName: z.string().nullable().optional().describe('Agent brand id'),
          tokenName: z.string().nullable().optional().describe('Token label'),
        }).passthrough()).describe('Audit log entries, newest first'),
      }),
      annotations: { title: 'Query audit log', readOnlyHint: true, openWorldHint: false },
    },
    async ({ tool, status, from, to, limit }) => {
      try {
        const rows = await queryAuditLog(ctx.workspaceId, { tool, status, from, to }, limit ?? 50);
        await logActivity(ctx, 'query_audit_log', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }], structuredContent: { entries: rows } };
      } catch (err) {
        await logActivity(ctx, 'query_audit_log', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_members',
    {
      description: 'List all members of the workspace with their roles and join dates.',
      inputSchema: {},
      outputSchema: z.object({
        members: z.array(z.object({
          userId: z.string().describe('Member user ID'),
          name: z.string().nullable().optional().describe('Display name'),
          email: z.string().nullable().optional().describe('Email address'),
          role: z.string().describe('Workspace role (owner | member | viewer)'),
          joinedAt: z.any().optional().describe('When the member joined'),
        }).passthrough()).describe('Workspace members, oldest first'),
      }),
      annotations: { title: 'List members', readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const members = await listWorkspaceMembers(ctx.workspaceId);
        await logActivity(ctx, 'list_members', 'success');
        return { content: [{ type: 'text' as const, text: JSON.stringify(members, null, 2) }], structuredContent: { members } };
      } catch (err) {
        await logActivity(ctx, 'list_members', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'query_database',
    {
      description: 'Get schema and rows of a database. Optionally filter rows by property values. Supports cursor-based pagination.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        limit: z.number().optional().default(50).describe('Maximum rows per page (default 50)'),
        filters: z.record(z.string(), z.any()).optional().describe('Filter rows by property value, e.g. {"status": "Done"} or {"col_xxx": ["Tag1"]}'),
        cursor: z.string().optional().describe('Pagination cursor from a previous response\'s nextCursor field'),
      },
      outputSchema: z.object({
        schema: z.any().optional().describe('Database column schema'),
        rows: z.array(z.any()).describe('Matching rows on this page'),
        hasMore: z.boolean().optional().describe('Whether more rows exist beyond this page'),
        nextCursor: z.string().optional().describe('Cursor for the next page (present when hasMore)'),
      }).passthrough(),
      annotations: { title: 'Query database', readOnlyHint: true, openWorldHint: false },
    },
    async ({ databaseId, limit, filters, cursor }) => {
      try {
        const result = await queryDatabaseRows(ctx.workspaceId, databaseId, limit ?? 50, filters, cursor);
        await logActivity(ctx, 'query_database', 'success', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'query_database', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
