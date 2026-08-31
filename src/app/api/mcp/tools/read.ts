import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  searchWorkspace,
  listWorkspaceItems,
  listWorkspaceMembers,
  queryAuditLog,
  getAnyPageById,
  getPagesByIds,
  getDatabaseSchema,
  queryDatabaseRows,
  buildContentOutline,
  getChangesSince,
  getRelatedPages,
} from '@/lib/services/workspace';
import { prepareContextPack } from '@/lib/services/contextPack';
import { listPageComments } from '@/lib/services/comments';
import { logActivity, type TokenContext } from '../context';

export function registerReadTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'prepare_context',
    {
      description: 'Build one task-specific, token-budgeted context pack from relevant workspace pages. Ranks lexical matches, prefers human-reviewed OKF knowledge, penalizes stale/deprecated concepts, and adds the top result\'s link-graph neighbors. Use this before multi-page product or coding work instead of many search/get_page calls.',
      inputSchema: {
        task: z.string().min(3).max(2_000).describe('The concrete task or question to gather context for'),
        maxTokens: z.number().int().min(1_000).max(16_000).optional().default(2_000).describe('Approximate maximum tokens in the returned JSON'),
        maxConcepts: z.number().int().min(1).max(16).optional().default(6).describe('Maximum page concepts to include'),
        trustPolicy: z.enum(['any', 'prefer-human-reviewed', 'human-reviewed-only']).optional().default('prefer-human-reviewed'),
        includeRelated: z.boolean().optional().default(true).describe('Include title/id references from the top concept\'s graph neighborhood'),
      },
      outputSchema: z.object({
        profile: z.literal('remnus-context-pack-v2'),
        task: z.string(),
        retrieval: z.string(),
        handling: z.string(),
        policy: z.object({ trustPolicy: z.string(), humanReviewedMeans: z.string() }),
        budgetTokens: z.number(),
        estimatedTokens: z.number(),
        truncated: z.boolean(),
        contextRunId: z.string().optional(),
        expiresAt: z.string().optional(),
        concepts: z.array(z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          content: z.string(),
          metadata: z.record(z.string(), z.any()),
        }).passthrough()),
        related: z.array(z.object({ id: z.string(), title: z.string(), relation: z.string() }).passthrough()),
        warnings: z.array(z.string()),
      }),
      annotations: { title: 'Prepare agent context', readOnlyHint: true, openWorldHint: false },
    },
    async ({ task, maxTokens, maxConcepts, trustPolicy, includeRelated }) => {
      try {
        const pack = await prepareContextPack(ctx.workspaceId, { task, maxTokens, maxConcepts, trustPolicy, includeRelated }, undefined, ctx);
        const text = JSON.stringify(pack);
        await logActivity(ctx, 'prepare_context', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: { ...pack } };
      } catch (err) {
        await logActivity(ctx, 'prepare_context', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'search_workspace',
    {
      description: 'Search the workspace by title and content. Matches standalone pages, databases, and database rows (each row is a page) on their title or body text. Use it to locate an item before reading or updating it.',
      inputSchema: {
        query: z.string().describe('Text to match against item titles and content (case-insensitive substring)'),
        limit: z.number().optional().default(10).describe('Maximum results (default 10)'),
      },
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string().describe('Pass to get_page'),
          type: z.string().describe('page | database | database_row'),
          title: z.string(),
          breadcrumb: z.array(z.string()).describe('Path from workspace root'),
          matchedOn: z.string().describe('title | content'),
          snippet: z.string(),
          databaseId: z.string().optional().describe('Present for database_row results'),
          parentId: z.string().optional(),
        }).passthrough()).describe('Matching items'),
      }),
      annotations: { title: 'Search workspace', readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      try {
        const results = await searchWorkspace(ctx.workspaceId, query, limit ?? 10);
        const text = JSON.stringify(results);
        await logActivity(ctx, 'search_workspace', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: { results } };
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
          id: z.string(),
          type: z.string().describe('page | database'),
          title: z.string(),
          parentId: z.string().nullable().optional(),
          icon: z.string().nullable().optional(),
          databaseId: z.string().optional().describe('Present for database items'),
        }).passthrough()),
        hasMore: z.boolean(),
        nextCursor: z.string().optional().describe('Pass back as cursor to continue'),
      }),
      annotations: { title: 'List workspace items', readOnlyHint: true, openWorldHint: false },
    },
    async ({ parentId, limit, cursor }) => {
      try {
        const result = await listWorkspaceItems(ctx.workspaceId, parentId, limit ?? 100, cursor);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'list_workspace', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'list_workspace', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_page',
    {
      description: 'Get content of a workspace page or database row by its ID. Auto-detects the type — no flags needed. Pass mode: "outline" for a token-cheap skim (headings + first line of each section) before deciding whether to fetch the full content.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row ID'),
        mode: z.enum(['full', 'outline']).optional().default('full').describe('"full" (default) returns the whole markdown body; "outline" returns only headings + the first line of each section — use it to skim long pages cheaply, then re-fetch with "full" if needed'),
        includeComments: z.boolean().optional().default(false).describe('Include the page\'s comment thread (default false, so ordinary reads stay cheap)'),
      },
      outputSchema: z.object({
        id: z.string(),
        type: z.string().describe('page | database'),
        title: z.string().optional(),
        content: z.string().optional().describe('Markdown body (collapsed in outline mode)'),
        icon: z.string().nullable().optional(),
        properties: z.any().optional().describe('Database-row properties (rows only)'),
        databaseId: z.string().nullable().optional(),
        mode: z.string().optional().describe('"outline" when collapsed'),
        fullContentChars: z.number().optional().describe('Full body size in chars (outline mode) — gauge whether a "full" fetch is worth it'),
        recurrence: z.any().optional().describe('Present when this row is one occurrence of a repeating series: seriesId, occurrenceDate, detached, rule, occurrences'),
        comments: z.array(z.object({
          id: z.string(),
          body: z.string(),
          kind: z.string().describe('note | closure'),
          authorKind: z.string().describe('human | agent'),
          authorLabel: z.string(),
          createdAt: z.any(),
        })).optional().describe('Present only when includeComments is true'),
      }).passthrough(),
      annotations: { title: 'Get page', readOnlyHint: true, openWorldHint: false },
    },
    async ({ pageId, mode, includeComments }) => {
      try {
        const page = await getAnyPageById(ctx.workspaceId, pageId);
        const payload: Record<string, unknown> = mode === 'outline' && page.content
          ? { ...page, content: buildContentOutline(page.content), mode: 'outline', fullContentChars: page.content.length }
          : page;
        if (includeComments) {
          const comments = await listPageComments(pageId);
          payload.comments = comments.map(({ authorUserId: _authorUserId, authorImage: _authorImage, ...c }) => c);
        }
        const text = JSON.stringify(payload);
        await logActivity(ctx, 'get_page', 'success', 'page', pageId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: payload };
      } catch (err) {
        await logActivity(ctx, 'get_page', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_pages',
    {
      description: 'Get multiple workspace pages or database rows by ID in one call — for a specific, already-known, possibly mixed list of IDs (e.g. from search_workspace, get_related_pages, or get_changes_since). One missing/inaccessible ID does not fail the batch — check each entry\'s "ok" field. For many rows that share one database, prefer query_database with filters/fields instead of this — it is one query, not N lookups.',
      inputSchema: {
        pageIds: z.array(z.string()).min(1).max(50).describe('Page/row IDs to fetch (max 50)'),
        mode: z.enum(['full', 'outline']).optional().default('full').describe('Same as get_page — "outline" collapses each body to headings + first line per section'),
      },
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string(),
          ok: z.boolean(),
          page: z.any().optional().describe('Present when ok is true — same shape as get_page\'s output'),
          error: z.string().optional().describe('Present when ok is false'),
        }).passthrough()),
      }),
      annotations: { title: 'Get pages by ID', readOnlyHint: true, openWorldHint: false },
    },
    async ({ pageIds, mode }) => {
      try {
        const results = await getPagesByIds(ctx.workspaceId, pageIds);
        const shaped = results.map(r =>
          r.ok && r.page && mode === 'outline' && r.page.content
            ? { ...r, page: { ...r.page, content: buildContentOutline(r.page.content), mode: 'outline', fullContentChars: r.page.content.length } }
            : r,
        );
        const text = JSON.stringify({ results: shaped });
        await logActivity(ctx, 'get_pages', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: { results: shaped } };
      } catch (err) {
        await logActivity(ctx, 'get_pages', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_database_schema',
    {
      description: 'Get the column schema and saved views of a database, without fetching any rows. Use this to inspect column names/types/options before querying, or view ids/configs before calling create_database_view / update_database_view / delete_database_view.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
      },
      outputSchema: z.object({
        name: z.string(),
        schema: z.array(z.any()).nullable().describe('Column definitions (id, name, type, options)'),
        views: z.array(z.any()).describe('Saved views — always at least one'),
      }).passthrough(),
      annotations: { title: 'Get database schema', readOnlyHint: true, openWorldHint: false },
    },
    async ({ databaseId }) => {
      try {
        const result = await getDatabaseSchema(ctx.workspaceId, databaseId);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'get_database_schema', 'success', 'database', databaseId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
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
          id: z.string(),
          tool: z.string(),
          status: z.string().describe('success | error'),
          targetType: z.string().nullable().optional(),
          targetId: z.string().nullable().optional(),
          createdAt: z.any(),
          agentName: z.string().nullable().optional(),
          tokenName: z.string().nullable().optional(),
        }).passthrough()).describe('Newest first'),
      }),
      annotations: { title: 'Query audit log', readOnlyHint: true, openWorldHint: false },
    },
    async ({ tool, status, from, to, limit }) => {
      try {
        const rows = await queryAuditLog(ctx.workspaceId, { tool, status, from, to }, limit ?? 50);
        const text = JSON.stringify(rows);
        await logActivity(ctx, 'query_audit_log', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: { entries: rows } };
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
          userId: z.string(),
          name: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          role: z.string().describe('owner | member | viewer'),
          joinedAt: z.any().optional(),
        }).passthrough()).describe('Oldest first'),
      }),
      annotations: { title: 'List members', readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const members = await listWorkspaceMembers(ctx.workspaceId);
        const text = JSON.stringify(members);
        await logActivity(ctx, 'list_members', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: { members } };
      } catch (err) {
        await logActivity(ctx, 'list_members', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'query_database',
    {
      description: 'Get schema and rows of a database. Row markdown bodies are NOT included by default — add "content" to fields when you need them, or get_page a single row. Optionally filter rows by property values, and project with fields to fetch only the columns you need (much cheaper on wide tables). Supports cursor-based pagination.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        limit: z.number().optional().default(50).describe('Maximum rows per page (default 50)'),
        filters: z.record(z.string(), z.any()).optional().describe('Filter rows by property value, e.g. {"status": "Done"} or {"col_xxx": ["Tag1"]}'),
        fields: z.array(z.string()).optional().describe('Only return these columns (match by column id or name, case-insensitive); row title is always included. Add "content" to include row markdown bodies (omitted by default). Omit fields for all columns without bodies.'),
        cursor: z.string().optional().describe('Pagination cursor from a previous response\'s nextCursor field'),
      },
      outputSchema: z.object({
        schema: z.any().optional().describe('Column schema (trimmed when projecting with fields)'),
        rows: z.array(z.any()).describe('Rows carry `recurring: true` when they belong to a repeating series — call get_page for the rule before changing its rhythm'),
        hasMore: z.boolean().optional(),
        nextCursor: z.string().optional().describe('Pass back as cursor to continue'),
      }).passthrough(),
      annotations: { title: 'Query database', readOnlyHint: true, openWorldHint: false },
    },
    async ({ databaseId, limit, filters, fields, cursor }) => {
      try {
        const result = await queryDatabaseRows(ctx.workspaceId, databaseId, limit ?? 50, filters, cursor, fields);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'query_database', 'success', 'database', databaseId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'query_database', 'error', 'database', databaseId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_changes_since',
    {
      description: 'Get a compact list of everything that changed in the workspace since a given time or a previous call\'s cursor — pages/databases edited, database rows edited, and items deleted. Built for recurring agents (daily report, standup, memory refresh) so they can sync incrementally instead of re-reading the whole workspace every run. Omit both `since` and `cursor` to bootstrap a full crawl, saving the returned `nextCursor` (or the latest `updatedAt`) for the next call.',
      inputSchema: {
        since: z.string().optional().describe('ISO 8601 timestamp — only return changes after this time (e.g. "2026-07-01T00:00:00Z"). Ignored when cursor is provided. Omit both for a full crawl.'),
        cursor: z.string().optional().describe('Pagination cursor from a previous response\'s nextCursor field — takes priority over since for resuming a sync'),
        limit: z.number().optional().default(100).describe('Maximum changes per page (default 100)'),
      },
      outputSchema: z.object({
        changes: z.array(z.object({
          id: z.string().describe('Pass to get_page or query_database'),
          type: z.string().describe('page | database | database_row'),
          title: z.string(),
          changeType: z.string().describe('created | updated | deleted'),
          updatedAt: z.string(),
          databaseId: z.string().optional().describe('Present for database_row entries'),
        }).passthrough()).describe('Chronological, oldest first'),
        hasMore: z.boolean(),
        nextCursor: z.string().optional().describe('Pass back as cursor to continue or resume a later sync'),
      }),
      annotations: { title: 'Get changes since', readOnlyHint: true, openWorldHint: false },
    },
    async ({ since, cursor, limit }) => {
      try {
        const result = await getChangesSince(ctx.workspaceId, since, cursor, limit ?? 100);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'get_changes_since', 'success', undefined, undefined, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'get_changes_since', 'error');
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );

  const relatedRefSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.string().describe('page | database | database_row'),
    databaseId: z.string().optional().describe('Present for databases — pass to query_database'),
    linkKind: z.string().optional().describe('page_link | child_block'),
  }).passthrough();

  server.registerTool(
    'get_related_pages',
    {
      description: 'Get a page\'s knowledge-graph neighborhood in one compact call: its parent, child pages, outgoing links (pages its body references via inline @-links or child blocks), backlinks (pages whose bodies reference it), and — for database rows — sibling rows in the same database. Titles and IDs only, no page bodies, so it costs a fraction of re-reading pages; follow up with get_page on the neighbors that matter.',
      inputSchema: {
        pageId: z.string().describe('Page ID — a standalone page, database, or database row (same IDs get_page accepts)'),
      },
      outputSchema: z.object({
        page: z.object({
          id: z.string(),
          title: z.string(),
          type: z.string().describe('page | database | database_row'),
        }).passthrough().describe('The subject page'),
        parent: relatedRefSchema.nullable().describe('Sidebar parent (for a row, its database); null at root'),
        children: z.array(relatedRefSchema).describe('Nested under this page'),
        outgoingLinks: z.array(relatedRefSchema).describe('Pages this page\'s body references (children excluded)'),
        backlinks: z.array(relatedRefSchema).describe('Pages referencing this page (parent excluded)'),
        siblings: z.object({
          total: z.number(),
          items: z.array(z.object({ id: z.string(), title: z.string() })).describe('Up to 10'),
        }).nullable().describe('Same-database rows — database_row subjects only, null otherwise'),
      }),
      annotations: { title: 'Get related pages', readOnlyHint: true, openWorldHint: false },
    },
    async ({ pageId }) => {
      try {
        const result = await getRelatedPages(ctx.workspaceId, pageId);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'get_related_pages', 'success', 'page', pageId, text);
        return { content: [{ type: 'text' as const, text }], structuredContent: result };
      } catch (err) {
        await logActivity(ctx, 'get_related_pages', 'error', 'page', pageId);
        return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
      }
    },
  );
}
