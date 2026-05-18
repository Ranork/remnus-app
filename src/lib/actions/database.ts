'use server';
import { db } from '@/db';
import { databases } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createWorkspaceDatabase } from './workspace';

export async function createDatabase(name: string) {
  const { dbId } = await createWorkspaceDatabase(name);
  revalidatePath('/');
  return dbId;
}

export async function getDatabases() {
  return db.select().from(databases);
}

export async function getDatabase(id: string) {
  const result = await db.select().from(databases).where(eq(databases.id, id));
  return result[0];
}

export async function updateDatabaseSchema(id: string, newSchema: any[]) {
  await db.update(databases).set({ schema: newSchema, updatedAt: new Date() }).where(eq(databases.id, id));
  revalidatePath(`/db/${id}`);
}
