import { getPublicAppUrl } from './authRedirects';

export async function getClientActivateRedirectUrl(
  request: Request,
  token: string | null,
  activateToken: (token: string) => Promise<void>,
) {
  if (!token) return getPublicAppUrl('/login', request);

  try {
    await activateToken(token);
  } catch {
    return getPublicAppUrl('/login?error=token', request);
  }

  return getPublicAppUrl('/app', request);
}
