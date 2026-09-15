// Shared implementation behind every MCP endpoint. Two routes mount it:
//
//   • /api/mcp              — the original workspace-agnostic endpoint. The token
//                             alone decides which workspace the session talks to.
//   • /api/mcp/w/<id>       — workspace-pinned. Same handler, but the URL names the
//                             workspace and a token for a different one is refused.
//
// The pinned form exists because MCP clients namespace their stored OAuth state by a
// hash of the server URL (see mcpb/server/index.js). With a single shared URL, two
// projects connected to two different workspaces collide on one token file and the
// second project silently opens the first project's workspace. Giving each workspace
// its own URL makes that state per-workspace for free, and is what `remnus init`
// writes into a project's MCP config.
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

// RFC 6750 §3: `error="invalid_token"` belongs on the challenge only when a credential
// WAS presented and rejected (expired, unknown, malformed) — it tells a spec-compliant
// client to retry with a refresh rather than fall back to a full re-auth. A request with
// no Authorization header at all is `no_credential` and gets a bare challenge instead.
type AuthFailure = 'no_credential' | 'invalid_token';

export async function verifyBearerToken(authHeader: string | null): Promise<TokenContext | AuthFailure> {
  console.log('[mcp/auth] enter', {
    hasHeader: !!authHeader,
    headerPreview: authHeader ? authHeader.slice(0, 20) + '...' : null,
  });

  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[mcp/auth] no_bearer_match', { headerPreview: authHeader?.slice(0, 30) ?? null });
    return 'no_credential';
  }
  const token = match[1];

  const parts = token.split('_');
  if (parts.length < 3) {
    console.error('[mcp/auth] bad_token_shape', { partsLen: parts.length, tokenPreview: token.slice(0, 12) });
    return 'invalid_token';
  }
  const [scheme, prefix8, ...secretParts] = parts;
  const secret = secretParts.join('_');
  if (!prefix8 || !secret) {
    console.error('[mcp/auth] empty_prefix_or_secret', { scheme, hasPrefix: !!prefix8, hasSecret: !!secret });
    return 'invalid_token';
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
      return 'invalid_token';
    }
    if (!await bcrypt.compare(secret, row.tokenHash)) {
      console.error('[mcp/auth] oauth_token_hash_mismatch', { prefix: prefix8 });
      return 'invalid_token';
    }
    if (row.expiresAt.getTime() < Date.now()) {
      console.error('[mcp/auth] oauth_token_expired', { prefix: prefix8, expiresAt: row.expiresAt });
      return 'invalid_token';
    }

    console.log('[mcp/auth] oauth_token_ok', { prefix: prefix8, scope: row.scope });
    return { tokenId: row.id, tokenKind: 'oauth', workspaceId: row.workspaceId, scope: row.scope as 'read' | 'write', agentName: row.agentName ?? null, ownerUserId: row.userId ?? null };
  }

  // Personal access token (rmns_ prefix)
  if (scheme !== TOKEN_PREFIX) {
    console.error('[mcp/auth] unknown_scheme', { scheme, expectedPat: TOKEN_PREFIX });
    return 'invalid_token';
  }

  const [row] = await db
    .select()
    .from(agentTokens)
    .where(and(eq(agentTokens.tokenPrefix, prefix8), isNull(agentTokens.revokedAt)))
    .limit(1);

  if (!row) return 'invalid_token';
  if (!await bcrypt.compare(secret, row.tokenHash)) return 'invalid_token';
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return 'invalid_token';

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

/**
 * Which endpoint the request came in on.
 *
 * `mcpPath` is echoed in the 401 challenge (realm + RFC 9728 resource metadata URL),
 * so a client that discovers auth from a workspace-pinned URL is pointed back at that
 * same URL's metadata document rather than the shared one.
 *
 * `expectedWorkspaceId`, when set, must match the token's workspace.
 */
export interface McpEndpoint {
  mcpPath: string;
  expectedWorkspaceId?: string;
}

const SHARED_ENDPOINT: McpEndpoint = { mcpPath: '/api/mcp' };

// GET is how Streamable HTTP clients open a standalone SSE stream for server-initiated
// push (sampling / logging / elicitation). This server never sends any of those, so the
// stream would sit open with nothing to push. The SDK transport (below) keeps such a
// stream open indefinitely — on Vercel that means every GET idles until `maxDuration`
// force-kills it as a 60s timeout (504), the same cost/reliability failure mode the
// hand-rolled SSE branch was removed for. Worse, some MCP clients treat that timeout as
// a dead connection and restart the whole session including OAuth, which is what was
// producing repeated full re-authentications. Short-circuit with 405 instead — spec-legal
// (the GET/SSE stream is optional) and tells the client immediately that none is offered.
export async function handleMcpGet(req: Request, endpoint: McpEndpoint = SHARED_ENDPOINT): Promise<Response> {
  const authed = await authenticate(req, endpoint);
  if (authed instanceof Response) return authed;
  return json({ error: 'Method Not Allowed: this server does not offer an SSE stream' }, 405);
}

async function authenticate(req: Request, endpoint: McpEndpoint): Promise<TokenContext | Response> {
  const reqUrl = new URL(req.url);
  const base = `${reqUrl.protocol}//${reqUrl.host}`;

  const result = await verifyBearerToken(req.headers.get('Authorization'));
  if (result === 'no_credential' || result === 'invalid_token') {
    // RFC 9728 §3.1: the metadata document for a resource at `<base><path>` lives at
    // `<base>/.well-known/oauth-protected-resource<path>`, so the path is inserted
    // after the well-known segment, not appended to the resource URL.
    const resourceMetadata = `resource_metadata="${base}/.well-known/oauth-protected-resource${endpoint.mcpPath}"`;
    const realm = `${base}${endpoint.mcpPath}`;
    const challenge = result === 'invalid_token'
      ? `Bearer error="invalid_token", error_description="The access token is missing, expired, or invalid", realm="${realm}", ${resourceMetadata}`
      : `Bearer realm="${realm}", ${resourceMetadata}`;
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': challenge,
        ...MCP_HEADERS,
      },
    });
  }

  // A valid token for the wrong workspace is an authorization failure, not an
  // authentication one: 403, so the client stops instead of looping through the
  // OAuth flow again with a credential that will never satisfy this URL.
  if (endpoint.expectedWorkspaceId && result.workspaceId !== endpoint.expectedWorkspaceId) {
    console.error('[mcp/auth] workspace_mismatch', {
      tokenWorkspaceId: result.workspaceId,
      urlWorkspaceId: endpoint.expectedWorkspaceId,
    });
    return json(
      { error: 'This token belongs to a different workspace than the one in the URL.' },
      403,
    );
  }

  return result;
}

export async function handleMcpRequest(req: Request, endpoint: McpEndpoint = SHARED_ENDPOINT): Promise<Response> {
  const ctx = await authenticate(req, endpoint);
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
