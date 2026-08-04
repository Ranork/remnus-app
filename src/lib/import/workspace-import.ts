import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { checkCanCreateWorkspace } from '@/lib/services/billing';

export class ImportWorkspaceLimitError extends Error {
  readonly code = 'workspaceLimitReached';
}

export async function createImportedWorkspaceForUser(userId: string, name: string): Promise<string> {
  const limit = await checkCanCreateWorkspace(userId);
  if (limit) throw new ImportWorkspaceLimitError('Workspace limit reached');

  const id = crypto.randomUUID();
  const now = new Date();
  await db.transaction(async tx => {
    await tx.insert(workspaces).values({
      id,
      name: name.trim() || 'Imported workspace',
      billingOwnerId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({ workspaceId: id, userId, role: 'owner', createdAt: now });
  });
  return id;
}
