import { redirect } from 'next/navigation';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { resolveAppEntry } from '@/lib/server/appEntry';

// `/app` — the gateway every app open passes through (`/` and `/login` send a signed-in
// visitor here; so do sign-in callbacks, the desktop app and checkout). A route handler,
// not a page, so the redirect costs no app-shell render (see `lib/server/appEntry.ts`).
// Project windows land here too: `getActiveWorkspaceId` pins them to their workspace.
export async function GET(request: Request) {
  const session = await getSessionAllowingWorkspaceLock();
  if (!session?.user) redirect('/login');

  // Preserve the post-checkout flag through the redirect so the success modal can show.
  const billing = new URL(request.url).searchParams.get('billing');
  redirect(await resolveAppEntry(session.user.id, { suffix: billing === 'success' ? '?billing=success' : '' }));
}
