import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pages, workspaceItems, workspaces } from '@/db/schema';
import { deleteCloudinaryImage, isCloudinaryUrl } from '@/lib/cloudinary';

/**
 * Deletes an uploaded icon that was just replaced — unless something still shows it.
 * A duplicated page, row or branch keeps the original's icon URL, so the file is shared;
 * deleting it on the first change would blank the other copy. Call AFTER the write that
 * stopped using it. Best-effort: a failure leaves an orphan file, never a broken icon.
 */
export async function releaseIcon(url: string | null | undefined): Promise<void> {
  if (!url || !isCloudinaryUrl(url)) return;
  try {
    const [item, row, workspace] = await Promise.all([
      db.select({ id: workspaceItems.id }).from(workspaceItems).where(eq(workspaceItems.icon, url)).limit(1),
      db.select({ id: pages.id }).from(pages).where(eq(pages.icon, url)).limit(1),
      db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.icon, url)).limit(1),
    ]);
    if (item.length > 0 || row.length > 0 || workspace.length > 0) return;
    await deleteCloudinaryImage(url);
  } catch (err) {
    console.warn('[icons] could not release a replaced icon:', err);
  }
}
