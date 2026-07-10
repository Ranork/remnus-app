import 'server-only';
import { createHmac } from 'node:crypto';

import { LAST_PATH_COOKIE } from '@/lib/constants/cookies';

export { LAST_PATH_COOKIE };

/**
 * The `remnus_last_path` cookie survives a sign-out, so the next user to sign in
 * on the same browser inherits it. Validating that they *can* open the path is
 * not enough: an admin can open every workspace, and two members of a shared
 * workspace can both open each other's pages — so the previous user's location
 * would validate cleanly and resume under the new account.
 *
 * The cookie therefore carries an owner tag and is only honored for the user who
 * wrote it. The tag is an HMAC of the user id keyed with AUTH_SECRET rather than
 * the raw id, so a cookie left behind in a shared browser doesn't disclose the
 * previous account's user id (and can't be forged to target another user).
 */
export function lastPathOwnerTag(userId: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET ?? '')
    .update(`last-path:${userId}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Read the remembered path out of the cookie, returning null unless it was
 * written by this same user. Cookies from an older format (no tag) are ignored.
 */
export function readOwnedLastPath(
  cookieValue: string | undefined,
  userId: string,
): string | null {
  if (!cookieValue) return null;

  const sep = cookieValue.indexOf(':');
  if (sep === -1) return null; // legacy / untagged value — not attributable

  const tag = cookieValue.slice(0, sep);
  if (tag !== lastPathOwnerTag(userId)) return null;

  try {
    return decodeURIComponent(cookieValue.slice(sep + 1)) || null;
  } catch {
    return null;
  }
}
