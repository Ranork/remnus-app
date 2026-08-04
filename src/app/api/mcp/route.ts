export const runtime = 'nodejs';
export const maxDuration = 60;

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
import { getContextPolicy } from '@/lib/services/knowledge';

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...MCP_HEADERS } });
}

function withMcpHeader(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION);
  // The MCP SDK's transport replies with a bare `application/json` (no charset),
  // which some clients (e.g. PowerShell) decode as ISO-8859-1 and mojibake non-ASCII text.
  if (headers.get('Content-Type') === 'application/json') {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Surfaced directly in the model's system prompt at session start (per the MCP spec) — this
// is the only channel that reaches the agent without it first calling a tool, so it's where
// the save-memory/recall-context prompts and the digest resource need to be advertised, or an
// agent has no way to discover they exist. Kept short (well under the ~1-2KB that's reasonable
// for a system-prompt addition); for the full workspace map, point at the digest resource
// instead of inlining it here — that scales with workspace size and shouldn't ride on every request.
async function buildInstructions(ctx: TokenContext): Promise<string> {
  const policy = await getContextPolicy(ctx.workspaceId);
  const digestUri = `remnus://workspace/${ctx.workspaceId}/digest`;
  const lines = [
    'This is a Remnus workspace: pages and databases an AI agent can read and, with a write-scoped token, edit directly.',
    policy.mode === 'manual'
      ? 'Context policy is manual. Use prepare_context(task, maxTokens?) when the task needs workspace knowledge; avoid pre-crawling the workspace.'
      : `Context policy is ${policy.mode}. For concrete multi-page product or coding work, call prepare_context first with about ${policy.autoMaxTokens} tokens; reuse its contextRunId for related Remnus writes.`,
    `For broad orientation or an unclear task, read resource ${digestUri} for a compact map (titles, ids, row counts, last-updated).`,
    'Two prompts exist specifically for cross-session memory: recall-context(topic) before starting work, save-memory(content, memory_type) after a decision, preference, or gotcha worth keeping.',
  ];
  if (ctx.scope === 'write') {
    lines.push(
      'Writing: update_page/bulk_update_pages merge properties (partial patches are safe) and also sync `title` into the row\'s title property. delete_page and destructive schema/view changes require confirm: true — omit it first to preview.',
    );
    if (policy.mode === 'strict') {
      lines.push('Strict context is enabled: Remnus mutation tools reject calls without a current contextRunId from this same agent and workspace. Authorization and destructive confirmation still apply separately.');
    }
  }
  return lines.join('\n');
}

export async function POST(req: Request) { return handleMcpRequest(req); }
export async function DELETE(req: Request) { return handleMcpRequest(req); }

// GET is how Streamable HTTP clients open a standalone SSE stream for server-initiated
// push (sampling / logging / elicitation). This server never sends any of those, so the
// stream would sit open with nothing to push. The SDK transport (below) keeps such a
// stream open indefinitely — on Vercel that means every GET idles until `maxDuration`
// force-kills it as a 60s timeout (504), the same cost/reliability failure mode the
// hand-rolled SSE branch was removed for. Worse, some MCP clients treat that timeout as
// a dead connection and restart the whole session including OAuth, which is what was
// producing repeated full re-authentications. Short-circuit with 405 instead — spec-legal
// (the GET/SSE stream is optional) and tells the client immediately that none is offered.
export async function GET(req: Request) {
  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;
  return json({ error: 'Method Not Allowed: this server does not offer an SSE stream' }, 405);
}

async function authenticate(req: Request): Promise<TokenContext | Response> {
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
  return ctx;
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;

  if (!checkRateLimit(ctx.tokenId)) return json({ error: 'Too many requests' }, 429);

  // Build and register server capabilities
  const server = new McpServer({ name: 'remnus-mcp', version: '1.1.0' }, { instructions: await buildInstructions(ctx) });
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);

  // Streamable HTTP (stateless) — the only transport we support. The previous
  // hand-rolled stateful SSE branch (for Cursor/Windsurf/Continue/Antigravity)
  // never closed its stream server-side, so it idled until Vercel force-killed
  // it at maxDuration, over and over, per reconnect — the dominant Fluid Compute
  // cost driver. Audit log showed zero real tool calls through that path, so it
  // was removed rather than bounded.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return withMcpHeader(await transport.handleRequest(req));
}
