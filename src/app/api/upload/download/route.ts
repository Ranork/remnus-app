import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifySignedDownload } from '@/lib/server/downloadLink';

// Only allow proxying Cloudinary URLs to prevent SSRF.
const CLOUDINARY_HOST = 'res.cloudinary.com';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'download';

  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  // Two ways to authorize:
  //  - a short-lived HMAC signature, so the desktop app can open the download in
  //    the system browser (which has no session cookie);
  //  - otherwise a live session (the web download button, same-origin + cookie).
  // `auth()`, not `getCurrentUser()`: the latter `redirect()`s to /login (a 307
  // to an HTML page), which is wrong for a fetch-consuming API route — it wants
  // a 401.
  const signed = verifySignedDownload(url, name, searchParams.get('exp'), searchParams.get('sig'));
  if (!signed) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (parsed.hostname !== CLOUDINARY_HOST || !/^https:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: 'Forbidden url' }, { status: 403 });
  }

  // redirect: 'manual' — only the validated Cloudinary host is fetched; a 3xx to
  // any other host is treated as a failure (ok === false) rather than followed.
  const upstream = await fetch(url, { redirect: 'manual' });
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  // Sanitize name for Content-Disposition — strip quotes and backslashes.
  const safeName = name.replace(/["\\]/g, '_');

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
