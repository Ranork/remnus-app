// RFC 8058 one-click unsubscribe endpoint — the List-Unsubscribe header in
// every marketing email points here. Mail clients POST with no body/cookies;
// auth is the HMAC token in the query string. GET redirects humans to the
// confirm page. Whitelisted in auth.config.ts.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { performUnsubscribe } from '@/lib/email/send';

export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  const t = req.nextUrl.searchParams.get('t');
  if (!u) return NextResponse.json({ ok: false }, { status: 400 });
  const res = await performUnsubscribe(u, t);
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? '';
  const t = req.nextUrl.searchParams.get('t') ?? '';
  return NextResponse.redirect(
    new URL(`/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`, req.nextUrl),
  );
}
