function safeOrigin(value: string | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin === 'null') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  const { hostname } = new URL(origin);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function getDesktopLoginOrigin(
  currentOrigin: string,
  configuredOrigin = process.env.NEXT_PUBLIC_APP_URL,
) {
  const normalizedCurrentOrigin = safeOrigin(currentOrigin) ?? 'https://remnus.com';

  if (isLocalOrigin(normalizedCurrentOrigin)) {
    return normalizedCurrentOrigin;
  }

  const normalizedConfiguredOrigin = safeOrigin(configuredOrigin);
  if (normalizedConfiguredOrigin) return normalizedConfiguredOrigin;

  return normalizedCurrentOrigin;
}

export function getDesktopLoginUrl(
  deviceId: string,
  currentOrigin: string,
  configuredOrigin = process.env.NEXT_PUBLIC_APP_URL,
) {
  const origin = getDesktopLoginOrigin(currentOrigin, configuredOrigin);
  return `${origin}/client-login?device_id=${encodeURIComponent(deviceId)}`;
}
