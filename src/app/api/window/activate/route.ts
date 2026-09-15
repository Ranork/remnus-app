// A project window lands here with the single-use ticket `npx remnus open` obtained, and
// leaves signed in — locked to the project's workspace — on that workspace. Public in
// src/auth.config.ts: the window arrives with no session yet.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { signIn } from '@/auth';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { getPublicAppUrl } from '@/lib/authRedirects';
import { isWorkspaceIdShape } from '@/lib/mcp/workspaceEndpoint';
import { consumeWindowTicket, peekWindowTicket } from '@/lib/services/windowTicket';

export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get('ticket');
  // Expired, already spent, or never valid: the ordinary login page is the honest fallback —
  // the human can still get in, just not without signing in.
  const toLogin = () => Response.redirect(getPublicAppUrl('/login', request), 302);

  if (!ticket) return toLogin();
  const pending = await peekWindowTicket(ticket);
  if (!pending || !isWorkspaceIdShape(pending.workspaceId)) return toLogin();

  const destination = getPublicAppUrl(`/w/${pending.workspaceId}`, request);

  // Already fully signed in as the same person (the link reached an everyday browser
  // profile): spend the ticket and go. Replacing that session with a locked one would
  // quietly take their full Remnus away in that browser.
  const existing = await getSessionAllowingWorkspaceLock();
  if (existing?.user?.id === pending.userId && !lockClaimsOf(existing.user).workspaceLock) {
    await consumeWindowTicket(ticket);
    return Response.redirect(destination, 302);
  }

  try {
    await signIn('workspace-window', { ticket, redirect: false });
  } catch {
    return toLogin();
  }

  return Response.redirect(destination, 302);
}
