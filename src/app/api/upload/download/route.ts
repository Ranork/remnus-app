import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// Only allow proxying Cloudinary URLs to prevent SSRF.
const CLOUDINARY_HOST = 'res.cloudinary.com';

export async function GET(req: NextRequest) {
  // `auth()`, not `getCurrentUser()`: the latter calls `redirect('/login')` when
  // there is no session, which is wrong for an API route — it must answer 401.
  // Middleware protects this path, so that branch was never reached in practice.
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'download';

  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

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
