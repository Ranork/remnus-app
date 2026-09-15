import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { cloudinary } from '@/lib/cloudinary';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { recordAsset } from '@/lib/services/assets';
import { checkWithinStorage } from '@/lib/services/billing';

// Validate actual magic bytes — never trust file.type alone (client-controlled).
// SVG intentionally excluded: it can carry inline <script> tags.
function isSafeImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const b = buf;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
              && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  const isGif  = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
              && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return isJpeg || isPng || isGif || isWebp;
}

// kind=icon  → square 256×256 avatar/icon (default; back-compat with IconPicker)
// kind=image → full content image, no crop, capped width, larger size limit
// kind=file  → arbitrary attachment stored as a raw asset
const ICON_MAX = 5 * 1024 * 1024;
const IMAGE_MAX = 10 * 1024 * 1024;
const FILE_MAX = 25 * 1024 * 1024;

type CloudinaryResult = { secure_url: string; public_id: string; resource_type: string; bytes: number };

function upload(buffer: Buffer, options: Record<string, unknown>): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolve(result as CloudinaryResult);
      })
      .end(buffer);
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserAllowingWorkspaceLock();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const kind = (formData.get('kind') as string | null) ?? 'icon';

  // The workspaceId is client-supplied; only attribute storage to it if the
  // caller is actually a member, otherwise reject (prevents IDOR-style
  // mis-attribution of usage to a workspace the user doesn't belong to).
  const requestedWorkspaceId = (formData.get('workspaceId') as string | null) || null;
  // A project window may upload into its own workspace only, and has to name it so the
  // asset is attributed (and storage-limited) there rather than left unscoped.
  if (user.workspaceLock && requestedWorkspaceId !== user.workspaceLock) {
    return NextResponse.json({ error: 'Forbidden workspace' }, { status: 403 });
  }
  if (requestedWorkspaceId) {
    const member = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, requestedWorkspaceId), eq(workspaceMembers.userId, user.id)))
      .limit(1);
    if (!member.length) {
      return NextResponse.json({ error: 'Forbidden workspace' }, { status: 403 });
    }
  }
  const workspaceId = requestedWorkspaceId;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Pooled storage quota — counts against the workspace billing owner's plan.
  // Only enforced when the upload is attributed to a workspace; admins bypass.
  if (workspaceId && user.role !== 'admin') {
    const code = await checkWithinStorage(workspaceId, buffer.length);
    if (code) {
      return NextResponse.json({ error: code }, { status: 413 });
    }
  }

  if (kind === 'file') {
    if (buffer.length > FILE_MAX) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }
    const result = await upload(buffer, { folder: 'remnus/files', resource_type: 'auto' });
    await recordAsset({
      publicId: result.public_id,
      resourceType: result.resource_type,
      kind: 'file',
      bytes: result.bytes ?? buffer.length,
      url: result.secure_url,
      userId: user.id,
      workspaceId,
    });
    return NextResponse.json({ url: result.secure_url, name: file.name, size: result.bytes ?? buffer.length });
  }

  // Image-based kinds: validate magic bytes.
  const limit = kind === 'image' ? IMAGE_MAX : ICON_MAX;
  if (buffer.length > limit) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }
  if (!isSafeImageBuffer(buffer)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  const isContentImage = kind === 'image';
  const result = await upload(
    buffer,
    isContentImage
      ? {
          folder: 'remnus/images',
          transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
          resource_type: 'image',
        }
      : {
          folder: 'remnus/icons',
          transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'auto' }],
          resource_type: 'image',
        },
  );

  await recordAsset({
    publicId: result.public_id,
    resourceType: result.resource_type,
    kind: isContentImage ? 'image' : 'icon',
    bytes: result.bytes ?? buffer.length,
    url: result.secure_url,
    userId: user.id,
    workspaceId,
  });

  return NextResponse.json({ url: result.secure_url });
}
