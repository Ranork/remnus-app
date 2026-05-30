export const runtime = 'nodejs';

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { agentTokens, agentActivity, workspaceItems, pages, databases } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  searchWorkspace,
  listWorkspaceItems,
  getAnyPageById,
  getDatabaseSchema,
  queryDatabaseRows,
  createPageInWorkspace,
  updatePageById,
  bulkUpdatePages,
  deleteItemFromWorkspace,
  moveItemInWorkspace,
  createDatabaseInWorkspace,
  updateDatabaseSchemaById,
} from '@/lib/services/workspace';
import { publish } from '@/lib/realtime/publish';

const activeSseConnections = new Map<string, {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}>();

class SseCustomTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any) => void;

  constructor(
    private controller: ReadableStreamDefaultController,
    private encoder: TextEncoder
  ) {}

  async start() {}
  async close() {
    this.onclose?.();
  }

  async send(message: any) {
    try {
      const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (err) {
      this.onerror?.(err as Error);
    }
  }
}

const TOKEN_PREFIX = process.env.MCP_TOKEN_PREFIX ?? 'rmns';

// ── Token verification ────────────────────────────────────────────────────────

type TokenContext = {
  tokenId: string;
  workspaceId: string;
  scope: 'read' | 'write';
  agentName: string | null;
};

async function verifyBearerToken(authHeader: string | null): Promise<TokenContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Format: <prefix>_<prefix8>_<secret>
  const parts = token.split('_');
  if (parts.length < 3) return null;
  const [, prefix8, ...secretParts] = parts;
  const secret = secretParts.join('_');
  if (parts[0] !== TOKEN_PREFIX || !prefix8 || !secret) return null;

  const [row] = await db
    .select()
    .from(agentTokens)
    .where(and(eq(agentTokens.tokenPrefix, prefix8), isNull(agentTokens.revokedAt)))
    .limit(1);

  if (!row) return null;

  const valid = await bcrypt.compare(secret, row.tokenHash);
  if (!valid) return null;

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Update lastUsedAt (best effort)
  db.update(agentTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentTokens.id, row.id))
    .catch(() => {});

  return { tokenId: row.id, workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write', agentName: row.agentName ?? null };
}

// ── Audit logging (best-effort) ───────────────────────────────────────────────

async function logActivity(
  ctx: TokenContext,
  tool: string,
  status: 'success' | 'error',
  targetType?: string,
  targetId?: string,
) {
  db.insert(agentActivity)
    .values({
      tokenId: ctx.tokenId,
      workspaceId: ctx.workspaceId,
      tool,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      status,
      createdAt: new Date(),
    })
    .catch(() => {});
}

// ── Rate limiting (simple in-memory token bucket) ────────────────────────────
// 60 requests per minute per token. Expired entries are swept every 100 calls
// to prevent unbounded Map growth on long-running servers.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let rateLimitCallCount = 0;

