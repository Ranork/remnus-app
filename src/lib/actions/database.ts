'use server';
import { db } from '@/db';
import { databases, workspaceItems, workspaceMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createWorkspaceDatabase, getActiveWorkspaceId } from './workspace';

// Verify user has access to the workspace that owns this database
async function assertDatabaseAccess(databaseId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  if (session.user.role === 'admin') return session.user.id;

  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, databaseId))
    .limit(1);

  if (!row) throw new Error('Database not found');

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, row.workspaceId),
        eq(workspaceMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member) throw new Error('Unauthorized: no access to this database');
  return session.user.id;
}

export async function createDatabase(name: string) {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) throw new Error('No active workspace');
  const { dbId } = await createWorkspaceDatabase(workspaceId, name);
  revalidatePath('/');
  return dbId;
}

export async function getDatabases() {
  return db.select().from(databases);
}

export async function getDatabase(id: string) {
  await assertDatabaseAccess(id);

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
      workspaceId: workspaceItems.workspaceId,
    })
    .from(databases)
    .leftJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, id));
  return result[0];
}

export async function updateDatabaseSchema(id: string, newSchema: any[]) {
  await assertDatabaseAccess(id);
  await db.update(databases).set({ schema: newSchema, updatedAt: new Date() }).where(eq(databases.id, id));
  revalidatePath(`/db/${id}`);
}

export async function updateDatabaseViews(id: string, views: any[]) {
  await assertDatabaseAccess(id);
  await db.update(databases).set({ views, updatedAt: new Date() }).where(eq(databases.id, id));
}
