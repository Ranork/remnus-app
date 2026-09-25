'use server';
import crypto from 'crypto';
import { db } from '@/db';
import { users, workspaces, workspaceMembers, agentTokens, uploadedAssets, accountDeletionTokens } from '@/db/schema';
import { eq, and, ne, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { signOut } from '@/auth';
import { cloudinary } from '@/lib/cloudinary';
import { cancelSubscription } from './billing';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';
import { revokeAllAgentAccessOf } from '@/lib/services/agentAccess';
import { sendEmail, canReceiveEmail, isMailConfigured, getMailableUser } from '@/lib/email/send';
import { accountDeletionConfirmEmail } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/email/theme';

// GDPR "right to erasure" self-service account deletion — email-confirmed
// two-step flow (destructive/irreversible, so a click alone isn't enough):
//   1. requestAccountDeletion() — checks preconditions, mints a 30-min
//      single-use token, emails a confirm link. Nothing is deleted yet.
//   2. confirmAccountDeletion(token) — called from the emailed link's confirm
//      page (requires the SAME session to still be logged in — the link
//      alone isn't sufficient, matching a lost/forwarded-email threat model),
//      re-checks everything, then actually deletes.
const TOKEN_TTL_MS = 30 * 60 * 1000;

/** Null when deletable; otherwise the translated reason it's blocked. */
async function blockedReason(user: { id: string; role: string }): Promise<string | null> {
  const t = await getTranslations('Errors');
  if (user.role === 'demo') return t('accountDeleteDemoBlocked');

  // Refuse when the caller bills for a workspace other people still depend
  // on — deleting them would strand those teammates' access. They need to
  // transfer billing ownership (or remove the other members) first.
  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.billingOwnerId, user.id));

  for (const ws of ownedWorkspaces) {
    const [otherMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.userId, user.id)))
      .limit(1);
    if (otherMember) return t('accountDeleteHasTeammates');
  }
  return null;
}

export async function requestAccountDeletion(): Promise<{ sent?: true; error?: string }> {
  const sessionUser = await getCurrentUser();
  const t = await getTranslations('Errors');

  const blocked = await blockedReason(sessionUser);
  if (blocked) return { error: blocked };

  const user = await getMailableUser(sessionUser.id);
  if (!user?.email) return { error: t('accountDeleteNoEmail') };
  if (!isMailConfigured()) return { error: t('accountDeleteEmailUnavailable') };
  if (!canReceiveEmail(user, 'account_deletion')) {
    return { error: t('accountDeleteEmailUnavailable') };
  }

  // Invalidate any previous unused request before minting a fresh one, so an
  // old email in someone's inbox can't be used once a new one is sent.
  await db
    .delete(accountDeletionTokens)
    .where(and(eq(accountDeletionTokens.userId, sessionUser.id), isNull(accountDeletionTokens.usedAt)));

  const token = crypto.randomBytes(32).toString('hex');
  await db.insert(accountDeletionTokens).values({
    token,
    userId: sessionUser.id,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    createdAt: new Date(),
  });

  const confirmUrl = `${SITE_URL}/account-delete/confirm?token=${token}`;
  const { subject, html } = accountDeletionConfirmEmail(user.name, confirmUrl);
  const result = await sendEmail({ to: user.email, userId: sessionUser.id, kind: 'account_deletion', subject, html });
  if (!result.ok) return { error: t('accountDeleteEmailFailed') };

  return { sent: true };
}

export async function confirmAccountDeletion(token: string): Promise<{ error: string } | void> {
  const sessionUser = await getCurrentUser();
  const t = await getTranslations('Errors');

  const [row] = await db
    .select()
    .from(accountDeletionTokens)
    .where(eq(accountDeletionTokens.token, token))
    .limit(1);

  if (!row || row.userId !== sessionUser.id || row.usedAt) {
    return { error: t('accountDeleteInvalidToken') };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { error: t('accountDeleteTokenExpired') };
  }

  const blocked = await blockedReason(sessionUser);
  if (blocked) return { error: blocked };

  await db.update(accountDeletionTokens).set({ usedAt: new Date() }).where(eq(accountDeletionTokens.token, token));

  await performAccountDeletion(sessionUser.id);

  await signOut({ redirectTo: '/' });
}

async function performAccountDeletion(userId: string): Promise<void> {
  // Best-effort: cancel any live Stripe subscription before the billing row is dropped.
  try { await cancelSubscription(); } catch { /* best-effort */ }

  // Best-effort: purge every Cloudinary-hosted file this user uploaded (avatar,
  // page icons, content images, attachments) — the DB ledger row alone isn't
  // real erasure of the underlying file.
  const assets = await db.select().from(uploadedAssets).where(eq(uploadedAssets.userId, userId));
  for (const asset of assets) {
    try {
      await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType });
    } catch { /* best-effort */ }
  }

  // The person's agents go with the account: their tokens sit on their own machines, and
  // agent access follows membership (services/agentAccess.ts). Revoke first — once
  // created_by is nulled below they can no longer be told apart. (Before 2026-09-25 these
  // tokens kept working as "workspace-owned".)
  await revokeAllAgentAccessOf(userId);
  // agent_tokens.created_by has no ON DELETE action (unlike most user FKs), so it would
  // block the user delete below for tokens left in a shared workspace. Null it out.
  await db.update(agentTokens).set({ createdBy: null }).where(eq(agentTokens.createdBy, userId));

  // Delete every workspace where this user is the only member, with ALL its
  // content: `deleteWorkspaceData` also removes the databases, their rows and
  // the comments, which a bare workspace delete left behind (databases.item_id
  // is SET NULL) — erasure was incomplete until 2026-09-24.
  // A workspace with other members is left alone; the user-delete below
  // removes just this user's own membership row from it.
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  for (const { workspaceId } of memberships) {
    const [otherMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), ne(workspaceMembers.userId, userId)))
      .limit(1);
    if (!otherMember) {
      await deleteWorkspaceData(workspaceId);
    }
  }

  // Cascades sessions/accounts/remaining workspace_members/oauth tokens/
  // subscriptions/user_sessions/uploaded_assets ledger rows/account_deletion_tokens;
  // SET NULLs the audit/log tables designed to survive it
  // (agent_activity.owner_user_id, demo_feedback.user_id, email_log.user_id).
  await db.delete(users).where(eq(users.id, userId));
}
