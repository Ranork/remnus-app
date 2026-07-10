'use server';

import { getCurrentUser } from '@/lib/auth/session';
import { buildSignedDownloadPath } from '@/lib/server/downloadLink';

const CLOUDINARY_HOST = 'res.cloudinary.com';

/**
 * Mint a short-lived signed path for the asset download proxy.
 *
 * Used by the desktop app, which opens downloads in the system browser so the
 * browser's own download UI + "show in folder" work (the in-app path can't —
 * `reveal_download` is blocked by the ACL because the webview loads a remote
 * origin). That browser has no session cookie, so it can't hit the auth-gated
 * proxy directly, and Cloudinary can't be used instead because it cannot name a
 * `raw` asset (see lib/server/downloadLink.ts). Requires a session to mint —
 * this grants no access the caller didn't already have, since the proxy has
 * always accepted any Cloudinary URL from any signed-in user.
 *
 * Returns a relative path; the caller resolves it against its own origin.
 */
export async function createSignedDownloadUrl(url: string, name: string): Promise<string | null> {
  await getCurrentUser(); // redirects when unauthenticated

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) return null;

  return buildSignedDownloadPath(url, name || 'download');
}
