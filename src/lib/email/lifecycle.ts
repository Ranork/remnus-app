// One-shot lifecycle email helpers, called fire-and-forget from the triggers
// (signup event, PAT mint, OAuth exchange, daily cron). All of them are
// no-throw and idempotent via the `email_log` guard in send.ts.

import { canReceiveEmail, getMailableUser, sendEmail, wasEmailSent, buildUnsubUrl } from './send';
import { welcomeEmail, agentConnectedEmail } from './templates';

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
