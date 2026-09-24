// Every tool here answers with the same JSON twice: `content[0].text` and
// `structuredContent`. That is deliberate, not an oversight to trim (measured and
// decided 2026-09-22, see docs/mcp/token-efficient-usage.md):
//   • Claude Code hands the model ONLY structuredContent when both are present
//     (anthropics/claude-code#55677, #79944), Claude Desktop and Cursor hand it
//     ONLY the text block (blockscout/mcp-server#324 broke exactly by shortening
//     the text). Dropping either copy blinds one family of clients; keeping both
//     costs the model nothing, since each client forwards one.
//   • The MCP SDK refuses a result without structuredContent once a tool declares
//     outputSchema, and outputSchema itself never reaches the model (the tools
//     API has no output-schema field) — only `description` + `inputSchema` do.
//     Those two are the per-session token cost, so they are kept terse; output
//     schemas and annotations are wire-only and may stay descriptive.
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
import { MAX_CONTEXT_KEYWORD_CHARS, MAX_CONTEXT_KEYWORDS, prepareContextPackWithStats } from '@/lib/services/contextPack';
import { listPageComments } from '@/lib/services/comments';
import { getPagesForResource } from '@/lib/services/codeSources';
import { appUrl, logActivity, type TokenContext } from '../context';

type PageRead = Awaited<ReturnType<typeof getAnyPageById>>;

/**
 * A dashboard's body is its spec. `get_page` hands it back as an object under
 * `spec` rather than as the JSON string the service stores in `content` — an
 * escaped string costs a backslash per quote — and in outline mode as just the
 * block list, which is all an agent needs to pick ids for update_dashboard.
 */
function shapeDashboardRead(page: PageRead, mode: 'full' | 'outline', ctx: TokenContext): Record<string, unknown> {
  // `properties` is always undefined for a dashboard, so it drops out of the JSON on its own.
  const { content, ...rest } = page;
  let spec: { blocks?: unknown } | null = null;
  try {
    spec = content ? JSON.parse(content) : null;
  } catch {
    spec = null;
  }
  const url = appUrl(ctx, `/dashboard/${page.id}`);
  if (mode !== 'outline') return { ...rest, url, spec };
  const blocks = Array.isArray(spec?.blocks) ? (spec.blocks as Record<string, unknown>[]) : [];
  return {
    ...rest,
    url,
    mode: 'outline',
    blocks: blocks.map((b) => ({ id: b?.id, type: b?.type, ...(b?.title ? { title: b.title } : {}) })),
  };
}

