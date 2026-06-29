import { signIn } from '@/auth';
import { getClientActivateRedirectUrl } from '@/lib/clientActivateRedirect';
import { NextRequest } from 'next/server';

// Tauri WebView navigates here after receiving the deep-link callback.
// Signs in using the short-lived client-token and redirects to the app.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectUrl = await getClientActivateRedirectUrl(request, token, async (token) => {
    await signIn('client-token', { token, redirect: false });
  });

  return Response.redirect(redirectUrl, 302);
}
