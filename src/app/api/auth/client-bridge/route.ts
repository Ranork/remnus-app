import { auth } from '@/auth';
import { SignJWT } from 'jose';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { setPendingClientToken } from '@/lib/client-auth-store';

// Called after browser-side login (via callbackUrl).
// Creates a short-lived JWT keyed by device_id so the desktop client can poll for it.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');
  if (!deviceId) redirect('/login');

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const token = await new SignJWT({ sub: session.user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('client-auth')
    .setExpirationTime('5m')
    .sign(secret);

  await setPendingClientToken(deviceId, token);

  const SUPPORTED_LOCALES = ['en', 'tr', 'hi', 'es', 'fr', 'de', 'zh', 'ru'] as const;
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(rawLocale ?? '') ? rawLocale! : 'en';
  const t = await getTranslations({ locale, namespace: 'Auth' });

  // The same "desk and sheet" as the sign-in screens (V2 R8.6), hand-written because this
  // is a bare HTML response. The light palette follows the stored theme (catppuccin is
  // the app's light theme) or, with none stored, the system preference.
  const theme = cookieStore.get('remnus_theme')?.value;
  const light = `--desk:#eceef1;--sheet:#ffffff;--raised:#f7f8fa;--line:#e4e6ea;--fg:#15171b;--fg3:#5f6570;--ok:#1a7f4b;--edge:rgb(16 24 40 / .05);--shade:rgb(16 24 40 / .16);`;
  const themeCss = theme === 'catppuccin'
    ? `:root{${light}}`
    : theme ? '' : `@media (prefers-color-scheme: light){:root{${light}}}`;

  return new Response(
    `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Remnus</title>
  <style>
    :root { --desk:#111316; --sheet:#191b1f; --raised:#1f2226; --line:#2a2d33; --fg:#eceef1; --fg3:#979ca5; --ok:#7fc36d; --edge:rgb(255 255 255 / .05); --shade:rgb(0 0 0 / .62); }
    ${themeCss}
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: var(--desk); color: var(--fg3); min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .brand { position: fixed; top: 1rem; left: 1rem; display: flex; align-items: center; gap: .5rem; color: var(--fg); font-size: .875rem; font-weight: 600; }
    .brand svg { width: 20px; height: 20px; }
    .card { width: 100%; max-width: 24rem; background: var(--sheet); border-radius: 12px; padding: 1.75rem; box-shadow: 0 0 0 1px var(--edge), 0 20px 48px -30px var(--shade); }
    .check { width: 40px; height: 40px; border-radius: 50%; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; color: var(--ok); }
    .check svg { width: 20px; height: 20px; }
    h1 { font-size: 1.125rem; font-weight: 600; color: var(--fg); margin: 0 0 .375rem; letter-spacing: -.01em; }
    p { font-size: .875rem; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="brand">
    <svg viewBox="40 70 432 370" aria-hidden="true"><polygon fill="currentColor" points="90,88 355,88 422,168 330,268 455,420 318,420 210,300 104,420 55,420 272,175 178,175 90,268"/></svg>
    Remnus
  </div>
  <div class="card">
    <div class="check">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1>${t('clientBridgeTitle')}</h1>
    <p>${t('clientBridgeHint')}</p>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
