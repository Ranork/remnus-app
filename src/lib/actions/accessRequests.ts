'use server';
// Server actions for the access-request flow that `npx remnus join` starts.
//
// Two audiences, two gates:
//  - the joiner submits a request (any signed-in user, about a workspace id they
//    already hold — `submitWorkspaceAccessRequest`);
//  - the owner answers it (owner/admin only — everything else here).
//
// All of these use the strict `getCurrentUser()`, which throws for a
// workspace-locked project-window session. That is deliberate: approving a member
// is workspace *management*, not content, and a project window must never be able
// to do it (AGENTS.md → Project Install §4).

import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { checkCanAddSeat } from '@/lib/services/billing';
import { notifyOwnersOfAccessRequest } from '@/lib/email/lifecycle';
import {
  createAccessRequest,
  getPendingAccessRequest,
  getWorkspaceOwnerIds,
  listPendingAccessRequests,
  markAccessRequestResolved,
  type PendingAccessRequest,
} from '@/lib/services/accessRequests';

/** Owner (or platform admin) gate, mirroring `invites.ts`'s `assertOwner`. */
async function assertOwner(workspaceId: string): Promise<string> {
  const user = await getCurrentUser();
  if (user.role === 'admin') return user.id;

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id),
    ))
    .limit(1);

  if (!member || member.role !== 'owner') {
    const t = await getTranslations('Errors');
    throw new Error(t('ownerOnlyInvite'));
  }
  return user.id;
}

export type SubmitAccessRequestResult =
  | { state: 'pending' }
  | { state: 'denied'; retryAt: string }
  | { state: 'member' };

/**
 * Sends (or refreshes) the caller's request to join a workspace.
 *
 * Deliberately says nothing about the workspace: the same `pending` comes back for
 * a workspace that does not exist, so this cannot be used to probe for ids. The
 * name the joiner sees on screen comes from their own `.remnus/config.json`, which
 * the CLI carried up — never from here.
 */
export async function submitWorkspaceAccessRequest(
  workspaceId: string,
  scope: 'read' | 'write',
  projectName?: string | null,
  note?: string | null,
): Promise<SubmitAccessRequestResult> {
  const user = await getCurrentUser();

  const outcome = await createAccessRequest({
    workspaceId,
    userId: user.id,
    scope,
    projectName: projectName ?? null,
    note: note ?? null,
  });

  if (outcome.state === 'member') return { state: 'member' };
  if (outcome.state === 'denied') return { state: 'denied', retryAt: outcome.retryAt.toISOString() };

  // Notify the owners — after the row is committed, and never in a way that can
  // fail the request. A dropped email costs a notification; a thrown one here
  // would cost the request itself.
  try {
    const [workspace] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace) {
      const ownerIds = await getWorkspaceOwnerIds(workspaceId);
      await notifyOwnersOfAccessRequest({
        ownerIds,
        workspaceId,
        workspaceName: workspace.name,
        requester: { name: user.name ?? null, email: user.email ?? null },
        projectName: projectName ?? null,
        note: note ?? null,
      });
    }
  } catch {
    // best-effort
  }

  return { state: 'pending' };
}

/** Pending requests for the workspace's Members settings. Owner/admin only. */
export async function getWorkspaceAccessRequests(workspaceId: string): Promise<PendingAccessRequest[]> {
  await assertOwner(workspaceId);
  return listPendingAccessRequests(workspaceId);
}

/**
 * Approve: adds the requester to `workspace_members`, which **consumes a seat**.
 *
 * The seat check runs at approval time, not at request time — a request costs the
 * owner nothing, and the plan may well have changed between the two. When it is
 * refused, the request stays pending: the owner can free a seat or upgrade and
 * approve the same request afterwards, instead of it vanishing on a limit.
 */
export async function approveWorkspaceAccessRequest(
  requestId: string,
): Promise<{ success?: boolean; error?: string }> {
  const request = await getPendingAccessRequest(requestId);
  const t = await getTranslations('Errors');
  if (!request) return { error: t('itemNotFound') };

  const resolverId = await assertOwner(request.workspaceId);
  if (request.status !== 'pending') return { success: true };

  const [existing] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, request.workspaceId),
      eq(workspaceMembers.userId, request.userId),
    ))
    .limit(1);

  if (!existing) {
    const code = await checkCanAddSeat(request.workspaceId, request.userId);
    if (code) return { error: t(code) };

    await db.insert(workspaceMembers).values({
      workspaceId: request.workspaceId,
      userId: request.userId,
      // Always `member`. The scope the joiner asked for governs their *token*, not
      // their role, and a request must never be able to mint an owner.
      role: 'member',
      createdAt: new Date(),
    });
  }

  await markAccessRequestResolved(requestId, 'approved', resolverId);
  revalidatePath('/');
  return { success: true };
}

/** Decline. The row stays (status `denied`) — that record is what makes the
 *  cooling-off window in `resolveJoinAccess` enforceable. */
export async function denyWorkspaceAccessRequest(
  requestId: string,
): Promise<{ success?: boolean; error?: string }> {
  const request = await getPendingAccessRequest(requestId);
  if (!request) return { success: true };

  const resolverId = await assertOwner(request.workspaceId);
  if (request.status !== 'pending') return { success: true };

  await markAccessRequestResolved(requestId, 'denied', resolverId);
  revalidatePath('/');
  return { success: true };
}
