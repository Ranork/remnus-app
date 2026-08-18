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
  createDatabaseView,
  updateDatabaseView,
  deleteDatabaseView,
  getAnyPageById,
} from '@/lib/services/workspace';
import { publish } from '@/lib/realtime/publish';
import { logActivity, type TokenContext } from '../context';
import { recordGeneratedKnowledge, validateContextRunForWrite } from '@/lib/services/knowledge';
import { applyRecurrenceInput } from '@/lib/services/recurrence';

const READ_ONLY_ERROR = 'Error: This token only has read scope. A write-scoped token is required.';
const CONTEXT_RUN_ID = z.string().uuid().optional().describe('prepare_context contextRunId. Required for mutations when the workspace uses Strict context.');
// Flattened rule (`until`/`count` instead of the nested `end` union) — a tool
// schema reads better without a discriminated union, and every field beyond
// `freq` is optional so the common "every Monday" call stays one line.
// Descriptions stay terse on purpose: tools/list is a fixed per-session context
// cost for every connected agent.
const RECURRENCE_INPUT = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(99).optional().describe('1 = every, 2 = every other'),
  byWeekday: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
  monthlyMode: z.enum(['dayOfMonth', 'nthWeekday', 'lastDay']).optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  bySetPos: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().describe('-1 = last'),
  until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
  count: z.number().int().min(1).max(500).optional(),
  dateColumn: z.string().optional().describe('Column id or name; defaults to the first date column'),
}).optional().describe('Repeat this database row on a schedule. Occurrences are created as real rows.');

const KNOWLEDGE_INPUT = z.object({
  conceptType: z.string().max(120).optional(),
  description: z.string().max(1_000).optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  sources: z.array(z.object({ resource: z.string().max(2_000), title: z.string().max(300).optional() })).max(20).optional(),
  status: z.enum(['draft', 'stable', 'deprecated']).optional(),
  staleAfter: z.string().max(40).optional(),
}).optional().describe('Optional OKF-aligned knowledge metadata. Agent-authored knowledge remains draft/machine-confirmed until a Remnus user reviews the exact revision.');

