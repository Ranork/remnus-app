import { getTranslations } from 'next-intl/server';
import { getGraphWorkspace } from '@/lib/actions/graph';
import GraphRouteClient from '@/components/features/graph/GraphRouteClient';
import NotFoundRedirect from '@/components/features/NotFoundRedirect';

export async function generateMetadata() {
  const t = await getTranslations('Graph');
  return { title: t('title') };
}

/**
 * `/graph/<workspace id>` — the workspace knowledge map (P12).
 *
 * Like `/dashboard/*` it does not bow out under Tauri: there is no keep-alive
 * pane for it, so it is a tabbable, not-kept-alive route (`TabsContext`).
 *
 * Project windows: `getGraphWorkspace` and the data action behind the screen
 * go through `getCurrentUserAllowingWorkspaceLock()` + `assertWorkspaceLockAllows()`,
 * so a window opens its own workspace's map and gets "not found" for any other.
 */
export default async function GraphRoute(props: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await props.params;
  const workspace = await getGraphWorkspace(workspaceId);
  if (!workspace) return <NotFoundRedirect />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-850">
      <GraphRouteClient workspace={workspace} />
    </div>
  );
}
