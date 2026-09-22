import { getDashboardByItemId } from '@/lib/actions/dashboard';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import DashboardView from '@/components/features/dashboard/DashboardView';
import NotFoundRedirect from '@/components/features/NotFoundRedirect';

/**
 * `/dashboard/<workspace item id>`.
 *
 * Unlike `/page/*` and `/db/*` this route does NOT bow out under Tauri: its
 * content is server-rendered (every block's data is resolved server-side), so
 * there is no client pane equivalent for `TabPane` to mount. It behaves like
 * `/admin` — a real tab in the desktop strip, rendered through the normal
 * server route (`isTabbable` yes, `isKeepAlivePane` no).
 *
 * Project windows: `getDashboardByItemId` and `getWorkspaceMembers` both go
 * through `getCurrentUserAllowingWorkspaceLock()` + `assertWorkspaceLockAllows()`,
 * so a workspace-locked session can open its own dashboards.
 */
export default async function DashboardRoute(props: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await props.params;

  const data = await getDashboardByItemId(itemId);
  if (!data) return <NotFoundRedirect />;

  // Only needed by a `database_embed` block, whose table resolves `user` /
  // `multi_user` cells to names and avatars.
  const needsMembers = data.resolved.blocks.some((b) => b.kind === 'database_embed');
  const members = needsMembers ? await getWorkspaceMembers(data.item.workspaceId) : [];

  return (
    <div className="flex-1 overflow-auto bg-neutral-850">
      <DashboardView item={data.item} resolved={data.resolved} members={members} />
    </div>
  );
}
