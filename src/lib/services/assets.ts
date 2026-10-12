import { db } from '@/db';
import { uploadedAssets, workspaceMembers } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { cloudinary } from '@/lib/cloudinary';

// Cookie-free asset accounting + Cloudinary cleanup. Callers (API routes /
// server actions) authenticate first and pass an explicit userId.

type RecordAssetInput = {
  publicId: string;
  resourceType: string; // 'image' | 'raw' | 'video'
  kind: string; // 'icon' | 'image' | 'file'
  bytes: number;
  url: string;
  userId: string;
  workspaceId?: string | null;
};

export async function recordAsset(input: RecordAssetInput): Promise<void> {
  try {
    await db
      .insert(uploadedAssets)
      .values({
        publicId: input.publicId,
        resourceType: input.resourceType,
        kind: input.kind,
        bytes: input.bytes || 0,
        url: input.url,
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: uploadedAssets.publicId });
  } catch {
    /* best-effort: never block an upload on bookkeeping */
  }
}

// Delete an asset both from Cloudinary and our ledger. Allowed when the caller
// uploaded it, or can edit the workspace it belongs to (a viewer cannot). Returns true if a
// matching, authorized asset was found and removed.
export async function deleteAssetByUrl(url: string, userId: string): Promise<boolean> {
  if (!url) return false;
  const rows = await db.select().from(uploadedAssets).where(eq(uploadedAssets.url, url)).limit(1);
  const asset = rows[0];
  if (!asset) return false;

  let authorized = asset.userId === userId;
  if (!authorized && asset.workspaceId) {
    const member = await db
      .select({ id: workspaceMembers.id, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, asset.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    authorized = member.length > 0 && member[0].role !== 'viewer';
  }
  if (!authorized) return false;

  try {
    await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType });
  } catch {
    /* if Cloudinary delete fails we still drop the ledger row so usage frees up */
  }
  await db.delete(uploadedAssets).where(eq(uploadedAssets.id, asset.id));
  return true;
}

export async function getUserStorageBytes(userId: string): Promise<number> {
  const r = await db
    .select({ total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .where(eq(uploadedAssets.userId, userId));
  return Number(r[0]?.total ?? 0);
}

export async function getWorkspaceStorageBytes(workspaceId: string): Promise<number> {
  const r = await db
    .select({ total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .where(eq(uploadedAssets.workspaceId, workspaceId));
  return Number(r[0]?.total ?? 0);
}

// Per-user storage totals for a set of users (admin overview). Returns a map.
export async function getStorageBytesForUsers(userIds: string[]): Promise<Record<string, number>> {
  if (!userIds.length) return {};
  const rows = await db
    .select({ userId: uploadedAssets.userId, total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .where(inArray(uploadedAssets.userId, userIds))
    .groupBy(uploadedAssets.userId);
  const map: Record<string, number> = {};
  for (const row of rows) map[row.userId] = Number(row.total ?? 0);
  return map;
}