function checkRateLimit(tokenId: string): boolean {
  const now = Date.now();

  if (++rateLimitCallCount >= 100) {
    rateLimitCallCount = 0;
    for (const [key, entry] of rateLimitMap) {
      if (entry.resetAt < now) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(tokenId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(tokenId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  return handleMcpRequest(req);
}
export async function GET(req: Request) {
  return handleMcpRequest(req);
}
export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const ctx = await verifyBearerToken(req.headers.get('Authorization'));
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!checkRateLimit(ctx.tokenId)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Handle standard SSE GET request ──────────────────────────────────────────
  const url = new URL(req.url);
  const acceptHeader = req.headers.get('accept');
  if (req.method === 'GET' && acceptHeader?.includes('text/event-stream')) {
    const sessionId = crypto.randomUUID();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        activeSseConnections.set(sessionId, { controller, encoder });
        // Send the endpoint event containing the URL to POST to
        // (Cursor, Windsurf, Continue and Antigravity expect this event!)
        const relativeEndpoint = `/api/mcp?sessionId=${sessionId}`;
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${relativeEndpoint}\n\n`));
      },
      cancel() {
        activeSseConnections.delete(sessionId);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });
  }

  const server = new McpServer({
    name: 'remnus-mcp',
    version: '1.0.0',
  });

  // ── Register Resources ───────────────────────────────────────────────────────

  // 1. Workspace Schema Resource (remnus://workspace/{id}/schema)
  const workspaceSchemaTemplate = new ResourceTemplate("remnus://workspace/{id}/schema", {
    list: async () => ({
      resources: [{
        uri: `remnus://workspace/${ctx.workspaceId}/schema`,
        name: "Workspace Schema",
        mimeType: "application/json",
        description: "Get the JSON schema of a workspace containing databases and metadata"
      }]
    })
  });

  server.registerResource(
    "Workspace Schema",
    workspaceSchemaTemplate,
    {
      mimeType: "application/json",
      description: "Get the JSON schema of a workspace containing databases and metadata"
    },
    async (uri, variables) => {
      const workspaceId = variables.id as string;
      if (workspaceId !== ctx.workspaceId) {
        throw new Error("Access denied or workspace not found");
      }
      const items = await listWorkspaceItems(ctx.workspaceId);
      const dbs = items.filter(i => i.type === 'database');
      const schemas = await Promise.all(
        dbs.map(async dbItem => {
          try {
            const schema = await getDatabaseSchema(ctx.workspaceId, dbItem.id);
            return { id: dbItem.id, title: dbItem.title, ...schema };
          } catch {
            return null;
          }
        })
      );
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            workspaceId,
            databases: schemas.filter((s): s is Exclude<typeof s, null> => s !== null)
          }, null, 2)
        }]
      };
    }
  );

  // 2. Page Resource (remnus://page/{id})
  const pageTemplate = new ResourceTemplate("remnus://page/{id}", {
    list: async () => {
      // Fetch son güncellenen 20 sayfa (standalone)
      const standalone = await db
        .select({
          id: workspaceItems.id,
          title: workspaceItems.title,
          updatedAt: workspaceItems.updatedAt
        })
        .from(workspaceItems)
        .where(and(eq(workspaceItems.workspaceId, ctx.workspaceId), eq(workspaceItems.type, 'page')))
        .orderBy(desc(workspaceItems.updatedAt))
        .limit(20);

      // Fetch son güncellenen 20 database row (page)
      const dbRows = await db
        .select({
          id: pages.id,
          title: pages.title,
          updatedAt: pages.updatedAt
        })
        .from(pages)
        .innerJoin(databases, eq(pages.databaseId, databases.id))
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(eq(workspaceItems.workspaceId, ctx.workspaceId))
        .orderBy(desc(pages.updatedAt))
        .limit(20);

      // Birleştir, updatedAt azalan sırala, ilk 20'yi al
      const all = [...standalone, ...dbRows]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 20);

      return {
        resources: all.map(p => ({
          uri: `remnus://page/${p.id}`,
          name: p.title || "Untitled Page",
          mimeType: "text/markdown",
          description: "Son güncellenen sayfalar. (Diğer tüm sayfalara doğrudan ID'leri ile remnus://page/{id} üzerinden erişilebilir.)"
        }))
      };
    }
  });

  server.registerResource(
    "Page Content",
    pageTemplate,
    {
      mimeType: "text/markdown",
      description: "Get markdown content and properties of a page or database row"
    },
    async (uri, variables) => {
      const pageId = variables.id as string;
      const page = await getAnyPageById(ctx.workspaceId, pageId);
      
      let text = `# ${page.title || 'Untitled'}\n\n`;
      if (page.properties && Object.keys(page.properties).length > 0) {
        text += `## Properties\n`;
        for (const [k, v] of Object.entries(page.properties)) {
          if (k === 'title') continue;
          let valStr = '';
          if (Array.isArray(v)) {
            valStr = v.join(', ');
          } else if (typeof v === 'object' && v !== null) {
            valStr = JSON.stringify(v);
          } else {
            valStr = String(v);
          }
          text += `- **${k}**: ${valStr}\n`;
        }
        text += `\n`;
      }
      text += page.content || '';

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/markdown",
          text
        }]
      };
    }
  );

  // 3. Database Schema Resource (remnus://database/{id}/schema)
  const databaseSchemaTemplate = new ResourceTemplate("remnus://database/{id}/schema", {
    list: async () => {
      const items = await listWorkspaceItems(ctx.workspaceId);
      const dbs = items.filter(i => i.type === 'database');
      return {
        resources: dbs.map(dbItem => ({
          uri: `remnus://database/${dbItem.id}/schema`,
          name: `${dbItem.title} Schema`,
          mimeType: "application/json",
          description: `JSON schema for database "${dbItem.title}"`
        }))
      };
    }
  });

  server.registerResource(
    "Database Schema",
    databaseSchemaTemplate,
    {
      mimeType: "application/json",
      description: "Get JSON schema columns of a database"
    },
    async (uri, variables) => {
      const databaseId = variables.id as string;
      const schema = await getDatabaseSchema(ctx.workspaceId, databaseId);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(schema, null, 2)
        }]
      };
    }
  );

  // 4. Son Denetim Günlüğü Statik Kaynağı (remnus://audit-log/recent)
  server.registerResource(
    "Recent Audit Log",
    "remnus://audit-log/recent",
    {
      mimeType: "application/json",
      description: "Get recent audit activity for the current MCP token"
    },
    async (uri) => {
      const logs = await db
        .select()
        .from(agentActivity)
        .where(eq(agentActivity.tokenId, ctx.tokenId))
        .orderBy(desc(agentActivity.createdAt))
        .limit(50);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(logs, null, 2)
        }]
      };
    }
  );

  // ── Read tools ──────────────────────────────────────────────────────────────

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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        await logActivity(ctx, 'search', 'error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
        };
      } catch (err) {
        await logActivity(ctx, 'list_workspace', 'error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(page, null, 2) }],
        };
      } catch (err) {
        await logActivity(ctx, 'get_page', 'error', 'page', pageId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        await logActivity(ctx, 'get_database_schema', 'error', 'database', databaseId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        await logActivity(ctx, 'query_database', 'error', 'database', databaseId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Write tools ─────────────────────────────────────────────────────────────

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
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        const result = await createPageInWorkspace(ctx.workspaceId, {
          title,
          content,
          parentId,
          databaseId,
          properties,
        });
        await logActivity(ctx, 'create_page', 'success', result.type, result.id);
        publish({
          scope: databaseId ? 'database' : 'sidebar',
          workspaceId: ctx.workspaceId,
          resourceId: databaseId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ id: result.id, type: result.type }) }],
        };
      } catch (err) {
        await logActivity(ctx, 'create_page', 'error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        await updatePageById(ctx.workspaceId, pageId, { title, content, properties });
        await logActivity(ctx, 'update_page', 'success', 'page', pageId);
        publish({
          scope: 'page',
          workspaceId: ctx.workspaceId,
          resourceId: pageId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ updated: true, id: pageId }) }],
        };
      } catch (err) {
        await logActivity(ctx, 'update_page', 'error', 'page', pageId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'bulk_update',
    {
      description: 'Update multiple pages or database rows in a single call.',
      inputSchema: {
        updates: z.array(
          z.object({
            pageId: z.string().describe('The workspace item ID or database row ID to update'),
            title: z.string().optional().describe('New title'),
            content: z.string().optional().describe('New markdown content'),
            properties: z.record(z.string(), z.any()).optional().describe('Properties to merge'),
          }),
        ).describe('List of updates to apply'),
      },
    },
    async ({ updates }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'bulk_update', 'error');
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        const results = await bulkUpdatePages(ctx.workspaceId, updates);
        await logActivity(ctx, 'bulk_update', 'success');
        publish({
          scope: 'database',
          workspaceId: ctx.workspaceId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results) }],
        };
      } catch (err) {
        await logActivity(ctx, 'bulk_update', 'error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        if (!confirm) {
          const item = await getAnyPageById(ctx.workspaceId, pageId);
          return {
            content: [{ type: 'text' as const, text: `This will permanently delete "${item.title}" (type: ${item.type}). Set confirm: true to proceed.` }],
          };
        }
        const result = await deleteItemFromWorkspace(ctx.workspaceId, pageId);
        await logActivity(ctx, 'delete_page', 'success', result.type, pageId);
        publish({
          scope: result.type === 'db-row' ? 'database' : 'sidebar',
          workspaceId: ctx.workspaceId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: pageId }) }],
        };
      } catch (err) {
        await logActivity(ctx, 'delete_page', 'error', 'page', pageId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        const result = await moveItemInWorkspace(ctx.workspaceId, itemId, newParentId ?? null);
        await logActivity(ctx, 'move_item', 'success', 'item', itemId);
        publish({
          scope: 'sidebar',
          workspaceId: ctx.workspaceId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        await logActivity(ctx, 'move_item', 'error', 'item', itemId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
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
        schema: z.array(
          z.object({
            name: z.string().describe('Column name'),
            type: z.string().describe('Column type: text | number | select | multi_select | date | datetime'),
            options: z.array(z.any()).optional().describe('Select options for select/multi_select columns'),
          }),
        ).optional().describe('Column definitions. Omit to use default schema (Title + Status).'),
      },
    },
    async ({ name, parentId, schema }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'create_database', 'error');
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        const result = await createDatabaseInWorkspace(ctx.workspaceId, { name, schema, parentId });
        await logActivity(ctx, 'create_database', 'success', 'database', result.databaseId);
        publish({
          scope: 'sidebar',
          workspaceId: ctx.workspaceId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ id: result.id, databaseId: result.databaseId }) }],
        };
      } catch (err) {
        await logActivity(ctx, 'create_database', 'error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'update_database_schema',
    {
      description: 'Add or remove columns from a database schema. Removing columns is destructive (data loss) and requires confirm: true. The title column cannot be removed.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        addColumns: z.array(
          z.object({
            name: z.string().describe('Column name'),
            type: z.string().describe('Column type: text | number | select | multi_select | date | datetime'),
            options: z.array(z.any()).optional().describe('Select options for select/multi_select columns'),
          }),
        ).optional().describe('Columns to add'),
        removeColumnIds: z.array(z.string()).optional().describe('Column IDs to remove (use get_database_schema to find IDs). Cannot remove the title column.'),
        confirm: z.boolean().optional().default(false).describe('Required when removing columns. Set to true to confirm the destructive operation.'),
      },
    },
    async ({ databaseId, addColumns, removeColumnIds, confirm }) => {
      if (ctx.scope !== 'write') {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return {
          content: [{ type: 'text' as const, text: 'Error: This token only has read scope. A write-scoped token is required.' }],
          isError: true,
        };
      }
      try {
        const result = await updateDatabaseSchemaById(
          ctx.workspaceId,
          databaseId,
          { addColumns, removeColumnIds },
          confirm ?? false,
        );
        await logActivity(ctx, 'update_database_schema', 'success', 'database', databaseId);
        publish({
          scope: 'database',
          workspaceId: ctx.workspaceId,
          resourceId: databaseId,
          actorId: ctx.agentName ? `mcp:${ctx.agentName}:${ctx.tokenId}` : `mcp:${ctx.tokenId}`,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        await logActivity(ctx, 'update_database_schema', 'error', 'database', databaseId);
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Connect transport and handle request ────────────────────────────────────

  const sessionId = url.searchParams.get('sessionId');
  if (sessionId) {
    const conn = activeSseConnections.get(sessionId);
    if (!conn) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const transport = new SseCustomTransport(conn.controller, conn.encoder);
    await server.connect(transport);

    let message;
    try {
      message = await req.clone().json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (transport.onmessage) {
      transport.onmessage(message);
    }

    return new Response(null, { status: 202 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,      // Claude Code expects JSON, not SSE stream
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
