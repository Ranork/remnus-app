import { getTranslations } from 'next-intl/server';

// ── Project windows: workspace-locked sessions ───────────────────────────────
//
// A project window's session is LOCKED to that project's workspace: it may do what the
// project's write token could already do over MCP — content inside that one workspace —
// and nothing at the account or workspace-management level.
//
// `npx remnus open` creates such a session (the `workspace-window` sign-in in src/auth.ts),
// so the human sees the project's workspace without logging in by hand.
//
// The lock is enforced deny-by-default, at the two places requests resolve their user:
//   • `auth()` from `@/auth` reads a locked session as signed out.
//   • `getCurrentUser()` throws for a locked session.
// Code that must work inside a project window opts in explicitly — through
// `getCurrentUserAllowingWorkspaceLock()` / `getSessionAllowingWorkspaceLock()` — and then
// confines itself with `assertWorkspaceLockAllows()` against the workspace it RESOLVED
// (never a client-supplied id it has not checked). A call site nobody opted in is
// therefore a feature that errors inside the window, never a way out of it.

/** How long a project-window session lives before a new one has to be opened. */
export const WINDOW_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** The lock claims a project-window session carries on `session.user`. */
export type WorkspaceLockClaims = {
  workspaceLock?: string | null;
  workspaceLockTokenId?: string | null;
  workspaceLockExpiresAt?: number | null;
};

/** Reads the lock claims off a session user; all fields are absent on a normal session. */
export function lockClaimsOf(user: object | null | undefined): WorkspaceLockClaims {
  return (user ?? {}) as WorkspaceLockClaims;
}

export type LockAwareSessionUser = {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** The only workspace this session may touch, or null for a normal session. */
  workspaceLock: string | null;
};

export async function projectWindowDeniedError(): Promise<Error> {
  const t = await getTranslations('Errors');
  return new Error(t('projectWindowDenied'));
}

/**
 * Throws unless the session is unlocked or locked to exactly `workspaceId`.
 * Run it BEFORE any admin shortcut: a locked admin session must not bypass the lock.
 */
export async function assertWorkspaceLockAllows(
  user: { workspaceLock?: string | null },
  workspaceId: string,
): Promise<void> {
  if (user.workspaceLock && user.workspaceLock !== workspaceId) {
    throw await projectWindowDeniedError();
  }
}
