export const runtime = 'nodejs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { agentTokens } from '@/db/schema';
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
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

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
  if (!await bcrypt.compare(secret, row.tokenHash)) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.id)).catch(() => {});

  return { tokenId: row.id, workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write', agentName: row.agentName ?? null };
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

export async function POST(req: Request) { return handleMcpRequest(req); }
export async function GET(req: Request)  { return handleMcpRequest(req); }
export async function DELETE(req: Request) { return handleMcpRequest(req); }

async function handleMcpRequest(req: Request): Promise<Response> {
  const ctx = await verifyBearerToken(req.headers.get('Authorization'));
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (!checkRateLimit(ctx.tokenId)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  // Standard SSE GET (Cursor, Windsurf, Continue, Antigravity)
  const url = new URL(req.url);
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
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
    });
  }

  // Build and register server capabilities
  const server = new McpServer({ name: 'remnus-mcp', version: '1.0.0' });
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);

  // SSE POST (sessionId-based stateful)
  const sessionId = url.searchParams.get('sessionId');
  if (sessionId) {
    const conn = activeSseConnections.get(sessionId);
    if (!conn) {
      return new Response(JSON.stringify({ error: 'Session expired' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const transport = new SseCustomTransport(conn.controller, conn.encoder);
    await server.connect(transport);

    let message: unknown;
    try { message = await req.clone().json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (transport.onmessage) transport.onmessage(message);
    return new Response(null, { status: 202 });
  }

  // Streamable HTTP (Claude Code — stateless)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
