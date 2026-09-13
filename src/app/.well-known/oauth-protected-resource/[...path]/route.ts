export const runtime = 'edge';

import { isProtectedMcpPath } from '@/lib/mcp/workspaceEndpoint';

// RFC 9728 §3.1: a protected resource at `<base><path>` publishes its metadata at
// `<base>/.well-known/oauth-protected-resource<path>`. The sibling route.ts serves the
// shared resource at the bare well-known path (where existing clients already look);
// this one serves the spec's path-scoped form for both `/api/mcp` and the
// workspace-pinned `/api/mcp/w/<id>` URLs, which is how a client that only knows a
// project's MCP URL discovers that Remnus is the authorization server for it.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const resourcePath = `/${(path ?? []).join('/')}`;

  // Only paths this app actually protects get a metadata document. An unknown path
  // must 404 rather than mint metadata for a resource that does not exist.
  if (!isProtectedMcpPath(resourcePath)) {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  return Response.json(
    {
      resource: `${base}${resourcePath}`,
      authorization_servers: [base],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    },
  );
}
