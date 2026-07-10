import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived signed links for the `/api/upload/download` proxy.
 *
 * The proxy is the only place that knows an asset's real filename — Cloudinary
 * cannot supply it for `raw` resources (an .html/.zip/.csv upload): its
 * `fl_attachment:<name>` flag appends the *delivery format*, which raw assets
 * don't have, so the browser saves the file with no extension at all. (And a
 * dot inside the flag makes Cloudinary reject the URL with a 400.)
 *
 * The desktop app hands downloads to the system browser (so the browser's own
 * download UI + "show in folder" work — the in-app `reveal_download` command is
 * blocked by the ACL because the webview loads a remote origin). That browser
 * doesn't share the Tauri WebView's cookie jar, so it can't authenticate against
 * the proxy. A signed, expiring link lets exactly that one request through
 * without a session, while the proxy keeps its Cloudinary-host restriction.
 */

const TTL_MS = 5 * 60 * 1000; // enough to open a browser, short enough to not be a share link

function secret(): string {
  return process.env.AUTH_SECRET ?? '';
}

function sign(url: string, name: string, exp: number): string {
  return createHmac('sha256', secret())
    // Length-prefixed so ("a","bc") and ("ab","c") can't collide onto one MAC.
    .update(`download\n${url.length}\n${url}\n${name.length}\n${name}\n${exp}`)
    .digest('hex');
}

/** Build the relative, signed proxy path for an asset. */
export function buildSignedDownloadPath(url: string, name: string): string {
  const exp = Date.now() + TTL_MS;
  const sig = sign(url, name, exp);
  const qs = new URLSearchParams({ url, name, exp: String(exp), sig });
  return `/api/upload/download?${qs.toString()}`;
}

/** Constant-time signature + expiry check. Returns false on anything suspect. */
export function verifySignedDownload(
  url: string,
  name: string,
  exp: string | null,
  sig: string | null,
): boolean {
  if (!exp || !sig || !secret()) return false;

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;

  const expected = sign(url, name, expMs);
  // timingSafeEqual throws on length mismatch — compare lengths first.
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}
