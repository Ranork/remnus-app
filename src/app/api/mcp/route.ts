export const runtime = 'nodejs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { agentTokens, oauthAccessTokens } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { registerResources } from './resources';
import { registerPrompts } from './prompts';
import { registerReadTools } from './tools/read';
import { registerWriteTools } from './tools/write';
import type { TokenContext } from './context';

// ── SSE connection store (stateful SSE transport for Cursor / Windsurf / Continue) ──

const activeSseConnections = new Map<string, {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}>();

class SseCustomTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: unknown) => void;

  constructor(
    private controller: ReadableStreamDefaultController,
    private encoder: TextEncoder,
  ) {}

  async start() {}
  async close() { this.onclose?.(); }

  async send(message: unknown) {
    try {
      this.controller.enqueue(this.encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`));
    } catch (err) {
      this.onerror?.(err as Error);
    }
  }
}

// ── Token verification ────────────────────────────────────────────────────────

const TOKEN_PREFIX = process.env.MCP_TOKEN_PREFIX ?? 'rmns';

async function verifyBearerToken(authHeader: string | null): Promise<TokenContext | null> {
  console.log('[mcp/auth] enter', {
    hasHeader: !!authHeader,
    headerPreview: authHeader ? authHeader.slice(0, 20) + '...' : null,
  });

  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[mcp/auth] no_bearer_match', { headerPreview: authHeader?.slice(0, 30) ?? null });
    return null;
  }
  const token = match[1];

  const parts = token.split('_');
  if (parts.length < 3) {
    console.error('[mcp/auth] bad_token_shape', { partsLen: parts.length, tokenPreview: token.slice(0, 12) });
    return null;
  }
  const [scheme, prefix8, ...secretParts] = parts;
  const secret = secretParts.join('_');
  if (!prefix8 || !secret) {
    console.error('[mcp/auth] empty_prefix_or_secret', { scheme, hasPrefix: !!prefix8, hasSecret: !!secret });
    return null;
  }

  console.log('[mcp/auth] parsed', { scheme, prefix8 });

  // OAuth access token (oa_ prefix)
  if (scheme === 'oa') {
    const [row] = await db
      .select()
      .from(oauthAccessTokens)
      .where(and(eq(oauthAccessTokens.tokenPrefix, prefix8), isNull(oauthAccessTokens.revokedAt)))
      .limit(1);

    if (!row) {
      console.error('[mcp/auth] oauth_token_not_found', { prefix: prefix8 });
      return null;
    }
    if (!await bcrypt.compare(secret, row.tokenHash)) {
      console.error('[mcp/auth] oauth_token_hash_mismatch', { prefix: prefix8 });
      return null;
    }
    if (row.expiresAt.getTime() < Date.now()) {
      console.error('[mcp/auth] oauth_token_expired', { prefix: prefix8, expiresAt: row.expiresAt });
      return null;
    }

    console.log('[mcp/auth] oauth_token_ok', { prefix: prefix8, scope: row.scope });
    return { tokenId: row.id, tokenKind: 'oauth', workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write', agentName: row.agentName ?? null, ownerUserId: row.userId ?? null };
  }

  // Personal access token (rmns_ prefix)
  if (scheme !== TOKEN_PREFIX) {
    console.error('[mcp/auth] unknown_scheme', { scheme, expectedPat: TOKEN_PREFIX });
    return null;
  }

  const [row] = await db
    .select()
    .from(agentTokens)
    .where(and(eq(agentTokens.tokenPrefix, prefix8), isNull(agentTokens.revokedAt)))
    .limit(1);

  if (!row) return null;
  if (!await bcrypt.compare(secret, row.tokenHash)) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.id)).catch(() => {});

  return { tokenId: row.id, tokenKind: 'pat', workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write', agentName: row.agentName ?? null, ownerUserId: row.createdBy ?? null };
}

// ── Rate limiting (60 req/min per token, in-memory token bucket) ──────────────

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

// ── Route handlers ────────────────────────────────────────────────────────────

const MCP_HEADERS = { 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION };

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...MCP_HEADERS } });
}

function withMcpHeader(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(req: Request) { return handleMcpRequest(req); }
export async function GET(req: Request)  { return handleMcpRequest(req); }
export async function DELETE(req: Request) { return handleMcpRequest(req); }

async function handleMcpRequest(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url);
  const base = `${reqUrl.protocol}//${reqUrl.host}`;

  const ctx = await verifyBearerToken(req.headers.get('Authorization'));
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="${base}/api/mcp", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        ...MCP_HEADERS,
      },
    });
  }

  if (!checkRateLimit(ctx.tokenId)) return json({ error: 'Too many requests' }, 429);

  // Standard SSE GET (Cursor, Windsurf, Continue, Antigravity)
  if (req.method === 'GET' && req.headers.get('accept')?.includes('text/event-stream')) {
    const sessionId = crypto.randomUUID();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        activeSseConnections.set(sessionId, { controller, encoder });
        controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`));
      },
      cancel() { activeSseConnections.delete(sessionId); },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', ...MCP_HEADERS },
    });
  }

  // Build and register server capabilities
  const server = new McpServer({ name: 'remnus-mcp', version: '1.0.0' });
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);

  // SSE POST (sessionId-based stateful)
  const sessionId = reqUrl.searchParams.get('sessionId');
  if (sessionId) {
    const conn = activeSseConnections.get(sessionId);
    if (!conn) return json({ error: 'Session expired' }, 404);

    const transport = new SseCustomTransport(conn.controller, conn.encoder);
    await server.connect(transport);

    let message: unknown;
    try { message = await req.clone().json(); } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    if (transport.onmessage) transport.onmessage(message);
    return new Response(null, { status: 202, headers: MCP_HEADERS });
  }

  // Streamable HTTP (Claude Code — stateless)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return withMcpHeader(await transport.handleRequest(req));
}
