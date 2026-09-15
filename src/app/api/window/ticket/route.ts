// `npx remnus open` trades the project's token for a single-use sign-in link here, so the
// project window opens already signed in — locked to that project's workspace (see
// src/lib/auth/workspaceLock.ts). Called from a terminal with no cookies: public in
// src/auth.config.ts and authenticated by the bearer token alone.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { verifyBearerToken } from '@/app/api/mcp/handler';
import { createWindowTicket, WINDOW_TICKET_TTL_SECONDS } from '@/lib/services/windowTicket';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

function refuse(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const ctx = await verifyBearerToken(request.headers.get('Authorization'));
  if (ctx === 'no_credential' || ctx === 'invalid_token') {
    return refuse(401, 'This project token was rejected. Run `npx remnus init` to reconnect.');
  }

  // Only a project's own token. OAuth access tokens belong to an MCP client, not to a
  // project on disk, and nothing holding one needs a browser window.
  if (ctx.tokenKind !== 'pat') {
    return refuse(403, 'Project windows are opened with a project token.');
  }

  // The window can edit the workspace, so it takes a token that could already do that over
  // MCP. An editing window from a read-only token would be exactly the escalation the lock
  // exists to prevent.
  if (ctx.scope !== 'write') {
    return refuse(403, 'Read-only project tokens cannot open a signed-in window.');
  }

  if (!ctx.ownerUserId) {
    return refuse(403, 'This project token no longer belongs to an account.');
  }

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspaceId), eq(workspaceMembers.userId, ctx.ownerUserId)))
    .limit(1);
  if (!member) {
    return refuse(403, 'The account behind this project token is no longer a member of its workspace.');
  }

  const ticket = await createWindowTicket({
    userId: ctx.ownerUserId,
    workspaceId: ctx.workspaceId,
    tokenId: ctx.tokenId,
  });

  // A path, not an absolute URL: the CLI joins it onto the server it is configured for, so
  // it never follows a sign-in link to an origin other than the one it trusts.
  return Response.json(
    {
      path: `/api/window/activate?ticket=${encodeURIComponent(ticket)}`,
      workspaceId: ctx.workspaceId,
      expiresInSeconds: WINDOW_TICKET_TTL_SECONDS,
    },
    { headers: NO_STORE },
  );
}
