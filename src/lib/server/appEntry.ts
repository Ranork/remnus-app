import 'server-only';
import { cookies } from 'next/headers';
import { getActiveWorkspaceId, getAllWorkspaceItems, type WorkspaceItemRow } from '@/lib/actions/workspace';
import { LAST_PATH_COOKIE, readOwnedLastPath } from '@/lib/server/lastPath';

/**
 * Where `/app` (and `/w/<id>`) send a signed-in user. Decided in a route handler, not a
 * page (V2 R9): a page under `(app)` renders the whole app shell — workspaces, the
 * sidebar tree, agent presence, ~300 KB of HTML — only for the browser to throw it away
 * and follow the redirect. Every app open passes here (`/` and `/login` send a signed-in
 * visitor to `/app`; the desktop app and the PWA start there), so that render was paid
 * on every launch.
 */

// Validate a remembered path still points at an item the user can open, so a
// deleted/inaccessible page falls through to the default instead of 404ing.
function resolveLastPath(lastPath: string | undefined, items: WorkspaceItemRow[]): string | null {
  if (!lastPath) return null;

  const pageMatch = lastPath.match(/^\/page\/([^/?#]+)/);
  if (pageMatch) {
    return items.some((i) => i.id === pageMatch[1] && i.type === 'page') ? lastPath : null;
  }

  const dashboardMatch = lastPath.match(/^\/dashboard\/([^/?#]+)/);
  if (dashboardMatch) {
    return items.some((i) => i.id === dashboardMatch[1] && i.type === 'dashboard') ? lastPath : null;
  }

  const dbMatch = lastPath.match(/^\/db\/([^/?#]+)/);
  if (dbMatch) {
    return items.some((i) => i.databaseId === dbMatch[1]) ? lastPath : null;
  }

  // The knowledge map: resumable while the workspace is still one of the user's
  // (an empty workspace has no items to vouch for it and falls through to the default).
  const graphMatch = lastPath.match(/^\/graph\/([^/?#]+)/);
  if (graphMatch) {
    return items.some((i) => i.workspaceId === graphMatch[1]) ? lastPath : null;
  }

  return null;
}

/** The top of a workspace's hierarchy (first root item), not merely its oldest item. */
function firstItemPath(items: WorkspaceItemRow[], workspaceId: string): string | null {
  const inWorkspace = items.filter((i) => i.workspaceId === workspaceId);
  const first = inWorkspace.find((i) => i.parentId === null) ?? inWorkspace[0];
  if (!first) return null;
  if (first.type === 'database' && first.databaseId) return `/db/${first.databaseId}`;
  if (first.type === 'dashboard') return `/dashboard/${first.id}`;
  return `/page/${first.id}`;
}

/** The workspace an item path belongs to, judged by the items the user can open. */
function workspaceOfPath(path: string, items: WorkspaceItemRow[]): string | null {
  const id = path.match(/^\/(?:page|dashboard|db|graph)\/([^/?#]+)/)?.[1];
  if (!id) return null;
  if (path.startsWith('/graph/')) return id;
  return items.find((i) => i.id === id || i.databaseId === id)?.workspaceId ?? null;
}

/**
 * The path to send the signed-in `userId` to. `suffix` (e.g. `?billing=success`) is
 * kept on the destination. With `workspaceId` (an explicit `/w/<id>` link that has
 * already switched the workspace cookie) the remembered last page counts only when it
 * is in that workspace — the link asked for that workspace, not for wherever the user
 * was last.
 */
export async function resolveAppEntry(userId: string, opts: { suffix?: string; workspaceId?: string } = {}): Promise<string> {
  const suffix = opts.suffix ?? '';
  const cookieStore = await cookies();

  // A pending invite (set while logged out) takes priority — finish accepting it.
  const pendingInvite = cookieStore.get('pending_invite')?.value;
  if (pendingInvite) return `/invite/${pendingInvite}`;
  // Same priority for a pending Prospect Invite (gift-signup) claim.
  const pendingProspectInvite = cookieStore.get('pending_prospect_invite')?.value;
  if (pendingProspectInvite) return `/welcome/${pendingProspectInvite}`;

  // Side by side: the active workspace is only needed when there is no page to resume,
  // but asking for it afterwards would put its read behind the items'.
  const [items, activeWorkspaceId] = await Promise.all([
    getAllWorkspaceItems(),
    opts.workspaceId ? Promise.resolve(null) : getActiveWorkspaceId(),
  ]);

  // 1) Resume where the user left off — the last visited page, if it was remembered by
  //    THIS user and still exists. The ownership check matters on its own: an admin can
  //    open every workspace (and co-members can open each other's pages), so a cookie
  //    left behind by the previously signed-in user would otherwise validate and resume
  //    under the new account.
  const ownPath = readOwnedLastPath(cookieStore.get(LAST_PATH_COOKIE)?.value, userId);
  const restored = resolveLastPath(ownPath ?? undefined, items);
  if (restored && (!opts.workspaceId || workspaceOfPath(restored, items) === opts.workspaceId)) {
    return `${restored}${suffix}`;
  }

  // 2) Otherwise the top of the requested (or active) workspace.
  const workspaceId = opts.workspaceId ?? activeWorkspaceId;
  const first = workspaceId ? firstItemPath(items, workspaceId) : null;
  if (first) return `${first}${suffix}`;

  // 3) Nothing to open: the empty state, which says why.
  return `/app/empty${workspaceId ? '' : '?none=1'}`;
}
