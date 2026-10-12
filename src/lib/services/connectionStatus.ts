/**
 * What `get_status` tells an agent about its own connection — cookie-free.
 *
 * Two things make a Remnus connection quietly lose abilities, and the agent otherwise
 * cannot tell them apart from a bug:
 *
 *  - An OAuth access token lives one hour. The client is meant to refresh it; if that
 *    fails, most clients just drop the server's tools without an error.
 *  - A write token whose holder is now a viewer is read-only. A read-scoped session is
 *    never offered the write tools at all (see `runMcpRequest`), so they simply are not there.
 *
 * Neither is visible from `/api/health`, which is public and knows nothing about the caller.
 * This is the authenticated counterpart: the state of THIS credential, as the server
 * sees it on this request.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { DEFAULT_CONTEXT_POLICY } from '@/lib/services/knowledge';
import type { TokenContext } from '@/app/api/mcp/context';

export const MCP_SERVER_NAME = 'remnus-mcp';
export const MCP_SERVER_VERSION = '1.2.0';

/** "Remnus: <workspace name>" — one line, at most 80 characters of name; undefined without a name. */
export function formatServerTitle(workspaceName: string | null | undefined): string | undefined {
  const name = workspaceName?.trim().replace(/\s+/g, ' ').slice(0, 80);
  return name ? `Remnus: ${name}` : undefined;
}

export interface ConnectionStatus {
  ok: true;
  server: { name: string; version: string };
  workspace: { id: string; name: string | null };
  connection: {
    kind: 'oauth' | 'personal_access_token';
    agentName: string | null;
    /** What this session may do right now. */
    scope: 'read' | 'write';
    /** Whether the write tools are part of this session. */
    writeTools: boolean;
    /** Set only when the scope is narrower than the one the token was granted. */
    scopeNote?: string;
  };
  /** ISO time the credential stops working, or null when it never does. */
  expiresAt: string | null;
  /** Seconds until then (never negative), or null when it never expires. */
  expiresInSeconds: number | null;
  /** What to do about the expiry. */
  renewal: string;
  contextPolicy: string;
  serverTime: string;
}

export async function getConnectionStatus(ctx: TokenContext, now: Date = new Date()): Promise<ConnectionStatus> {
  // Came with the token in a real request; scripts and tests build the context by hand.
  let workspaceName: string | null = ctx.workspaceName ?? null;
  if (ctx.workspaceName === undefined) {
    try {
      const [row] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, ctx.workspaceId)).limit(1);
      workspaceName = row?.name ?? null;
    } catch {
      // The status is still worth returning without the name.
    }
  }

  const expiresAtMs = ctx.expiresAt ?? null;
  const narrowed = ctx.storedScope !== undefined && ctx.storedScope !== ctx.scope;

  const renewal = ctx.tokenKind === 'oauth'
    ? 'OAuth access tokens last one hour and your client renews them with its refresh token (valid 30 days, renewed on every use). If this call stops working or the Remnus tools disappear, reconnect the server in your client to sign in again.'
    : expiresAtMs === null
      ? 'This personal access token has no expiry. It stops working only if a workspace owner revokes it.'
      : 'This personal access token stops working at expiresAt. A workspace owner has to create a new one (AI Agents panel).';

  return {
    ok: true,
    server: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    workspace: { id: ctx.workspaceId, name: workspaceName },
    connection: {
      kind: ctx.tokenKind === 'oauth' ? 'oauth' : 'personal_access_token',
      agentName: ctx.agentName,
      scope: ctx.scope,
      writeTools: ctx.scope === 'write',
      ...(narrowed
        ? { scopeNote: `This token was granted ${ctx.storedScope} access, but its owner's current role in the workspace limits it to ${ctx.scope}. Write tools are not offered until the role changes.` }
        : {}),
    },
    expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
    expiresInSeconds: expiresAtMs === null ? null : Math.max(0, Math.round((expiresAtMs - now.getTime()) / 1000)),
    renewal,
    contextPolicy: (ctx.contextPolicy ?? DEFAULT_CONTEXT_POLICY).mode,
    serverTime: now.toISOString(),
  };
}
