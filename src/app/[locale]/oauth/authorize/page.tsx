import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/db';
import { oauthClients, oauthAuthCodes, workspaceMembers, workspaces } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHmac } from 'crypto';
import { getTranslations } from 'next-intl/server';
import { OAuthAuthorizeForm } from './OAuthAuthorizeForm';
import { AGENT_MARKS } from '@/components/features/agents/agentMarks';
import { workspaceIdFromResource } from '@/lib/mcp/workspaceEndpoint';
import { captureForUser } from '@/lib/analytics/server';

function signRedirectUrl(url: string): string {
  // Fail closed: a missing AUTH_SECRET would make the HMAC key public and the
  // redirect signature forgeable (open redirect). Auth.js requires it anyway.
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return createHmac('sha256', secret).update(url).digest('hex');
}

interface SearchParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  /** RFC 8707 resource indicator — the exact MCP URL the client was configured with. */
  resource?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

function oauthErrorRedirect(redirectUri: string, error: string, state: string | undefined) {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (state) u.searchParams.set('state', state);
  return redirect(u.toString());
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const {
    client_id,
    redirect_uri,
    response_type,
    resource,
    scope = 'read',
    state,
    code_challenge,
    code_challenge_method = 'S256',
  } = params;

  const t = await getTranslations('OAuthAuthorize');

  // Basic parameter validation before touching DB
  if (!client_id || !redirect_uri || !code_challenge) {
    return (
      <ErrorPage title={t('errorTitle')} message={t('missingParams')} />
    );
  }
  if (response_type !== 'code') {
    return <ErrorPage title={t('errorTitle')} message={t('unsupportedResponseType')} />;
  }
  if (code_challenge_method !== 'S256') {
    return <ErrorPage title={t('errorTitle')} message={t('unsupportedChallengeMethod')} />;
  }

  // Validate scope
  const validScope = scope === 'write' ? 'write' : 'read';

  // Look up registered client
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, client_id))
    .limit(1);

  if (!client) {
    return <ErrorPage title={t('errorTitle')} message={t('unknownClient')} />;
  }

  // Validate redirect_uri against registered list
  if (!client.redirectUris.includes(redirect_uri)) {
    return <ErrorPage title={t('errorTitle')} message={t('redirectUriMismatch')} />;
  }

  // Auth check — middleware redirects to /login with callbackUrl if not logged in
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(params as Record<string,string>).toString()}`)}`);

  // Fetch user's workspaces (owner or member)
  const userWorkspaces = (await db
    .select({ id: workspaces.id, name: workspaces.name, icon: workspaces.icon, iconColor: workspaces.iconColor, role: workspaceMembers.role })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user!.id),
    ))
    .orderBy(workspaces.name))
    // The form offers write only where the role allows it; handleApprove clamps again.
    .map(({ role, ...ws }) => ({ ...ws, viewer: role === 'viewer' }));

  if (userWorkspaces.length === 0) {
    return <ErrorPage title={t('errorTitle')} message={t('noWorkspaces')} />;
  }

  // A workspace-pinned MCP URL (`/api/mcp/w/<id>`, what `remnus init` writes into a
  // project) arrives here as the RFC 8707 `resource` indicator. The user already chose
  // the workspace when they set the project up, so there is nothing left to pick —
  // collapse the picker to that one workspace instead of asking again.
  const pinnedWorkspaceId = workspaceIdFromResource(resource);
  const consentWorkspaces = pinnedWorkspaceId
    ? userWorkspaces.filter((ws) => ws.id === pinnedWorkspaceId)
    : userWorkspaces;

  // Pinned to a workspace this account cannot reach: refuse rather than silently
  // falling back to the full picker, which would grant a token for the wrong one.
  if (pinnedWorkspaceId && consentWorkspaces.length === 0) {
    return <ErrorPage title={t('errorTitle')} message={t('pinnedWorkspaceUnavailable')} />;
  }

  // Funnel: the editor's OAuth flow reached our consent screen. A gap between
  // `connect_editor_selected` and this event = config friction (couldn't even
  // kick off OAuth from their tool).
  await captureForUser('oauth_authorize_viewed', user!.id, {
    clientId: client_id,
    scope: validScope,
    clientName: client.clientName,
  });

  async function handleApprove(formData: FormData) {
    'use server';
    const workspaceId = formData.get('workspace_id') as string;
    if (!workspaceId) return;

    // The picker was collapsed to one workspace, but the form field is still client
    // input: re-check it here so a crafted post cannot mint a token for a different
    // workspace than the one the resource indicator asked for.
    if (pinnedWorkspaceId && workspaceId !== pinnedWorkspaceId) return;

    // User-chosen scope from the consent form (defaults to the requested scope, can be upgraded to write).
    const chosenScope = formData.get('scope') === 'write' ? 'write' : 'read';

    // Agent brand (icon) + friendly label picked on the consent form.
    const rawAgent = (formData.get('agent_name') as string | null)?.trim() || '';
    const chosenAgent = AGENT_MARKS.some(a => a.id === rawAgent) ? rawAgent : null;
    const chosenDisplayName = ((formData.get('display_name') as string | null)?.trim() || '').slice(0, 60) || null;

    // Verify user still has access to this workspace
    const currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser) return;

    const [member] = await db
      .select({ id: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, currentUser.id),
      ))
      .limit(1);

    if (!member) return;

    // A viewer's agent may only read — the form field is client input.
    const scope = member.role === 'viewer' ? 'read' : chosenScope;

    const code = randomBytes(32).toString('hex');
    await db.insert(oauthAuthCodes).values({
      code,
      clientId:            client_id!,
      userId:              currentUser.id,
      workspaceId,
      redirectUri:         redirect_uri!,
      codeChallenge:       code_challenge!,
      codeChallengeMethod: code_challenge_method,
      scope,
      agentName:           chosenAgent,
      displayName:         chosenDisplayName,
      expiresAt:           new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    // Funnel: user approved consent — the auth code is now in flight to the editor.
    await captureForUser('oauth_consent_result', currentUser.id, {
      result: 'approved',
      scope,
      workspaceId,
      clientId: client_id,
      agentName: chosenAgent,
    });

    const dest = new URL(redirect_uri!);
    dest.searchParams.set('code', code);
    if (state) dest.searchParams.set('state', state);
    const destStr = dest.toString();
    const sig = signRedirectUrl(destStr);
    redirect(`/oauth/authorized?to=${encodeURIComponent(destStr)}&sig=${sig}`);
  }

  async function handleDeny() {
    'use server';
    // Funnel: user explicitly denied consent — a distinct, intentional drop-off.
    const denier = await getCurrentUser().catch(() => null);
    if (denier) {
      await captureForUser('oauth_consent_result', denier.id, {
        result: 'denied',
        clientId: client_id,
      });
    }
    oauthErrorRedirect(redirect_uri!, 'access_denied', state);
  }

  return (
    <OAuthAuthorizeForm
      clientName={client.clientName}
      scope={validScope}
      workspaces={consentWorkspaces}
      userName={user!.name ?? user!.email ?? ''}
      onApprove={handleApprove}
      onDeny={handleDeny}
    />
  );
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-400/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="#cd4d55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-white font-semibold mb-2">{title}</h1>
        <p className="text-neutral-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
