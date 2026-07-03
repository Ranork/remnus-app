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
      outputSchema: z.object({
        id: z.string().describe('ID of the created page or row'),
        type: z.string().describe('What was created (page | db-row)'),
      }).passthrough(),
      annotations: { title: 'Create page', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, content, parentId, databaseId, properties }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_page', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await createPageInWorkspace(ctx.workspaceId, { title, content, parentId, databaseId, properties }, { tokenId: ctx.tokenId });
        const out = { id: result.id, type: result.type };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'create_page', 'success', result.type, result.id, text);
        publish({ scope: databaseId ? 'database' : 'sidebar', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
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
      outputSchema: z.object({
        updated: z.boolean().describe('Whether the update was applied'),
        id: z.string().describe('ID of the updated page or row'),
      }).passthrough(),
      annotations: { title: 'Update page', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ pageId, title, content, properties }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        await updatePageById(ctx.workspaceId, pageId, { title, content, properties }, { tokenId: ctx.tokenId });
        const out = { updated: true, id: pageId };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'update_page', 'success', 'page', pageId, text);
        publish({ scope: 'page', workspaceId: ctx.workspaceId, resourceId: pageId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'bulk_update_pages',
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
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string().describe('Updated page or row ID'),
          updated: z.boolean().describe('Whether this update was applied'),
        }).passthrough()).describe('Per-update results'),
      }),
      annotations: { title: 'Bulk update pages', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ updates }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_update_pages', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const results = await bulkUpdatePages(ctx.workspaceId, updates, { tokenId: ctx.tokenId });
        const text = JSON.stringify(results);
        await logActivity(ctx, 'bulk_update_pages', 'success', undefined, undefined, text);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: { results } };
      } catch (err) {
        await logActivity(ctx, 'bulk_update_pages', 'error');
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
      outputSchema: z.object({
        deleted: z.boolean().describe('Whether the item was actually deleted (false for a preview)'),
        id: z.string().optional().describe('ID of the deleted item'),
        preview: z.string().optional().describe('Preview message when confirm was not set'),
      }).passthrough(),
      annotations: { title: 'Delete page', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ pageId, confirm }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'delete_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        if (!confirm) {
          const item = await getAnyPageById(ctx.workspaceId, pageId);
          const preview = `This will permanently delete "${item.title}" (type: ${item.type}). Set confirm: true to proceed.`;
          return { content: [{ type: 'text' as const, text: preview }], structuredContent: { deleted: false, id: pageId, preview } };
        }
        const result = await deleteItemFromWorkspace(ctx.workspaceId, pageId);
        const out = { deleted: true, id: pageId };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'delete_page', 'success', result.type, pageId, text);
        publish({ scope: result.type === 'db-row' ? 'database' : 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
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
      outputSchema: z.object({
        moved: z.boolean().describe('Whether the item was moved'),
      }).passthrough(),
      annotations: { title: 'Move item', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ itemId, newParentId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await moveItemInWorkspace(ctx.workspaceId, itemId, newParentId ?? null);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'move_item', 'success', 'item', itemId, text);
        publish({ scope: 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
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
          type: z.string().describe('Column type: text | number | select | multi_select | status | user | multi_user | date | datetime | checkbox | url | email | phone'),
          options: z.array(z.any()).optional().describe('Options for select/multi_select/status columns. For status, each option may include a group: "todo" | "in_progress" | "complete". user/multi_user store workspace member user ids and need no options.'),
        })).optional().describe('Column definitions. Omit to use default schema (Title + Status).'),
      },
      outputSchema: z.object({
        id: z.string().describe('Workspace item ID of the new database'),
        databaseId: z.string().describe('Database ID used by query/schema tools'),
      }).passthrough(),
      annotations: { title: 'Create database', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, parentId, schema }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await createDatabaseInWorkspace(ctx.workspaceId, { name, schema, parentId });
        const out = { id: result.id, databaseId: result.databaseId };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'create_database', 'success', 'database', result.databaseId, text);
        publish({ scope: 'sidebar', workspaceId: ctx.workspaceId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
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
          type: z.string().describe('Column type: text | number | select | multi_select | status | user | multi_user | date | datetime | checkbox | url | email | phone'),
          options: z.array(z.any()).optional().describe('Options for select/multi_select/status columns. For status, each option may include a group: "todo" | "in_progress" | "complete". user/multi_user store workspace member user ids and need no options.'),
        })).optional().describe('Columns to add'),
        removeColumnIds: z.array(z.string()).optional().describe('Column IDs to remove (use get_database_schema to find IDs). Cannot remove the title column.'),
        confirm: z.boolean().optional().default(false).describe('Required when removing columns. Set to true to confirm the destructive operation.'),
      },
      outputSchema: z.object({
        updated: z.boolean().describe('Whether the schema was updated'),
        schema: z.array(z.any()).describe('The new column schema after the change'),
      }).passthrough(),
      annotations: { title: 'Update database schema', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ databaseId, addColumns, removeColumnIds, confirm }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        const result = await updateDatabaseSchemaById(ctx.workspaceId, databaseId, { addColumns, removeColumnIds }, confirm ?? false);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'update_database_schema', 'success', 'database', databaseId, text);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
