// Results carry the JSON twice (content text + structuredContent) on purpose, and
// only `description` + `inputSchema` reach the model — see the note at the top of
// tools/read.ts before trimming either.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createPageInWorkspace,
  createPagesInWorkspaceBulk,
  updatePageById,
  bulkUpdatePages,
  deleteItemFromWorkspace,
  bulkDeleteItemsFromWorkspace,
  moveItemInWorkspace,
  bulkMoveItemsInWorkspace,
  bulkMoveRowsToDatabase,
  createDatabaseInWorkspace,
  updateDatabaseSchemaById,
  createDatabaseView,
  updateDatabaseView,
  deleteDatabaseView,
  getAnyPageById,
  type SnapshotActor,
} from '@/lib/services/workspace';
import { appUrl, logActivity, type TokenContext } from '../context';
import { createDashboardInWorkspace, patchDashboard } from '@/lib/services/dashboards';
import { recordGeneratedKnowledge, validateContextRunForWrite } from '@/lib/services/knowledge';
import { applyRecurrenceInput, changeRecurrenceForRow } from '@/lib/services/recurrence';
import { addPageComment, MAX_COMMENT_LENGTH } from '@/lib/services/comments';
import { iconInputError, ICON_COLOR_KEYS } from '@/lib/icons';

const READ_ONLY_ERROR = 'Error: This token only has read scope. A write-scoped token is required.';
// Not `.uuid()`: the format check serialized as a ~180-byte regex in every one of
// the 14 write tools' schemas, and the run is looked up by id anyway — a malformed
// value fails exactly like an unknown one.
const CONTEXT_RUN_ID = z.string().max(64).optional().describe('From prepare_context; required in Strict context');
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
  bySetPos: z.literal([-1, 1, 2, 3, 4]).optional().describe('-1 = last'),
  until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
  count: z.number().int().min(1).max(500).optional(),
  dateColumn: z.string().optional().describe('Column id or name; defaults to the first date column'),
}).optional().describe('Repeat this row on a schedule; occurrences become real rows');

const KNOWLEDGE_INPUT = z.object({
  conceptType: z.string().max(120).optional(),
  description: z.string().max(1_000).optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  sources: z.array(z.object({ resource: z.string().max(2_000), title: z.string().max(300).optional() })).max(20).optional(),
  status: z.enum(['draft', 'stable', 'deprecated']).optional(),
  staleAfter: z.string().max(40).optional(),
}).optional().describe('OKF knowledge metadata; agent-authored entries stay draft until a human reviews that revision');

// Icons the sidebar can draw: an emoji or a curated Lucide name. Names are checked in the
// handlers (iconInputError) rather than listed here — tools/list is a fixed per-session
// context cost for every connected agent.
const ICON_INPUT = z.string().max(32).optional().describe('Emoji or "lucide:Name", e.g. "lucide:Map"');
const ICON_COLOR_INPUT = z.enum(ICON_COLOR_KEYS).optional().describe('Color for a lucide icon');
const ICON_PATCH_INPUT = z.string().max(32).nullable().optional().describe('Emoji or "lucide:Name"; null clears');
const ICON_COLOR_PATCH_INPUT = z.enum(ICON_COLOR_KEYS).nullable().optional().describe('Color for a lucide icon; null clears');
const COLUMN_INPUT = z.object({
  name: z.string(),
  type: z.string().describe('text | number | select | multi_select | status | user | multi_user | date | datetime | checkbox | url | email | phone'),
  options: z.array(z.any()).optional().describe('For select/multi_select/status; a status option may carry group: "todo" | "in_progress" | "complete". user/multi_user need none.'),
});
const VIEW_INPUT = z.object({
  name: z.string().max(80),
  type: z.enum(['table', 'kanban', 'calendar']),
  groupByCol: z.string().optional().describe('Kanban: select/status column id or name'),
  dateCol: z.string().optional().describe('Calendar: date column id or name'),
  icon: ICON_INPUT,
  iconColor: ICON_COLOR_INPUT,
});

// Blocks are validated in the handler against src/lib/dashboard/schema.ts, not
// here: seven block shapes in the schema would be the single largest entry in
// tools/list, paid by every session. The catalog is a resource instead, read only
// by an agent that is about to build a dashboard.
// `z.any()` items: a record schema serialized `propertyNames` + `additionalProperties`
// into every one of the four block arrays, and the handler checks shape anyway.
const BLOCKS_INPUT = z.array(z.any()).max(40);
const DASHBOARD_RESULT = z.object({
  id: z.string().describe('Workspace item id of the dashboard'),
  url: z.string().describe('Where a human can see it'),
  blocks: z.array(z.string()).describe('Every block id, in display order'),
  warnings: z.array(z.string()).optional().describe('Blocks that will render empty or broken'),
}).passthrough();

function iconErrorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true as const };
}

function actorId(ctx: TokenContext) {
  return ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`;
}

// Trash snapshot attribution — every MCP delete is agent-authored by definition.
// Same tokenId/oauthTokenId split already used by add_comment's handler.
function agentActor(ctx: TokenContext): SnapshotActor {
  return {
    kind: 'agent',
    label: ctx.agentName ?? 'Agent',
    tokenId: ctx.tokenKind === 'pat' ? ctx.tokenId : null,
    oauthTokenId: ctx.tokenKind === 'oauth' ? ctx.tokenId : null,
  };
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
      description: 'Create a standalone page (parentId to nest it) or a database row (databaseId). Give it an icon. For several, use bulk_create_pages. Row `properties` keys may be column names or ids (case-insensitive); `title` is mirrored into the row\'s title property.',
      inputSchema: {
        title: z.string(),
        content: z.string().optional().describe('Markdown'),
        parentId: z.string().optional().describe('Nest under this item (pages only)'),
        databaseId: z.string().optional().describe('Create a row here instead of a page'),
        properties: z.record(z.string(), z.any()).optional().describe('Row properties'),
        icon: ICON_INPUT,
        iconColor: ICON_COLOR_INPUT,
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
    async ({ title, content, parentId, databaseId, properties, icon, iconColor, recurrence, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_page', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_page');
      if (contextError) return contextError;
      const iconProblem = iconInputError(icon, iconColor);
      if (iconProblem) {
        await logActivity(ctx, 'create_page', 'error');
        return iconErrorResult(iconProblem);
      }
      try {
        const result = await createPageInWorkspace(ctx.workspaceId, { title, content, parentId, databaseId, properties, icon, iconColor }, { tokenId: ctx.tokenId });
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
      description: 'Update a page or row. Only the fields you pass change. `content` replaces the whole body; row `properties` are merged into the existing values, not replaced; `title` also updates the row\'s title property.',
      inputSchema: {
        pageId: z.string().describe('Page or row id'),
        title: z.string().optional(),
        content: z.string().optional().describe('Markdown; replaces the body'),
        properties: z.record(z.string(), z.any()).optional().describe('Merged into the row\'s properties'),
        icon: ICON_PATCH_INPUT,
        iconColor: ICON_COLOR_PATCH_INPUT,
        recurrence: RECURRENCE_INPUT,
        recurrenceScope: z.enum(['thisAndFollowing', 'all']).optional()
          .describe('Required when the row ALREADY repeats: "thisAndFollowing" leaves earlier cards untouched, "all" re-rhythms the whole series. Ask the user rather than guess.'),
        knowledge: KNOWLEDGE_INPUT,
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        updated: z.boolean().describe('Whether the update was applied'),
        id: z.string().describe('ID of the updated page or row'),
        recurrenceError: z.string().optional().describe('Set when the rhythm change was refused — the row update itself still applied'),
      }).passthrough(),
      annotations: { title: 'Update page', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ pageId, title, content, properties, icon, iconColor, recurrence, recurrenceScope, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'update_page', pageId);
      if (contextError) return contextError;
      const iconProblem = iconInputError(icon, iconColor);
      if (iconProblem) {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return iconErrorResult(iconProblem);
      }
      try {
        await updatePageById(ctx.workspaceId, pageId, { title, content, properties, icon, iconColor }, { tokenId: ctx.tokenId }, agentActor(ctx));
        const knowledgeCaptured = await recordGeneratedKnowledge(ctx.workspaceId, pageId, actorId(ctx), knowledge).then(() => true).catch(() => false);

        // Reported, never thrown: the field update above already landed, so a
        // refused rhythm change must not read as "nothing happened".
        let series: Record<string, unknown> | undefined;
        if (recurrence) {
          const applied = await changeRecurrenceForRow(pageId, recurrence, recurrenceScope, actorId(ctx))
            .catch((err) => ({ error: String(err) }));
          series = 'error' in applied
            ? { recurrenceError: applied.error, ...('impact' in applied && applied.impact ? { recurrenceImpact: applied.impact } : {}) }
            : {
                seriesId: applied.seriesId,
                occurrencesCreated: applied.created,
                occurrencesRemoved: applied.removed,
                occurrencesPreserved: applied.preserved,
              };
        }

        const out = { updated: true, id: pageId, knowledgeCaptured, ...series };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'update_page', 'success', 'page', pageId, text);
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
      description: 'Update many pages/rows in one call, each with update_page\'s rules (partial patch, properties merged, title synced). Concurrent and NOT atomic: on an error, entries that already succeeded stay applied and the error does not say which — re-read before retrying.',
      inputSchema: {
        updates: z.array(z.object({
          pageId: z.string().describe('Page or row id'),
          title: z.string().optional(),
          content: z.string().optional().describe('Replaces the body'),
          properties: z.record(z.string(), z.any()).optional().describe('Merged'),
          icon: ICON_PATCH_INPUT,
          iconColor: ICON_COLOR_PATCH_INPUT,
        })),
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
      const iconProblem = updates.map((u) => iconInputError(u.icon, u.iconColor)).find((m) => m !== null);
      if (iconProblem) {
        await logActivity(ctx, 'bulk_update_pages', 'error');
        return iconErrorResult(iconProblem);
      }
      try {
        const results = await bulkUpdatePages(ctx.workspaceId, updates, { tokenId: ctx.tokenId }, agentActor(ctx), { generatedBy: actorId(ctx) });
        const text = JSON.stringify(results);
        await logActivity(ctx, 'bulk_update_pages', 'success', undefined, undefined, text, {
          itemsAffected: results.filter(r => r.updated).length,
        });
        return { content: [{ type: 'text' as const, text }], structuredContent: { results } };
      } catch (err) {
        await logActivity(ctx, 'bulk_update_pages', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'bulk_create_pages',
    {
      description: 'Create up to 100 pages and/or rows in one call — the fast way to fill a database or lay out a section. In order, NOT atomic: each entry reports its own ok/error. Nest under an entry created earlier in the call with `ref` + `parentRef`.',
      inputSchema: {
        pages: z.array(z.object({
          ref: z.string().max(64).optional().describe('Label for parentRef of later entries'),
          title: z.string(),
          content: z.string().optional().describe('Markdown'),
          parentId: z.string().optional().describe('Existing parent id'),
          parentRef: z.string().max(64).optional().describe('ref of an earlier entry in this call'),
          databaseId: z.string().optional().describe('Creates a row here'),
          properties: z.record(z.string(), z.any()).optional().describe('Row properties'),
          icon: ICON_INPUT,
          iconColor: ICON_COLOR_INPUT,
        })).min(1).max(100),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        requested: z.number().describe('Entries in the call'),
        succeeded: z.number().describe('Entries created'),
        failed: z.number().describe('Entries that errored'),
        results: z.array(z.object({
          index: z.number().describe('Position in `pages`'),
          ok: z.boolean().describe('Whether this entry was created'),
          id: z.string().optional().describe('Created page or row ID'),
          type: z.string().optional().describe('page | db-row'),
          ref: z.string().optional().describe('The entry\'s ref, when given'),
          error: z.string().optional().describe('Why this entry was not created'),
        }).passthrough()).describe('Per-entry results'),
      }),
      annotations: { title: 'Bulk create pages', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ pages: entries, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_create_pages', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'bulk_create_pages');
      if (contextError) return contextError;

      // One batched write for the whole call — per-entry ok/error is unchanged,
      // it is just decided in memory before the batch runs rather than by
      // letting each entry take its own trip to the database. See
      // createPagesInWorkspaceBulk.
      let out;
      try {
        out = await createPagesInWorkspaceBulk(
          ctx.workspaceId,
          entries,
          { tokenId: ctx.tokenId },
          { generatedBy: actorId(ctx) },
        );
      } catch (err) {
        await logActivity(ctx, 'bulk_create_pages', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }

      const text = JSON.stringify(out);
      await logActivity(ctx, 'bulk_create_pages', out.succeeded > 0 ? 'success' : 'error', undefined, undefined, text, {
        itemsAffected: out.succeeded,
      });
      return { content: [{ type: 'text' as const, text }], structuredContent: out };
    },
  );

  server.registerTool(
    'delete_page',
    {
      description: 'Delete a page, database, dashboard or row. Without confirm: true it only returns a preview of what would be deleted.',
      inputSchema: {
        pageId: z.string().describe('Page or row id'),
        confirm: z.boolean().optional().default(false),
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
        const result = await deleteItemFromWorkspace(ctx.workspaceId, pageId, agentActor(ctx));
        const out = { deleted: true, id: pageId };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'delete_page', 'success', result.type, pageId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'delete_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'bulk_delete_pages',
    {
      description: 'Delete up to 100 pages, databases or rows. Without confirm: true it only previews. Each entry reports its own ok/error, so one bad id does not sink the batch.',
      inputSchema: {
        pageIds: z.array(z.string()).max(100),
        confirm: z.boolean().optional().default(false),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        deleted: z.boolean().describe('Whether items were actually deleted (false for a preview)'),
        requested: z.number().describe('Number of ids requested'),
        succeeded: z.number().optional().describe('Number successfully deleted (confirm: true only)'),
        failed: z.number().optional().describe('Number that failed (confirm: true only)'),
        results: z.array(z.object({
          id: z.string(),
          ok: z.boolean(),
          error: z.string().optional(),
        })).optional().describe('Per-item result (confirm: true only)'),
        items: z.array(z.object({
          id: z.string(),
          title: z.string(),
          type: z.string(),
        })).optional().describe('Items that would be deleted (preview only)'),
        preview: z.string().optional().describe('Preview message when confirm was not set'),
      }).passthrough(),
      annotations: { title: 'Bulk delete pages', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ pageIds, confirm, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_delete_pages', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      try {
        if (!confirm) {
          const items = await Promise.all(pageIds.map(async (id) => {
            try {
              const item = await getAnyPageById(ctx.workspaceId, id);
              return { id, title: item.title, type: item.type };
            } catch (err) {
              return { id, title: `<${String(err)}>`, type: 'unknown' };
            }
          }));
          const preview = `This will permanently delete ${items.length} item(s). Set confirm: true to proceed.`;
          const out = { deleted: false, requested: pageIds.length, items, preview };
          return { content: [{ type: 'text' as const, text: preview }], structuredContent: out };
        }
        const contextError = await requireContext(ctx, contextRunId, 'bulk_delete_pages');
        if (contextError) return contextError;
        const results = await bulkDeleteItemsFromWorkspace(ctx.workspaceId, pageIds, agentActor(ctx));
        const succeeded = results.filter(r => r.ok).length;
        const out = { deleted: true, requested: pageIds.length, succeeded, failed: results.length - succeeded, results };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'bulk_delete_pages', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'bulk_delete_pages', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'move_item',
    {
      description: 'Move a page or database under a new parent; null = workspace root.',
      inputSchema: {
        itemId: z.string(),
        newParentId: z.string().nullish().describe('null or omitted = root'),
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
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'bulk_move_items',
    {
      description: 'Move up to 100 items. newParentId: reparent pages/databases in the sidebar (null = root). targetDatabaseId: move rows to another database — refused entirely, naming the columns, unless the target covers every source column by name and type; never silently drops a property. Pass exactly one of the two.',
      inputSchema: {
        itemIds: z.array(z.string()).max(100),
        newParentId: z.string().nullable().optional().describe('Sidebar mode; null = root'),
        targetDatabaseId: z.string().optional().describe('Row mode: destination database'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        requested: z.number(),
        succeeded: z.number(),
        failed: z.number(),
        results: z.array(z.object({
          id: z.string(),
          ok: z.boolean(),
          error: z.string().optional(),
        })),
      }).passthrough(),
      annotations: { title: 'Bulk move items', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ itemIds, newParentId, targetDatabaseId, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_move_items', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const hasParent = newParentId !== undefined;
      const hasTarget = !!targetDatabaseId;
      if (hasParent === hasTarget) {
        await logActivity(ctx, 'bulk_move_items', 'error');
        return { content: [{ type: 'text' as const, text: 'Error: pass exactly one of newParentId or targetDatabaseId.' }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'bulk_move_items');
      if (contextError) return contextError;
      try {
        const results = hasTarget
          ? await bulkMoveRowsToDatabase(ctx.workspaceId, itemIds, targetDatabaseId!)
          : await bulkMoveItemsInWorkspace(ctx.workspaceId, itemIds, newParentId ?? null);
        const succeeded = results.filter(r => r.ok).length;
        const out = { requested: itemIds.length, succeeded, failed: results.length - succeeded, results };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'bulk_move_items', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'bulk_move_items', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create_database',
    {
      description: 'Create a database (a Title column is always first). Give it an icon, and pass `views` for the kanban/calendar views people will use — a Table view always exists.',
      inputSchema: {
        name: z.string(),
        parentId: z.string().optional().describe('Omit for root'),
        schema: z.array(COLUMN_INPUT).optional().describe('Omit for the default Title + Status'),
        icon: ICON_INPUT,
        iconColor: ICON_COLOR_INPUT,
        views: z.array(VIEW_INPUT).max(5).optional(),
        knowledge: KNOWLEDGE_INPUT,
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        id: z.string().describe('Workspace item ID of the new database'),
        databaseId: z.string().describe('Database ID used by query/schema tools'),
      }).passthrough(),
      annotations: { title: 'Create database', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, parentId, schema, icon, iconColor, views, knowledge, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_database');
      if (contextError) return contextError;
      const iconProblem = [iconInputError(icon, iconColor), ...(views ?? []).map((v) => iconInputError(v.icon, v.iconColor))]
        .find((m) => m !== null);
      if (iconProblem) {
        await logActivity(ctx, 'create_database', 'error');
        return iconErrorResult(iconProblem);
      }
      try {
        const result = await createDatabaseInWorkspace(ctx.workspaceId, { name, schema, parentId, icon, iconColor });

        // Views are added once the database exists and reported per view rather than thrown:
        // the database itself was created, so failing the call would invite a duplicate retry.
        const viewResults: Array<{ name: string; created: boolean; id?: string; error?: string }> = [];
        for (const view of views ?? []) {
          try {
            const created = await createDatabaseView(ctx.workspaceId, result.databaseId, view);
            viewResults.push({ name: view.name, created: true, id: created.view.id });
          } catch (err) {
            viewResults.push({ name: view.name, created: false, error: err instanceof Error ? err.message : String(err) });
          }
        }
        const knowledgeCaptured = await recordGeneratedKnowledge(ctx.workspaceId, result.id, actorId(ctx), knowledge).then(() => true).catch(() => false);
        const out = { id: result.id, databaseId: result.databaseId, knowledgeCaptured, ...(viewResults.length ? { views: viewResults } : {}) };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'create_database', 'success', 'database', result.databaseId, text);
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
      description: 'Add or remove columns. Removing is destructive (data loss) and needs confirm: true. The title column cannot be removed.',
      inputSchema: {
        databaseId: z.string(),
        addColumns: z.array(COLUMN_INPUT).optional(),
        removeColumnIds: z.array(z.string()).optional().describe('Ids from get_database_schema'),
        confirm: z.boolean().optional().default(false).describe('Required to remove columns'),
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
      description: 'Add a table, kanban or calendar view. Kanban groups by a select/status column and calendar places cards by a date/datetime column — each auto-picked when omitted.',
      inputSchema: {
        databaseId: z.string(),
        name: z.string(),
        type: z.enum(['table', 'kanban', 'calendar']),
        groupByCol: z.string().optional().describe('Kanban: select/status column id or name'),
        dateCol: z.string().optional().describe('Calendar: date/datetime column id or name'),
        icon: z.string().optional().describe('Emoji, "lucide:Name" or image URL'),
        iconColor: z.string().optional().describe('Color for a lucide icon'),
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
      description: 'Rename a view, change its icon, or merge fields into its config (filters, sorts, groupByCol, dateCol, cardProperties…). The type cannot change — create a new view instead. get_database_schema shows view ids and the config shape.',
      inputSchema: {
        databaseId: z.string(),
        viewId: z.string(),
        name: z.string().optional(),
        icon: z.string().optional().describe('Emoji, "lucide:Name" or image URL'),
        iconColor: z.string().optional().describe('Color for a lucide icon'),
        config: z.record(z.string(), z.any()).optional().describe('Partial config to merge, e.g. { "groupByCol": "col_abc" }'),
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
      description: 'Delete a view (confirm: true required). The last view of a database cannot be deleted.',
      inputSchema: {
        databaseId: z.string(),
        viewId: z.string(),
        confirm: z.boolean().optional().default(false),
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
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'delete_database_view', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create_dashboard',
    {
      description: 'Create a dashboard: metric, chart, list, table and text blocks that read live from this workspace\'s databases, written as JSON (no HTML). Read the block catalog and templates first: resource remnus://dashboard/catalog (or remnus.com/wiki/dashboards). The result has the page url and warnings for blocks that will render empty or broken.',
      inputSchema: {
        title: z.string(),
        parentId: z.string().optional().describe('A page to nest under; omit for root'),
        icon: ICON_INPUT,
        iconColor: ICON_COLOR_INPUT,
        blocks: BLOCKS_INPUT.optional().describe('Block objects, see the catalog'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: DASHBOARD_RESULT,
      annotations: { title: 'Create dashboard', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, parentId, icon, iconColor, blocks, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_dashboard', 'error');
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'create_dashboard');
      if (contextError) return contextError;
      const iconProblem = iconInputError(icon, iconColor);
      if (iconProblem) {
        await logActivity(ctx, 'create_dashboard', 'error');
        return iconErrorResult(iconProblem);
      }
      try {
        const result = await createDashboardInWorkspace(ctx.workspaceId, { title, parentId, icon, iconColor, blocks });
        const out = { id: result.id, url: appUrl(ctx, `/dashboard/${result.id}`), blocks: result.blocks, ...(result.warnings ? { warnings: result.warnings } : {}) };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'create_dashboard', 'success', 'dashboard', result.id, text, { itemsAffected: result.blocks.length });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'create_dashboard', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update_dashboard',
    {
      description: 'Patch a dashboard by block id — send only what changes, never the whole spec. All-or-nothing, applied remove → update → add → order. `update` entries are {id, ...fields}, merged into that block (null removes a field; type cannot change). Same result as create_dashboard.',
      inputSchema: {
        dashboardId: z.string(),
        title: z.string().optional(),
        icon: ICON_PATCH_INPUT,
        iconColor: ICON_COLOR_PATCH_INPUT,
        add: BLOCKS_INPUT.optional().describe('New blocks, appended'),
        update: BLOCKS_INPUT.optional(),
        remove: z.array(z.string()).optional().describe('Block ids'),
        order: z.array(z.string()).optional().describe('Block ids in their new order; unlisted ones follow'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: DASHBOARD_RESULT,
      annotations: { title: 'Update dashboard', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ dashboardId, title, icon, iconColor, add, update, remove, order, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_dashboard', 'error', 'dashboard', dashboardId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'update_dashboard', dashboardId);
      if (contextError) return contextError;
      const iconProblem = iconInputError(icon, iconColor);
      if (iconProblem) {
        await logActivity(ctx, 'update_dashboard', 'error', 'dashboard', dashboardId);
        return iconErrorResult(iconProblem);
      }
      try {
        const result = await patchDashboard(ctx.workspaceId, dashboardId, { add, update, remove, order }, { title, icon, iconColor });
        const out = { id: result.id, url: appUrl(ctx, `/dashboard/${result.id}`), blocks: result.blocks, ...(result.warnings ? { warnings: result.warnings } : {}) };
        const text = JSON.stringify(out);
        await logActivity(ctx, 'update_dashboard', 'success', 'dashboard', dashboardId, text, {
          itemsAffected: (add?.length ?? 0) + (update?.length ?? 0) + (remove?.length ?? 0),
        });
        return { content: [{ type: 'text' as const, text }], structuredContent: out };
      } catch (err) {
        await logActivity(ctx, 'update_dashboard', 'error', 'dashboard', dashboardId);
        return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'add_comment',
    {
      description: 'Add a comment to a page or row — a thread separate from the body, for running notes or a closure note. Agent comments cannot be edited or deleted afterwards; use update_page for content you may need to revise.',
      inputSchema: {
        pageId: z.string().describe('Page or row id'),
        body: z.string().max(MAX_COMMENT_LENGTH),
        kind: z.enum(['note', 'closure']).optional().default('note').describe('"closure" marks a wrap-up note'),
        contextRunId: CONTEXT_RUN_ID,
      },
      outputSchema: z.object({
        id: z.string(),
        createdAt: z.any(),
      }).passthrough(),
      annotations: { title: 'Add comment', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ pageId, body, kind, contextRunId }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'add_comment', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: READ_ONLY_ERROR }], isError: true };
      }
      const contextError = await requireContext(ctx, contextRunId, 'add_comment', pageId);
      if (contextError) return contextError;
      try {
        const result = await addPageComment({
          workspaceId: ctx.workspaceId,
          pageId,
          body,
          kind,
          authorKind: 'agent',
          authorLabel: ctx.agentName ?? 'Agent',
          tokenId: ctx.tokenKind === 'pat' ? ctx.tokenId : null,
          oauthTokenId: ctx.tokenKind === 'oauth' ? ctx.tokenId : null,
        });
        const text = JSON.stringify(result);
        await logActivity(ctx, 'add_comment', 'success', 'page', pageId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'add_comment', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
