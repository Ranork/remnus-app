import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createPageInWorkspace,
  updatePageById,
  bulkUpdatePages,
  deleteItemFromWorkspace,
  moveItemInWorkspace,
  createDatabaseInWorkspace,
  updateDatabaseSchemaById,
  getAnyPageById,
} from '@/lib/services/workspace';
import { publish } from '@/lib/realtime/publish';
import { logActivity, type TokenContext } from '../context';

const READ_ONLY_ERROR = 'Error: This token only has read scope. A write-scoped token is required.';

function actorId(ctx: TokenContext) {
  return ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`;
}

export function registerWriteTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'create_page',
    {
      description: 'Create a new standalone page or database row.',
      inputSchema: {
        title: z.string().describe('Page title'),
        content: z.string().optional().describe('Initial markdown content'),
        parentId: z.string().optional().describe('Parent workspace item ID (for standalone pages)'),
        databaseId: z.string().optional().describe('Database ID (creates a database row instead of a page)'),
        properties: z.record(z.string(), z.any()).optional().describe('Initial properties (for database rows)'),
      },
    },
    async ({ title, content, parentId, databaseId, properties }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_page', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await createPageInWorkspace(ctx.workspaceId, { title, content, parentId, databaseId, properties });
        await logActivity(ctx, 'create_page', 'success', result.type, result.id);
        publish({ scope: databaseId ? 'database' : 'sidebar', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: result.id, type: result.type }) }] };
      } catch (err) {
        await logActivity(ctx, 'create_page', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update_page',
    {
      description: 'Update an existing page or database row.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row ID to update'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New markdown content'),
        properties: z.record(z.string(), z.any()).optional().describe('Properties to merge (for database rows)'),
      },
    },
    async ({ pageId, title, content, properties }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        await updatePageById(ctx.workspaceId, pageId, { title, content, properties });
        await logActivity(ctx, 'update_page', 'success', 'page', pageId);
        publish({ scope: 'page', workspaceId: ctx.workspaceId, resourceId: pageId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ updated: true, id: pageId }) }] };
      } catch (err) {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'bulk_update',
    {
      description: 'Update multiple pages or database rows in a single call.',
      inputSchema: {
        updates: z.array(z.object({
          pageId: z.string().describe('The workspace item ID or database row ID to update'),
          title: z.string().optional().describe('New title'),
          content: z.string().optional().describe('New markdown content'),
          properties: z.record(z.string(), z.any()).optional().describe('Properties to merge'),
        })).describe('List of updates to apply'),
      },
    },
    async ({ updates }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_update', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const results = await bulkUpdatePages(ctx.workspaceId, updates);
        await logActivity(ctx, 'bulk_update', 'success');
        publish({ scope: 'database', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify(results) }] };
      } catch (err) {
        await logActivity(ctx, 'bulk_update', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'delete_page',
    {
      description: 'Delete a workspace page, database, or database row. Requires confirm: true to execute — omit or set false to preview what would be deleted.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row ID to delete'),
        confirm: z.boolean().optional().default(false).describe('Set to true to confirm deletion. Without this flag, returns a preview of what would be deleted.'),
      },
    },
    async ({ pageId, confirm }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'delete_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        if (!confirm) {
          const item = await getAnyPageById(ctx.workspaceId, pageId);
          return { content: [{ type: 'text' as const, text: `This will permanently delete "${item.title}" (type: ${item.type}). Set confirm: true to proceed.` }] };
        }
        const result = await deleteItemFromWorkspace(ctx.workspaceId, pageId);
        await logActivity(ctx, 'delete_page', 'success', result.type, pageId);
        publish({ scope: result.type === 'db-row' ? 'database' : 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: pageId }) }] };
      } catch (err) {
        await logActivity(ctx, 'delete_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'move_item',
    {
      description: 'Move a sidebar item (page or database) to a new parent within the workspace. Pass null to move to workspace root.',
      inputSchema: {
        itemId: z.string().describe('The workspace item ID to move'),
        newParentId: z.string().nullish().describe('New parent item ID. Pass null or omit to move to workspace root.'),
      },
    },
    async ({ itemId, newParentId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await moveItemInWorkspace(ctx.workspaceId, itemId, newParentId ?? null);
        await logActivity(ctx, 'move_item', 'success', 'item', itemId);
        publish({ scope: 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (err) {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create_database',
    {
      description: 'Create a new database with a custom schema. A "Title" text column is always prepended if not provided.',
      inputSchema: {
        name: z.string().describe('Database name'),
        parentId: z.string().optional().describe('Parent workspace item ID (omit for root)'),
        schema: z.array(z.object({
          name: z.string().describe('Column name'),
          type: z.string().describe('Column type: text | number | select | multi_select | date | datetime'),
          options: z.array(z.any()).optional().describe('Select options for select/multi_select columns'),
        })).optional().describe('Column definitions. Omit to use default schema (Title + Status).'),
      },
    },
    async ({ name, parentId, schema }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await createDatabaseInWorkspace(ctx.workspaceId, { name, schema, parentId });
        await logActivity(ctx, 'create_database', 'success', 'database', result.databaseId);
        publish({ scope: 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: result.id, databaseId: result.databaseId }) }] };
      } catch (err) {
        await logActivity(ctx, 'create_database', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update_database_schema',
    {
      description: 'Add or remove columns from a database schema. Removing columns is destructive (data loss) and requires confirm: true. The title column cannot be removed.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        addColumns: z.array(z.object({
          name: z.string().describe('Column name'),
          type: z.string().describe('Column type: text | number | select | multi_select | date | datetime'),
          options: z.array(z.any()).optional().describe('Select options for select/multi_select columns'),
        })).optional().describe('Columns to add'),
        removeColumnIds: z.array(z.string()).optional().describe('Column IDs to remove (use get_database_schema to find IDs). Cannot remove the title column.'),
        confirm: z.boolean().optional().default(false).describe('Required when removing columns. Set to true to confirm the destructive operation.'),
      },
    },
    async ({ databaseId, addColumns, removeColumnIds, confirm }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await updateDatabaseSchemaById(ctx.workspaceId, databaseId, { addColumns, removeColumnIds }, confirm ?? false);
        await logActivity(ctx, 'update_database_schema', 'success', 'database', databaseId);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (err) {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
