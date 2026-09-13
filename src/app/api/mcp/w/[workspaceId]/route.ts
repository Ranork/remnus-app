export const runtime = 'nodejs';
export const maxDuration = 60;

import { handleMcpGet, handleMcpRequest, type McpEndpoint } from '../../handler';
import { isWorkspaceIdShape } from '@/lib/mcp/workspaceEndpoint';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Workspace-pinned MCP endpoint.
 *
 * The id is echoed into the 401 challenge's realm and resource-metadata URL, so it
 * must be shape-checked before it reaches a response header — a decoded path segment
 * carrying CR/LF would otherwise be header injection. Anything that isn't id-shaped
 * is a 404: the same answer an unknown workspace gets, so this endpoint never
 * confirms whether a given id exists to an unauthenticated caller.
 */
async function resolveEndpoint(ctx: RouteContext): Promise<McpEndpoint | null> {
  const { workspaceId } = await ctx.params;
  if (!isWorkspaceIdShape(workspaceId)) return null;
  return { mcpPath: `/api/mcp/w/${workspaceId}`, expectedWorkspaceId: workspaceId };
}

const notFound = () =>
  new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

export async function POST(req: Request, ctx: RouteContext) {
  const endpoint = await resolveEndpoint(ctx);
  return endpoint ? handleMcpRequest(req, endpoint) : notFound();
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const endpoint = await resolveEndpoint(ctx);
  return endpoint ? handleMcpRequest(req, endpoint) : notFound();
}

export async function GET(req: Request, ctx: RouteContext) {
  const endpoint = await resolveEndpoint(ctx);
  return endpoint ? handleMcpGet(req, endpoint) : notFound();
}
