'use server';
import { db } from '@/db';
import { databases, workspaceItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createWorkspaceDatabase, getActiveWorkspaceId } from './workspace';

export async function createDatabase(name: string) {
  const workspaceId = await getActiveWorkspaceId();
  const { dbId } = await createWorkspaceDatabase(workspaceId, name);
  revalidatePath('/');
  return dbId;
}

export async function getDatabases() {
  return db.select().from(databases);
}

export async function getDatabase(id: string) {
  const result = await db
    .select({
      id: databases.id,
      name: databases.name,
      itemId: databases.itemId,
      schema: databases.schema,
      views: databases.views,
      createdAt: databases.createdAt,
      updatedAt: databases.updatedAt,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
    })
    .from(databases)
    .leftJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, id));
  return result[0];
}

export async function updateDatabaseSchema(id: string, newSchema: any[]) {
  await db.update(databases).set({ schema: newSchema, updatedAt: new Date() }).where(eq(databases.id, id));
  revalidatePath(`/db/${id}`);
}

export async function updateDatabaseViews(id: string, views: any[]) {
  await db.update(databases).set({ views, updatedAt: new Date() }).where(eq(databases.id, id));
}
