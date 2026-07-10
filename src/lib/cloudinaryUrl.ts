/**
 * Pure, client-safe Cloudinary delivery-URL helpers.
 *
 * Distinct from `lib/cloudinary.ts`, which pulls in the server-only Cloudinary
 * SDK and must never be imported from a client component.
 */

const CLOUDINARY_HOST = /^res\.cloudinary\.com$/i;
const UPLOAD_MARKER = '/upload/';

/**
 * Force a Cloudinary asset to download instead of rendering inline, via the
 * `fl_attachment` delivery flag, optionally naming the saved file.
 *
 * Needed when handing a URL to the system browser (the Tauri desktop download
 * path): Cloudinary serves images and PDFs with an inline Content-Disposition,
 * so the browser would just display them in a tab rather than save them.
 *
 * Non-Cloudinary or non-https URLs are returned untouched — we can't dictate a
 * foreign host's Content-Disposition, so the browser decides.
 */
export function withAttachment(rawUrl: string, filename?: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (u.protocol !== 'https:' || !CLOUDINARY_HOST.test(u.hostname)) return rawUrl;

  const at = u.pathname.indexOf(UPLOAD_MARKER);
  if (at === -1) return rawUrl;

  const rest = u.pathname.slice(at + UPLOAD_MARKER.length);
  if (rest.startsWith('fl_attachment')) return rawUrl; // already forced

  // Cloudinary appends the asset's own extension, and treats `.` and `,` as
  // delimiters inside the flag — so pass a bare, sanitized stem or nothing.
  const stem = (filename ?? '').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '_');
  const trimmed = stem.replace(/^_+|_+$/g, '').slice(0, 100);
  const flag = trimmed ? `fl_attachment:${trimmed}` : 'fl_attachment';

  u.pathname = u.pathname.slice(0, at + UPLOAD_MARKER.length) + flag + '/' + rest;
  return u.toString();
}
