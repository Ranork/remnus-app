import { redirect } from 'next/navigation';
import { getActiveWorkspaceId } from '@/lib/actions/workspace';

// `/graph` alone opens the active workspace's map (a project window's is its own).
export default async function GraphIndexRoute() {
  const workspaceId = await getActiveWorkspaceId();
  redirect(workspaceId ? `/graph/${workspaceId}` : '/app');
}
