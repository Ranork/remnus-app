// One-shot lifecycle email helpers, called fire-and-forget from the triggers
// (signup event, PAT mint, OAuth exchange, daily cron). All of them are
// no-throw and idempotent via the `email_log` guard in send.ts.

import { canReceiveEmail, getMailableUser, sendEmail, wasEmailSent, buildUnsubUrl } from './send';
import { welcomeEmail, agentConnectedEmail, accessRequestEmail } from './templates';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.remnus.com';

/** More owners than this on one workspace and the notification stops being a
 *  notification; the request is still visible in the Members tab for all of them. */
const MAX_NOTIFIED_OWNERS = 5;

/** Fired from the Auth.js `createUser` event. Transactional — ignores unsubscribe. */
export async function sendWelcomeEmailTo(userId: string): Promise<void> {
  try {
    const user = await getMailableUser(userId);
    if (!user || !canReceiveEmail(user, 'welcome')) return;
    if (await wasEmailSent(userId, 'welcome')) return;
    const { subject, html } = welcomeEmail(user.name, buildUnsubUrl(user.id, user.email!));
    await sendEmail({ to: user.email!, userId, kind: 'welcome', subject, html, unsubUserId: user.id });
  } catch (e) {
    console.error('[mail] welcome email failed: ' + (e instanceof Error ? e.message : e));
  }
}

/**
 * Fired when a user connects their FIRST agent (PAT mint or OAuth
 * authorization_code exchange). Sent at most once per user, ever.
 */
export async function maybeSendAgentConnectedEmail(userId: string): Promise<void> {
  try {
    if (await wasEmailSent(userId, 'agent_connected')) return;
    const user = await getMailableUser(userId);
    if (!user || !canReceiveEmail(user, 'agent_connected')) return;
    const { subject, html } = agentConnectedEmail(user.name, buildUnsubUrl(user.id, user.email!));
    await sendEmail({ to: user.email!, userId, kind: 'agent_connected', subject, html, unsubUserId: user.id });
  } catch (e) {
    console.error('[mail] agent-connected email failed: ' + (e instanceof Error ? e.message : e));
  }
}

/**
 * Tells a workspace's owners that someone asked to join it (`npx remnus join`
 * against a workspace they are not a member of).
 *
 * Best-effort in the strong sense: the request row is already committed before
 * this runs, and nothing here may undo that. An owner who never gets the mail
 * still sees the request in the workspace's Members settings — losing the
 * notification must not mean losing the request.
 *
 * Not idempotency-guarded on `email_log` like the once-ever lifecycle mails:
 * asking again months later is legitimate and the owner needs to hear about it.
 * What bounds the volume is upstream — one request row per (workspace, person),
 * and a refusal that holds for a cooling-off period.
 */
export async function notifyOwnersOfAccessRequest(input: {
  ownerIds: string[];
  workspaceId: string;
  workspaceName: string;
  requester: { name: string | null; email: string | null };
  projectName: string | null;
  note: string | null;
}): Promise<void> {
  try {
    const reviewUrl = `${SITE_URL}/w/${input.workspaceId}`;
    for (const ownerId of input.ownerIds.slice(0, MAX_NOTIFIED_OWNERS)) {
      const owner = await getMailableUser(ownerId);
      if (!owner || !canReceiveEmail(owner, 'access_request')) continue;
      const { subject, html } = accessRequestEmail(
        owner.name,
        input.requester,
        input.workspaceName,
        input.projectName,
        input.note,
        reviewUrl,
      );
      await sendEmail({ to: owner.email!, userId: ownerId, kind: 'access_request', subject, html });
    }
  } catch (e) {
    console.error('[mail] access-request email failed: ' + (e instanceof Error ? e.message : e));
  }
}
