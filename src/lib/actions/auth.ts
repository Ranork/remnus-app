'use server';
import { signOut } from '@/auth';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, workspaces, workspaceMembers, workspaceInvites, accounts, sessions, userSessions, agentTokens } from '@/db/schema';
import { eq, ne, and, sql, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { checkCanAddSeatForEmail } from '@/lib/services/billing';

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

  const normalizedEmail = email.trim().toLowerCase();

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Seat limit (the billing owner's plan caps distinct people; admins bypass).
  if (!isAdmin) {
    const code = await checkCanAddSeatForEmail(workspaceId, normalizedEmail, targetUser?.id ?? null);
    if (code) return { error: t(code) };
  }

  if (targetUser) {
    const existing = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUser.id)))
      .limit(1);
    if (existing[0]) return { error: t('alreadyMember') };

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: targetUser.id,
      role,
      createdAt: new Date(),
    });

    revalidatePath('/');
    return { success: true };
  }

  // No account yet → create (or reuse) a pending invite and return a shareable link.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const [pending] = await db
    .select({ token: workspaceInvites.token })
    .from(workspaceInvites)
    .where(and(
      eq(workspaceInvites.workspaceId, workspaceId),
      eq(workspaceInvites.email, normalizedEmail),
      isNull(workspaceInvites.acceptedAt),
    ))
    .limit(1);

  let token = pending?.token;
  if (!token) {
    token = randomBytes(24).toString('hex');
    await db.insert(workspaceInvites).values({
      workspaceId,
      email: normalizedEmail,
      role,
      token,
      invitedBy: session.user.id,
      createdAt: new Date(),
    });
  }

  revalidatePath('/');
  return { success: true, inviteLink: `${appUrl}/invite/${token}` };
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
  }).from(users).where(ne(users.role, 'demo')); // demo users are ephemeral — keep them out of the admin list

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
  // Protect the shared demo account — deleting it would wipe its session history
  // and force loginAsDemo to create a new UUID, losing all engagement tracking.
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (target?.role === 'demo') {
    return { error: t('cannotDeleteDemoUser') };
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

  // Billing follows ownership: the workspace moves into the new owner's seat pool
  // and is governed by their plan.
  await db
    .update(workspaces)
    .set({ billingOwnerId: newOwnerUserId })
    .where(eq(workspaces.id, workspaceId));

  revalidatePath('/');
  return { success: true };
}

