import { v2 as cloudinary } from 'cloudinary';

export { cloudinary };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// The only folder we ever write icons into — deletions are restricted to this prefix.
const ICONS_FOLDER = 'remnus/icons/';

function extractPublicId(url: string): string | null {
  // https://res.cloudinary.com/{cloud}/image/upload/v123456789/remnus/icons/abc.jpg
  // public_id = remnus/icons/abc  (no extension)
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
  return match?.[1] ?? null;
}

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  // Only treat URLs from our own cloud account as Cloudinary-managed
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !url) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloudName}/`);
}

export async function deleteCloudinaryImage(url: string): Promise<void> {
  const publicId = extractPublicId(url);
  // Hard-scope: refuse to delete anything outside remnus/icons/
  // This prevents accidental or injected deletions of unrelated assets.
  if (!publicId || !publicId.startsWith(ICONS_FOLDER)) {
    console.warn('[cloudinary] Refusing to delete out-of-scope asset:', publicId);
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    console.warn('[cloudinary] Failed to delete image:', publicId);
  }
}
