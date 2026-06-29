export function getAllowedDevOrigins(raw = process.env.NEXT_ALLOWED_DEV_ORIGINS ?? ''): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
