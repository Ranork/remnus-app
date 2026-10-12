import { getTranslations } from 'next-intl/server';

/**
 * What a web action needs from the caller's role in a workspace.
 *
 *  - `read` — any member (the viewer included).
 *  - `edit` — changing content: pages, rows, databases, dashboards, comments, shares, the
 *    trash and version history. Owners and members; a viewer is view-only, which is what
 *    the role promises in the UI and what agent tokens were already clamped to
 *    (`maxScopeForRole`). Until 2026-10-12 the web actions checked membership only, so a
 *    viewer could change everything from the browser.
 *  - `own` — managing the workspace itself (rename, re-icon, delete). Owner only; until
 *    2026-10-12 any member could do it by calling the action directly.
 *
 * Platform admins return before any role check in every helper, as before.
 */
export type WorkspaceNeed = 'read' | 'edit' | 'own';

/** An unknown or legacy role counts as a member, the same as `resolveJoinAccess` does. */
export function roleAllows(role: string | null | undefined, need: WorkspaceNeed): boolean {
  if (need === 'read') return true;
  if (need === 'own') return role === 'owner';
  return role !== 'viewer';
}

/** The error a refused action throws, in the request's language. */
export async function roleRefusal(need: WorkspaceNeed): Promise<Error> {
  const t = await getTranslations('Errors');
  return new Error(need === 'own' ? t('ownerOnlyAction') : t('viewOnly'));
}