function actorId(ctx: TokenContext) {
  return ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`;
}

async function requireContext(ctx: TokenContext, contextRunId: string | undefined, tool: string, targetId?: string) {
  const gate = await validateContextRunForWrite(ctx, contextRunId);
  if (gate.ok) return null;
  await logActivity(ctx, tool, 'error', undefined, targetId);
  return {
    content: [{ type: 'text' as const, text: `Error: CONTEXT_REQUIRED. ${gate.reason}` }],
    isError: true as const,
  };
}

export function registerWriteTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'create_page',
    {
      description: 'Create a new standalone page (use parentId to nest it) or a database row (use databaseId). For rows, `properties` keys may be column names or ids (matched case-insensitively); `title` is always mirrored into the row\'s own title property.',
      inputSchema: {
        title: z.string().describe('Page title'),
        content: z.string().optional().describe('Initial markdown content'),
        parentId: z.string().optional().describe('Parent workspace item ID (for standalone pages)'),
        databaseId: z.string().optional().describe('Database ID (creates a database row instead of a page)'),
        properties: z.record(z.string(), z.any()).optional().describe('Initial properties (for database rows)'),
        recurrence: RECURRENCE_INPUT,
        knowledge: KNOWLEDGE_INPUT,
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        id: z.string().describe('ID of the created page or row'),
        type: z.string().describe('What was created (page | db-row)'),
      }).passthrough(),
      annotations: { title: 'Create page', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, content, parentId, databaseId, properties, recurrence, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_page', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_page');
      if (contextError) return contextError;
      try {
        const result = await createPageInWorkspace(ctx.workspaceId, { title, content, parentId, databaseId, properties }, { tokenId: ctx.tokenId });
        const knowledgeCaptured = await recordGeneratedKnowledge(ctx.workspaceId, result.id, actorId(ctx), knowledge).then(() => true).catch(() => false);

        // Recurrence is applied after the row exists, and its failure is
        // reported rather than thrown: the row was created successfully, so
        // turning that into a tool error would leave the agent thinking nothing
        // happened and retrying into a duplicate.
        let series: Record<string, unknown> | undefined;
        if (recurrence && databaseId && result.type === 'db-row') {
          const applied = await applyRecurrenceInput(result.id, databaseId, recurrence, actorId(ctx))
            .catch((err) => ({ error: String(err) }));
          series = 'error' in applied
            ? { recurrenceError: applied.error }
            : { seriesId: applied.seriesId, occurrencesCreated: applied.created };
        } else if (recurrence) {
          series = { recurrenceError: 'Recurrence applies to database rows only — pass databaseId.' };
        }

        const out = { id: result.id, type: result.type, knowledgeCaptured, ...series };
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
      description: 'Update a page or database row. Only the fields you pass are changed — omit a field to leave it untouched. For rows, `properties` are merged into the existing values (not replaced), and `title` also updates the row\'s title property so the change shows up in table views.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row ID to update'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New markdown content'),
        properties: z.record(z.string(), z.any()).optional().describe('Properties to merge (for database rows)'),
        knowledge: KNOWLEDGE_INPUT,
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        updated: z.boolean().describe('Whether the update was applied'),
        id: z.string().describe('ID of the updated page or row'),
      }).passthrough(),
      annotations: { title: 'Update page', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ pageId, title, content, properties, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'update_page', pageId);
      if (contextError) return contextError;
      try {
        await updatePageById(ctx.workspaceId, pageId, { title, content, properties }, { tokenId: ctx.tokenId });
        const knowledgeCaptured = await recordGeneratedKnowledge(ctx.workspaceId, pageId, actorId(ctx), knowledge).then(() => true).catch(() => false);
        const out = { updated: true, id: pageId, knowledgeCaptured };
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
      description: 'Update multiple pages or database rows in one call — same merge semantics as update_page per entry (partial patch, properties merged, title synced). Updates run concurrently and are NOT atomic: if one entry fails the call returns an error, but entries that already succeeded stay applied and the error does not say which ones. Validate ids first for large batches, and re-read before retrying after a failure.',
      inputSchema: {
        updates: z.array(z.object({
          pageId: z.string().describe('The workspace item ID or database row ID to update'),
          title: z.string().optional().describe('New title'),
          content: z.string().optional().describe('New markdown content'),
          properties: z.record(z.string(), z.any()).optional().describe('Properties to merge'),
        })).describe('List of updates to apply'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string().describe('Updated page or row ID'),
          updated: z.boolean().describe('Whether this update was applied'),
        }).passthrough()).describe('Per-update results'),
      }),
      annotations: { title: 'Bulk update pages', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ updates, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_update_pages', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'bulk_update_pages');
      if (contextError) return contextError;
      try {
        const results = await bulkUpdatePages(ctx.workspaceId, updates, { tokenId: ctx.tokenId });
        await Promise.allSettled(updates.map(update => recordGeneratedKnowledge(ctx.workspaceId, update.pageId, actorId(ctx))));
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
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        deleted: z.boolean().describe('Whether the item was actually deleted (false for a preview)'),
        id: z.string().optional().describe('ID of the deleted item'),
        preview: z.string().optional().describe('Preview message when confirm was not set'),
      }).passthrough(),
      annotations: { title: 'Delete page', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ pageId, confirm, contextRunId }) => {
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
        const contextError = await requireContext(ctx, contextRunId, 'delete_page', pageId);
        if (contextError) return contextError;
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
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        moved: z.boolean().describe('Whether the item was moved'),
      }).passthrough(),
      annotations: { title: 'Move item', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ itemId, newParentId, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'move_item', itemId);
      if (contextError) return contextError;
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
        knowledge: KNOWLEDGE_INPUT,
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        id: z.string().describe('Workspace item ID of the new database'),
        databaseId: z.string().describe('Database ID used by query/schema tools'),
      }).passthrough(),
      annotations: { title: 'Create database', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, parentId, schema, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_database');
      if (contextError) return contextError;
      try {
        const result = await createDatabaseInWorkspace(ctx.workspaceId, { name, schema, parentId });
        const knowledgeCaptured = await recordGeneratedKnowledge(ctx.workspaceId, result.id, actorId(ctx), knowledge).then(() => true).catch(() => false);
        const out = { id: result.id, databaseId: result.databaseId, knowledgeCaptured };
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
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        updated: z.boolean().describe('Whether the schema was updated'),
        schema: z.array(z.any()).describe('The new column schema after the change'),
      }).passthrough(),
      annotations: { title: 'Update database schema', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ databaseId, addColumns, removeColumnIds, confirm, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'update_database_schema', databaseId);
      if (contextError) return contextError;
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

  const viewSchema = z.object({
    id: z.string().describe('View ID'),
    name: z.string().describe('View name'),
    config: z.record(z.string(), z.any()).describe('View configuration (shape depends on config.type)'),
    icon: z.string().optional(),
    iconColor: z.string().optional(),
  }).passthrough();

  server.registerTool(
    'create_database_view',
    {
      description: 'Add a new saved view (table, kanban, or calendar) to a database. Kanban groups by a select/status column (auto-picks one if omitted); calendar places cards by a date/datetime column (auto-picks one if omitted). Use get_database_schema first to see column ids/names.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        name: z.string().describe('Name for the new view (e.g. "By Assignee")'),
        type: z.enum(['table', 'kanban', 'calendar']).describe('View type'),
        groupByCol: z.string().optional().describe('Kanban only: select/status column id or name to group by. Auto-picks the first status/select column if omitted.'),
        dateCol: z.string().optional().describe('Calendar only: date/datetime column id or name to place cards on. Auto-picks the first date/datetime column if omitted.'),
        icon: z.string().optional().describe('Emoji, "lucide:Name", or image URL for the view tab'),
        iconColor: z.string().optional().describe('Theme color for a lucide icon'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        created: z.boolean(),
        view: viewSchema,
      }).passthrough(),
      annotations: { title: 'Create database view', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ databaseId, name, type, groupByCol, dateCol, icon, iconColor, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_database_view', databaseId);
      if (contextError) return contextError;
      try {
        const result = await createDatabaseView(ctx.workspaceId, databaseId, { name, type, groupByCol, dateCol, icon, iconColor });
        const text = JSON.stringify(result);
        await logActivity(ctx, 'create_database_view', 'success', 'database', databaseId, text);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'create_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update_database_view',
    {
      description: 'Rename a database view, change its icon, or patch fields within its existing config (filters, sorts, groupByCol, dateCol, cardProperties, etc — merged into the current config). The view\'s type (table/kanban/calendar) cannot be changed; create a new view instead. Use get_database_schema to find view ids and current config shape.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        viewId: z.string().describe('View ID (from get_database_schema)'),
        name: z.string().optional().describe('New view name'),
        icon: z.string().optional().describe('Emoji, "lucide:Name", or image URL'),
        iconColor: z.string().optional().describe('Theme color for a lucide icon'),
        config: z.record(z.string(), z.any()).optional().describe('Partial config fields to merge in, e.g. { "groupByCol": "col_abc123" } or { "filters": [...] }'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        updated: z.boolean(),
        view: viewSchema,
      }).passthrough(),
      annotations: { title: 'Update database view', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ databaseId, viewId, name, icon, iconColor, config, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'update_database_view', databaseId);
      if (contextError) return contextError;
      try {
        const result = await updateDatabaseView(ctx.workspaceId, databaseId, viewId, { name, icon, iconColor, config });
        const text = JSON.stringify(result);
        await logActivity(ctx, 'update_database_view', 'success', 'database', databaseId, text);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'update_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'delete_database_view',
    {
      description: 'Delete a saved view from a database. Requires confirm: true. A database must always keep at least one view.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        viewId: z.string().describe('View ID (from get_database_schema)'),
        confirm: z.boolean().optional().default(false).describe('Set to true to confirm deletion.'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        deleted: z.boolean(),
      }).passthrough(),
      annotations: { title: 'Delete database view', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ databaseId, viewId, confirm, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'delete_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      if (confirm) {
        const contextError = await requireContext(ctx, contextRunId, 'delete_database_view', databaseId);
        if (contextError) return contextError;
      }
      try {
        const result = await deleteDatabaseView(ctx.workspaceId, databaseId, viewId, confirm ?? false);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'delete_database_view', 'success', 'database', databaseId, text);
        publish({ scope: 'database', workspaceId: ctx.workspaceId, resourceId: databaseId, actorId: actorId(ctx) });
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'delete_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
