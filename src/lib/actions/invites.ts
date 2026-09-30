'use server';
import { db } from '@/db';
import { workspaceInvites, workspaceMembers, workspaces } from '@/db/schema';
import { eq, and, isNull, or, gt, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { checkCanAddSeatForEmail } from '@/lib/services/billing';
import { touchWorkspaces } from '@/lib/services/changeVersion';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function assertOwner(workspaceId: string): Promise<string> {
  const user = await getCurrentUser();
  if (user.role === 'admin') return user.id;
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!m || m.role !== 'owner') {
    const t = await getTranslations('Errors');
    throw new Error(t('ownerOnlyInvite'));
  }
  return user.id;
}

export async function getWorkspaceInvites(workspaceId: string) {
  await assertOwner(workspaceId);
  const now = new Date();
  const rows = await db
    .select({ id: workspaceInvites.id, email: workspaceInvites.email, role: workspaceInvites.role, token: workspaceInvites.token, createdAt: workspaceInvites.createdAt })
    .from(workspaceInvites)
    .where(and(
      eq(workspaceInvites.workspaceId, workspaceId),
      isNull(workspaceInvites.acceptedAt),
      or(isNull(workspaceInvites.expiresAt), gt(workspaceInvites.expiresAt, now)),
    ))
    .orderBy(desc(workspaceInvites.createdAt));
  return rows.map((r) => ({ ...r, inviteLink: `${APP_URL}/invite/${r.token}` }));
}

export async function revokeWorkspaceInvite(inviteId: string): Promise<{ success?: boolean; error?: string }> {
  const [inv] = await db.select({ workspaceId: workspaceInvites.workspaceId }).from(workspaceInvites).where(eq(workspaceInvites.id, inviteId)).limit(1);
  if (!inv) return { success: true };
  await assertOwner(inv.workspaceId);
  await db.delete(workspaceInvites).where(eq(workspaceInvites.id, inviteId));
  revalidatePath('/');
  return { success: true };
}

// For the public-facing /invite/[token] accept page.
export async function getInviteByToken(token: string) {
  const [row] = await db
    .select({
      workspaceId: workspaceInvites.workspaceId,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      acceptedAt: workspaceInvites.acceptedAt,
      expiresAt: workspaceInvites.expiresAt,
      wsName: workspaces.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(eq(workspaceInvites.token, token))
    .limit(1);
  if (!row) return null;
  return {
    workspaceId: row.workspaceId,
    workspaceName: row.wsName,
    email: row.email,
    role: row.role,
    accepted: !!row.acceptedAt,
    expired: !!(row.expiresAt && row.expiresAt.getTime() < Date.now()),
  };
}

// Accept an invite for the logged-in user (bearer token — email match not required).
export async function acceptInvite(token: string): Promise<{ ok?: boolean; workspaceId?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'not_authenticated' };
  const t = await getTranslations('Errors');

  const [inv] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token)).limit(1);
  if (!inv) return { error: t('inviteInvalid') };
  if (inv.acceptedAt) return { ok: true, workspaceId: inv.workspaceId };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return { error: t('inviteExpired') };

  const [existing] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, inv.workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  if (!existing) {
    if (session.user.role !== 'admin') {
      // The invite already reserved a seat for this email, so this normally passes.
      const code = await checkCanAddSeatForEmail(inv.workspaceId, inv.email, session.user.id);
      if (code) return { error: t(code) };
    }
    await db.insert(workspaceMembers).values({
      workspaceId: inv.workspaceId,
      userId: session.user.id,
      role: inv.role === 'viewer' ? 'viewer' : 'member',
      createdAt: new Date(),
    });
  }

  await db.update(workspaceInvites).set({ acceptedAt: new Date() }).where(eq(workspaceInvites.id, inv.id));
  await touchWorkspaces(inv.workspaceId);
  (await cookies()).delete('pending_invite');
  revalidatePath('/');
  return { ok: true, workspaceId: inv.workspaceId };
}