export function registerReadTools(server: McpServer, ctx: TokenContext) {
  server.registerTool(
    'prepare_context',
    {
      description: 'Build a task-specific, token-budgeted context pack from the most relevant pages: lexical rank, human-reviewed knowledge preferred, stale/deprecated concepts penalized, plus the top hits\' link neighbors. Use it before multi-page product or coding work instead of many search/get_page calls.',
      inputSchema: {
        task: z.string().min(3).max(2_000).describe('The concrete task or question'),
        keywords: z.array(z.string().max(MAX_CONTEXT_KEYWORD_CHARS)).max(MAX_CONTEXT_KEYWORDS).optional()
          .describe('Synonyms, and the workspace\'s language (e.g. English terms for a Turkish task)'),
        maxTokens: z.number().int().min(1_000).max(16_000).optional().default(2_000).describe('Budget for the returned JSON, approx. tokens'),
        maxConcepts: z.number().int().min(1).max(16).optional().default(6),
        trustPolicy: z.enum(['any', 'prefer-human-reviewed', 'human-reviewed-only']).optional().default('prefer-human-reviewed'),
        includeRelated: z.boolean().optional().default(true).describe('Add title/id refs from the top concepts\' link neighborhoods'),
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
    async ({ task, keywords, maxTokens, maxConcepts, trustPolicy, includeRelated }) => {
      try {
        const { pack, stats } = await prepareContextPackWithStats(ctx.workspaceId, { task, keywords, maxTokens, maxConcepts, trustPolicy, includeRelated }, undefined, ctx);
        const text = JSON.stringify(pack);
        await logActivity(ctx, 'prepare_context', 'success', undefined, undefined, text, {
          analytics: { ...stats, conceptCount: pack.concepts.length },
        });
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
      description: 'Case- and accent-insensitive search over titles and bodies of pages, databases and rows, best matches first. Use it to locate an item by text when the workspace map does not already give you its id.',
      inputSchema: {
        query: z.string(),
        limit: z.number().optional().default(10),
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
      description: 'List sidebar items (pages and databases), optionally under one parent; paginated. For orientation the workspace digest/map is cheaper.',
      inputSchema: {
        parentId: z.string().optional().describe('Omit for root items'),
        limit: z.number().optional().default(100),
        cursor: z.string().optional().describe('nextCursor from the previous page'),
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
        const listed = await listWorkspaceItems(ctx.workspaceId, parentId, limit ?? 100, cursor);
        // `parentId: null` (root) and `icon: null` are ~15% of this payload on a
        // typical tree; both are optional in the schema and absence reads the same.
        const result = {
          ...listed,
          items: listed.items.map(({ parentId: p, icon, ...item }) => ({ ...item, ...(p ? { parentId: p } : {}), ...(icon ? { icon } : {}) })),
        };
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
      description: 'Read a page, database row or dashboard by id (type auto-detected; a dashboard comes back as its block `spec`). mode: "outline" returns headings + first line per section — a cheap skim for a long page (the map shows body sizes) before a full read.',
      inputSchema: {
        pageId: z.string().describe('Page or row id'),
        mode: z.enum(['full', 'outline']).optional().default('full'),
        includeComments: z.boolean().optional().default(false).describe('Also return the comment thread'),
      },
      outputSchema: z.object({
        id: z.string(),
        type: z.string().describe('page | database | database_row | dashboard'),
        title: z.string().optional(),
        content: z.string().optional().describe('Markdown body (collapsed in outline mode); absent for a dashboard'),
        spec: z.any().optional().describe('Dashboard only: the block spec (outline mode: `blocks` with id/type/title instead)'),
        url: z.string().optional().describe('Dashboard only: where a human can see it'),
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
        if (page.type === 'dashboard') {
          // No comments panel on a dashboard, so includeComments has nothing to add.
          const payload = shapeDashboardRead(page, mode ?? 'full', ctx);
          const text = JSON.stringify(payload);
          await logActivity(ctx, 'get_page', 'success', 'dashboard', pageId, text);
          return { content: [{ type: 'text' as const, text }], structuredContent: payload };
        }
        const body = page.content ?? '';
        const collapsed = mode === 'outline' && body.length > 0;
        const payload: Record<string, unknown> = collapsed
          ? { ...page, content: buildContentOutline(body), mode: 'outline', fullContentChars: body.length }
          : { ...page };
        let comments: unknown[] | undefined;
        if (includeComments) {
          const listed = await listPageComments(pageId);
          comments = listed.map(({ authorUserId: _authorUserId, authorImage: _authorImage, ...c }) => c);
          payload.comments = comments;
        }
        const text = JSON.stringify(payload);
        // An outline's naive alternative is mode:"full" — the object already in
        // hand, so this is the real byte count rather than a guess.
        const baselineBytes = collapsed
          ? Buffer.byteLength(JSON.stringify(comments ? { ...page, comments } : page), 'utf8')
          : undefined;
        await logActivity(ctx, 'get_page', 'success', 'page', pageId, text, { baselineBytes });
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
      description: 'Read several pages/rows by id in one call, for a known, possibly mixed id list. A bad id fails only its own entry — check each "ok". For rows of one database use query_database with filters/fields instead: one query, not N lookups.',
      inputSchema: {
        pageIds: z.array(z.string()).min(1).max(50),
        mode: z.enum(['full', 'outline']).optional().default('full').describe('As in get_page'),
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
          r.ok && r.page?.type === 'dashboard'
            ? { ...r, page: shapeDashboardRead(r.page, mode ?? 'full', ctx) }
            : r.ok && r.page && mode === 'outline' && r.page.content
              ? { ...r, page: { ...r.page, content: buildContentOutline(r.page.content), mode: 'outline', fullContentChars: r.page.content.length } }
              : r,
        );
        const text = JSON.stringify({ results: shaped });
        // Same reasoning as get_page: in outline mode the full-body answer is
        // the array we already built. Equal sizes (nothing was long enough to
        // collapse) simply record a zero saving.
        const baselineBytes = mode === 'outline'
          ? Buffer.byteLength(JSON.stringify({ results }), 'utf8')
          : undefined;
        await logActivity(ctx, 'get_pages', 'success', undefined, undefined, text, { baselineBytes });
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
      description: 'Columns (id, name, type, options) and saved views of a database, without rows. Check it before writing rows or changing views.',
      inputSchema: {
        databaseId: z.string(),
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
      description: 'Agent activity log for this workspace, filterable by tool, status and date range.',
      inputSchema: {
        tool: z.string().optional().describe('Tool name'),
        status: z.enum(['success', 'error']).optional(),
        from: z.string().optional().describe('ISO 8601'),
        to: z.string().optional().describe('ISO 8601'),
        limit: z.number().optional().default(50),
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
      description: 'Workspace members with roles and join dates.',
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
      description: 'Rows (and the matching schema) of a database, paginated. Row bodies are NOT included unless "content" is in fields. Use filters to narrow and fields to project only the columns you need — much cheaper on wide tables.',
      inputSchema: {
        databaseId: z.string(),
        limit: z.number().optional().default(50),
        filters: z.record(z.string(), z.any()).optional().describe('By property value, e.g. {"status": "Done"} or {"col_xxx": ["Tag1"]}'),
        fields: z.array(z.string()).optional().describe('Column ids or names (case-insensitive); title is always included. Add "content" for row bodies.'),
        cursor: z.string().optional().describe('nextCursor from the previous page'),
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
        // baselineBytes is measurement, not payload — stripped before it reaches the agent.
        const { baselineBytes, ...result } = await queryDatabaseRows(ctx.workspaceId, databaseId, limit ?? 50, filters, cursor, fields);
        const text = JSON.stringify(result);
        await logActivity(ctx, 'query_database', 'success', 'database', databaseId, text, { baselineBytes });
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
      description: 'Everything created, updated or deleted since a cursor (from the workspace digest/map or a previous call) or an ISO time — pages, databases, rows and deletions, oldest first. Omit both to bootstrap. Always keep nextCursor for the next call: this is how to catch up instead of re-reading the tree. An entry stamped in the cursor\'s own second may appear once more — dedupe by id.',
      inputSchema: {
        since: z.string().optional().describe('ISO 8601; ignored when cursor is given'),
        cursor: z.string().optional().describe('From the digest/map header or a previous nextCursor'),
        limit: z.number().optional().default(100),
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
        nextCursor: z.string().describe('Always present — pass back as cursor to continue or resume a later sync'),
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

  // Two questions, one tool (P13): a page's neighbourhood by `pageId`, or "which
  // pages rest on this repo file?" by `resource`. A second tool would put its
  // whole schema into every session's tools/list (bench:mcp-budget).
  server.registerTool(
    'get_related_pages',
    {
      description: 'A page\'s neighborhood, titles and ids only: parent, children, outgoing links (@-links and child blocks), backlinks, row siblings, and the repo files it rests on. With resource (a file path) instead: the pages resting on that file — read them before changing it.',
      inputSchema: {
        pageId: z.string().optional().describe('Page, database or row id'),
        resource: z.string().max(1_000).optional().describe('Instead of pageId: a repo file or folder path'),
      },
      outputSchema: z.object({
        page: z.object({
          id: z.string(),
          title: z.string(),
          type: z.string().describe('page | database | database_row'),
        }).passthrough().optional().describe('The subject page (pageId mode)'),
        parent: relatedRefSchema.nullable().optional().describe('Sidebar parent (for a row, its database); null at root'),
        children: z.array(relatedRefSchema).optional().describe('Nested under this page'),
        outgoingLinks: z.array(relatedRefSchema).optional().describe('Pages this page\'s body references (children excluded)'),
        backlinks: z.array(relatedRefSchema).optional().describe('Pages referencing this page (parent excluded)'),
        siblings: z.object({
          total: z.number(),
          items: z.array(z.object({ id: z.string(), title: z.string() })).describe('Up to 10'),
        }).nullable().optional().describe('Same-database rows — database_row subjects only, null otherwise'),
        sources: z.array(z.string()).optional().describe('pageId mode: repo files (or URLs) its knowledge sources name; absent when none'),
        resource: z.string().optional().describe('resource mode: the path as matched'),
        pages: z.array(z.object({
          id: z.string(),
          title: z.string(),
          type: z.string().describe('page | database | database_row'),
          databaseId: z.string().optional().describe('Databases and rows — pass to query_database'),
          match: z.string().describe('exact | folder (rests on a folder containing it) | inside (rests on a file inside the asked folder)'),
          source: z.string().describe('The source as the page records it'),
        }).passthrough()).optional().describe('resource mode: pages resting on it, closest match first (up to 25)'),
        total: z.number().optional().describe('resource mode: matches before the limit'),
        note: z.string().optional().describe('resource mode: set when no page in the workspace records sources at all'),
      }),
      annotations: { title: 'Get related pages', readOnlyHint: true, openWorldHint: false },
    },
    async ({ pageId, resource }) => {
      if (resource?.trim()) {
        try {
          const result = await getPagesForResource(ctx.workspaceId, resource);
          const text = JSON.stringify(result);
          // The path is not a workspace id: nothing to point the audit row's target at.
          await logActivity(ctx, 'get_related_pages', 'success', 'resource', undefined, text);
          return { content: [{ type: 'text' as const, text }], structuredContent: result };
        } catch (err) {
          await logActivity(ctx, 'get_related_pages', 'error', 'resource');
          return { content: [{ type: 'text' as const, text: `Error: ${String(err)}` }], isError: true };
        }
      }
      if (!pageId) {
        return { content: [{ type: 'text' as const, text: 'Error: pass pageId, or resource (a repo file path).' }], isError: true };
      }
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
