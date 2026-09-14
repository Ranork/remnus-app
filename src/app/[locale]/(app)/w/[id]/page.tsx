import { redirect } from 'next/navigation';
import { switchWorkspace } from '@/lib/actions/workspace';

// A stable link into a specific workspace, independent of whichever workspace this
// browser's `remnus_workspace_id` cookie currently points at. Exists for `npx remnus
// open` (and the CLI's own printed link): a project's `.remnus/config.json` knows its
// exact workspaceId, so it can hand the human a URL that always lands on the right
// workspace instead of whatever `/app` happens to be showing from a different project.
export default async function WorkspaceEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Not a member (or a stale/foreign id): land on whatever workspace `/app` already
  // defaults to rather than throwing — this route's only job is best-effort routing,
  // not access control (the normal per-workspace checks still apply once there).
  await switchWorkspace(id).catch(() => {});

  redirect('/app');
}
