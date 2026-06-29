function getConfiguredAppOrigin() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (url.origin === 'null') continue;
      return url.origin;
    } catch {
      continue;
    }
  }

  return null;
}

export function getPublicAppUrl(path: string, request: Request) {
  return new URL(path, getConfiguredAppOrigin() ?? new URL(request.url).origin);
}
