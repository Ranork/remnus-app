'use server';
import { signOut } from '@/auth';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, workspaceMembers, accounts, sessions, userSessions, agentTokens } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

export async function logout() {
  // Clear the persisted workspace selection so the next account doesn't inherit it
  const cookieStore = await cookies();
  cookieStore.delete('remnus_workspace_id');
  await signOut({ redirectTo: '/login' });
}

export async function inviteToWorkspace(
  workspaceId: string,
  email: string,
  role: 'member' | 'viewer' = 'member',
) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const t = await getTranslations('Errors');

  // Only owners and admins can invite
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin) {
    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership[0] || membership[0].role !== 'owner') {
      return { error: t('ownerOnlyInvite') };
    }
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) {
    return { error: t('userNotFound') };
  }

  const existing = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUser.id),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { error: t('alreadyMember') };
  }

  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: targetUser.id,
    role,
    createdAt: new Date(),
  });

  revalidatePath('/');
  return { success: true };
}

export async function removeFromWorkspace(workspaceId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('Errors');

  const isAdmin = session.user.role === 'admin';
  if (!isAdmin) {
    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership[0] || membership[0].role !== 'owner') {
      return { error: t('ownerOnlyRemove') };
    }
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    );

  revalidatePath('/');
  return { success: true };
}

export async function getWorkspaceMembers(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function getAllUsers() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    const t = await getTranslations('Errors');
    return { error: t('adminRequired') };
  }

  const userRows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    image: users.image,
    role: users.role,
    createdAt: users.createdAt,
    hasPassword: sql<number>`case when ${users.passwordHash} is not null then 1 else 0 end`,
  }).from(users);

  const accountRows = await db.select({ userId: accounts.userId, provider: accounts.provider }).from(accounts);
  const providerMap = new Map<string, string[]>();
  for (const acc of accountRows) {
    if (!providerMap.has(acc.userId)) providerMap.set(acc.userId, []);
    providerMap.get(acc.userId)!.push(acc.provider);
  }

  return userRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    createdAt: u.createdAt,
    authType: providerMap.get(u.id)?.includes('google')
      ? ('google' as const)
      : providerMap.get(u.id)?.includes('github')
        ? ('github' as const)
        : u.hasPassword
          ? ('email' as const)
          : ('unknown' as const),
  }));
}

export async function adminDeleteUser(userId: string) {
  const session = await auth();
  const t = await getTranslations('Errors');
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { error: t('adminRequired') };
  }
  if (session.user.id === userId) {
    return { error: t('cannotDeleteSelf') };
  }
  // Delete dependent rows explicitly. ON DELETE CASCADE only fires when
  // PRAGMA foreign_keys=ON, which we don't enable on the serverless/Turso
  // connection — so relying on it would leave orphaned auth rows in prod
  // (the exact corruption that caused cross-account identity bleaks).
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  // agent_tokens.created_by references user(id) with no cascade — null it out
  // so the token (which belongs to the workspace, not the user) survives.
  await db.update(agentTokens).set({ createdBy: null }).where(eq(agentTokens.createdBy, userId));
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath('/');
  return { success: true };
}

export async function setUserRole(userId: string, role: 'user' | 'admin') {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    const t = await getTranslations('Errors');
    return { error: t('adminRequired') };
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath('/');
  return { success: true };
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: 'member' | 'viewer',
) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('Errors');

  const isAdmin = session.user.role === 'admin';
  if (!isAdmin) {
    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership[0] || membership[0].role !== 'owner') {
      return { error: t('ownerOnlyUpdateRole') };
    }
  }

  // Ensure target user is a member of the workspace
  const [targetMember] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return { error: t('memberNotFound') };
  }

  if (targetMember.role === 'owner') {
    return { error: t('cannotChangeOwnerRole') };
  }

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(eq(workspaceMembers.id, targetMember.id));

  revalidatePath('/');
  return { success: true };
}

export async function transferWorkspaceOwnership(
  workspaceId: string,
  newOwnerUserId: string,
) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('Errors');

  const isAdmin = session.user.role === 'admin';
  if (!isAdmin) {
    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership[0] || membership[0].role !== 'owner') {
      return { error: t('ownerOnlyTransfer') };
    }
  }

  // Ensure target user is a member of the workspace
  const [targetMember] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, newOwnerUserId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return { error: t('memberNotFound') };
  }

  if (targetMember.role === 'owner') {
    return { error: t('alreadyOwner') };
  }

  // Find all current owners of this workspace
  const currentOwners = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, 'owner'),
      ),
    );

  // Downgrade current owners to 'member'
  for (const owner of currentOwners) {
    await db
      .update(workspaceMembers)
      .set({ role: 'member' })
      .where(eq(workspaceMembers.id, owner.id));
  }

  // Upgrade target user to 'owner'
  await db
    .update(workspaceMembers)
    .set({ role: 'owner' })
    .where(eq(workspaceMembers.id, targetMember.id));

  revalidatePath('/');
  return { success: true };
}

