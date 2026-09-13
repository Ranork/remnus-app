// ── Workspace-pinned MCP endpoint helpers ────────────────────────────────────
//
// One workspace = one MCP URL (`/api/mcp/w/<workspaceId>`). MCP clients key their
// stored OAuth state on a hash of the server URL, so a per-workspace URL is what
// keeps two projects on the same machine from sharing (and cross-wiring) one token.
//
// Kept dependency-free: imported from the Node MCP routes, the edge `.well-known`
// metadata route, and the OAuth consent screen alike.

/**
 * Workspace ids are `crypto.randomUUID()` values, but this check is deliberately about
 * *shape*, not existence: the id is interpolated into a `WWW-Authenticate` header and
 * into metadata documents, so anything outside this charset (CR/LF above all) must be
 * rejected before it can reach a response header.
 */
const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isWorkspaceIdShape(value: string | null | undefined): value is string {
  return typeof value === 'string' && WORKSPACE_ID_RE.test(value);
}

/** The original workspace-agnostic endpoint. Still serves every already-connected client. */
export const SHARED_MCP_PATH = '/api/mcp';

export const WORKSPACE_MCP_PATH_PREFIX = '/api/mcp/w/';

export function workspaceMcpPath(workspaceId: string): string {
  return `${WORKSPACE_MCP_PATH_PREFIX}${workspaceId}`;
}

export function workspaceMcpUrl(baseUrl: string, workspaceId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${workspaceMcpPath(workspaceId)}`;
}

/** `/api/mcp/w/<id>` → `<id>`; anything else (including the shared `/api/mcp`) → null. */
export function parseWorkspaceMcpPath(path: string): string | null {
  if (!path.startsWith(WORKSPACE_MCP_PATH_PREFIX)) return null;
  const id = path.slice(WORKSPACE_MCP_PATH_PREFIX.length);
  return isWorkspaceIdShape(id) ? id : null;
}

/**
 * Every path this app protects and therefore publishes RFC 9728 metadata for: the
 * shared endpoint and any workspace-pinned one. Anything else must 404 rather than
 * mint a metadata document for a resource that does not exist.
 */
export function isProtectedMcpPath(path: string): boolean {
  return path === SHARED_MCP_PATH || parseWorkspaceMcpPath(path) !== null;
}

/**
 * Read the workspace out of an RFC 8707 `resource` indicator, which MCP clients send
 * on the authorize request set to the exact MCP URL they were configured with. That
 * makes it the consent screen's hint for *which* workspace this grant is for — the
 * user configured a project, not a picker.
 *
 * Returns null for anything unparseable so callers fall back to the normal picker.
 */
export function workspaceIdFromResource(resource: string | null | undefined): string | null {
  if (!resource) return null;
  try {
    return parseWorkspaceMcpPath(new URL(resource).pathname);
  } catch {
    return null;
  }
}
