import { redirect } from 'next/navigation';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { switchWorkspace } from '@/lib/actions/workspace';
import { resolveAppEntry } from '@/lib/server/appEntry';

// A stable link into a specific workspace, independent of whichever workspace this
// browser's `remnus_workspace_id` cookie currently points at. Exists for `npx remnus
// open` (and the CLI's own printed link) and the desktop app's `remnus://open` deep
// link: a project's `.remnus/config.json` knows its exact workspaceId, so it can hand
// the human a URL that always lands on the right workspace.
//
// A route handler (V2 R9). As a page it could not set the cookie at all — cookies are
// read-only while a page renders, and the error was swallowed — so the link landed on
// whatever workspace was already active; and it rendered the whole app shell just to
// redirect to `/app`, which redirected again. Now: switch, then go straight to the
// workspace's page.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionAllowingWorkspaceLock();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  // Not a member (or a stale/foreign id, or a project window locked elsewhere): land on
  // whatever workspace `/app` already defaults to rather than failing — this route's
  // only job is best-effort routing, not access control (`switchWorkspace` checks
  // membership and the window lock before it sets anything).
  const switched = await switchWorkspace(id).then(() => true, () => false);

  redirect(await resolveAppEntry(session.user.id, switched ? { workspaceId: id } : {}));
}
