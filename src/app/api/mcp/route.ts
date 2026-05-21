export const runtime = 'nodejs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { agentTokens, agentActivity } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  searchWorkspace,
  listWorkspaceItems,
  getPageById,
  getDatabasePageById,
  queryDatabaseRows,
  createPageInWorkspace,
  updatePageById,
} from '@/lib/services/workspace';

const TOKEN_PREFIX = process.env.MCP_TOKEN_PREFIX ?? 'rmns';

// ── Token verification ────────────────────────────────────────────────────────

type TokenContext = {
  tokenId: string;
  workspaceId: string;
  scope: 'read' | 'write';
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

  // Update lastUsedAt (best effort)
  db.update(agentTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentTokens.id, row.id))
    .catch(() => {});

  return { tokenId: row.id, workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write' };
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
// 60 requests per minute per token prefix

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(tokenId: string): boolean {
  const now = Date.now();
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

  const server = new McpServer({
    name: 'remnus-mcp',
    version: '1.0.0',
  });

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
      description: 'Get full content of a workspace page or database item by its ID.',
      inputSchema: {
        pageId: z.string().describe('The workspace item ID or database row page ID'),
        isDbRow: z.boolean().optional().default(false).describe('Set true if this ID is a database row (pages table)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId, isDbRow }) => {
      try {
        const page = isDbRow
          ? await getDatabasePageById(ctx.workspaceId, pageId)
          : await getPageById(ctx.workspaceId, pageId);
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
    'query_database',
    {
      description: 'Get schema and rows of a database.',
      inputSchema: {
        databaseId: z.string().describe('Database ID (from list_workspace or search)'),
        limit: z.number().optional().default(50).describe('Maximum rows (default 50)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ databaseId, limit }) => {
      try {
        const result = await queryDatabaseRows(ctx.workspaceId, databaseId, limit ?? 50);
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

  // ── Connect transport and handle request ────────────────────────────────────

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
