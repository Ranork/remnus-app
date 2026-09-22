import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { mintAgentToken, mintProjectAgentToken } from '@/lib/actions/agentToken';
import { submitWorkspaceAccessRequest } from '@/lib/actions/accessRequests';
import { createWorkspace } from '@/lib/actions/workspace';
import { resolveJoinAccess } from '@/lib/services/accessRequests';
import { isDeviceIdShape, putInstallResult } from '@/lib/services/installSession';
import { isWorkspaceIdShape, workspaceMcpUrl } from '@/lib/mcp/workspaceEndpoint';
import { InstallForm } from './InstallForm';
import { JoinForm } from './JoinForm';

// The consent screen for `remnus init`. The CLI opens this with the device id it is
// polling on; approving here mints a workspace-scoped token and hands it to that
// waiting CLI, so the user never copies a token and never signs in twice.
//
// It serves two flows that share that one channel:
//
//  - **install** (no `workspace` param) — pick or create a workspace you own, and
//    connect this project to it. This is `remnus init`.
//  - **join** (`workspace=<id>`) — someone else already connected this project and
//    committed `.remnus/config.json`; get *your own* credential for that same
//    workspace. This is `remnus join`. See `joinView` below for what a non-member
//    is and is not told.
//
// Deliberately behind the normal session check (not in the middleware allowlist): an
// unauthenticated visit gets the standard login-then-return redirect for free.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const NEW_WORKSPACE = '__new__';

interface SearchParams {
  device_id?: string;
  /** Directory name the CLI ran in — display only, and the default new-workspace name. */
  project?: string;
  /** `oauth` = pick a workspace only, mint nothing. Anything else = the default PAT mode. */
  mode?: string;
  done?: string;
  /** On `done`, the workspace name to show. Otherwise: the join target's **id**. */
  workspace?: string;
  error?: string;
}

/** Project names come off the user's filesystem: show them, but bound what we render. */
function cleanLabel(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim().slice(0, 60);
  return trimmed || fallback;
}

export default async function InstallPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations('Install');

  if (params.done) {
    const kind =
      params.done === 'joined' || params.done === 'requested' || params.done === 'denied'
        ? params.done
        : 'connected';
    return <InstallDoneView workspaceName={cleanLabel(params.workspace, t('title'))} kind={kind} />;
  }

  const deviceId = params.device_id;
  if (!isDeviceIdShape(deviceId)) {
    return <ErrorPage title={t('errorTitle')} message={t('missingDevice')} />;
  }

  // Bound to a plain string so the server action below closes over a narrowed value
  // rather than the optional search param.
  const installDeviceId: string = deviceId;

  const projectName = cleanLabel(params.project, t('untitledProject'));
  const oauthMode = params.mode === 'oauth';
  // Shape-checked, not existence-checked: a malformed id is the CLI's problem, and
  // whether a well-formed one names a real workspace is not something this screen
  // may reveal (see `joinView`).
  const joinTarget = isWorkspaceIdShape(params.workspace) ? params.workspace : null;

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    const back = new URLSearchParams({ device_id: installDeviceId, project: projectName });
    if (oauthMode) back.set('mode', 'oauth');
    if (joinTarget) back.set('workspace', joinTarget);
    redirect(`/login?callbackUrl=${encodeURIComponent(`/install?${back.toString()}`)}`);
  }

  if (joinTarget) {
    return joinView({
      workspaceId: joinTarget,
      userId: user!.id,
      userName: user!.name ?? user!.email ?? '',
      projectName,
      oauthMode,
      installDeviceId,
      error: params.error,
    });
  }

  // Only workspaces the user owns: `init` is the flow that *connects* a project, and
  // connecting is an owner's decision. Membership alone is the `join` flow's business
  // (above), which reaches a workspace by the id the project already carries rather
  // than by listing anything.
  const owned = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      icon: workspaces.icon,
      iconColor: workspaces.iconColor,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user!.id),
      eq(workspaceMembers.role, 'owner'),
    ))
    .orderBy(workspaces.name);

  async function handleInstall(formData: FormData) {
    'use server';

    const currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser) return;

    const scope = formData.get('scope') === 'read' ? 'read' : 'write';
    const target = (formData.get('workspace_id') as string | null) ?? '';
    const requestedName = cleanLabel(formData.get('new_workspace_name') as string | null ?? '', projectName);

    // `redirect()` signals by throwing, so it must run outside the try — otherwise the
    // catch below would swallow the navigation and report it as an install failure.
    let failure: string | null = null;
    let destination: string | null = null;

    try {
      let workspaceId: string;
      let workspaceName: string;

      if (target === NEW_WORKSPACE) {
        const created = await createWorkspace(requestedName);
        if ('error' in created) throw new Error(created.error);
        workspaceId = created.id;
        workspaceName = requestedName;
      } else {
        // Re-verify ownership: the field is client input, and membership may have
        // changed between rendering this page and submitting it.
        const [member] = await db
          .select({ name: workspaces.name })
          .from(workspaces)
          .innerJoin(workspaceMembers, and(
            eq(workspaceMembers.workspaceId, workspaces.id),
            eq(workspaceMembers.userId, currentUser.id),
            eq(workspaceMembers.role, 'owner'),
          ))
          .where(eq(workspaces.id, target))
          .limit(1);

        if (!member) throw new Error(await tError('unauthorized'));
        workspaceId = target;
        workspaceName = member.name;
      }

      // OAuth mode deliberately mints nothing: the MCP client will run its own
      // browser flow against the pinned URL and hold the credential itself.
      const token = oauthMode
        ? null
        : (await mintAgentToken(
            workspaceId,
            `Remnus CLI · ${projectName}`,
            scope,
            undefined,
            null,
          )).token;

      await putInstallResult(installDeviceId, {
        status: 'connected',
        token,
        workspaceId,
        workspaceName,
        scope,
        mcpUrl: workspaceMcpUrl(APP_URL, workspaceId),
      });

      destination = `/install?done=1&workspace=${encodeURIComponent(workspaceName)}`;
    } catch (err) {
      failure = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
    }

    if (destination) redirect(destination);

    const back = new URLSearchParams({
      device_id: installDeviceId,
      project: projectName,
      error: failure ?? 'unknown',
    });
    if (oauthMode) back.set('mode', 'oauth');
    redirect(`/install?${back.toString()}`);
  }

  return (
    <InstallForm
      projectName={projectName}
      authMode={oauthMode ? 'oauth' : 'pat'}
      workspaces={owned}
      userName={user!.name ?? user!.email ?? ''}
      error={params.error ? cleanLabel(params.error, t('genericError')).slice(0, 200) : undefined}
      onInstall={handleInstall}
    />
  );
}

/**
 * The `remnus join` screen: a workspace id arrived from a committed file, and the
 * question is what *this* person may do with it.
 *
 * **The id is not a credential.** It is in the repository, so everyone with a clone
 * has it. Membership is therefore re-read here on every render and again inside each
 * action below, and a non-member is told nothing about the workspace — not its name,
 * not its members, not whether it exists at all. The project name on screen is the
 * one the CLI read off the joiner's own disk.
 */
async function joinView({
  workspaceId,
  userId,
  userName,
  projectName,
  oauthMode,
  installDeviceId,
  error,
}: {
  workspaceId: string;
  userId: string;
  userName: string;
  projectName: string;
  oauthMode: boolean;
  installDeviceId: string;
  error?: string;
}) {
  const t = await getTranslations('Install');
  const access = await resolveJoinAccess(workspaceId, userId);

  async function handleJoin(formData: FormData) {
    'use server';

    const currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser) return;

    const requestedScope = formData.get('scope') === 'read' ? 'read' : 'write';
    const note = ((formData.get('note') as string | null) ?? '').trim().slice(0, 280);

    let failure: string | null = null;
    let destination: string | null = null;

    try {
      // Re-resolve rather than trusting what the render decided: the owner may have
      // approved (or removed) this person in the meantime, and the form fields are
      // client input either way.
      const current = await resolveJoinAccess(workspaceId, currentUser.id);

      if (current.state === 'member') {
        const scope = current.maxScope === 'read' ? 'read' : requestedScope;

        // OAuth mode stores no secret in the project — the MCP client runs its own
        // browser flow — so a join there only has to confirm the person is in.
        const minted = oauthMode
          ? null
          : await mintProjectAgentToken(workspaceId, `Remnus CLI · ${projectName}`, scope);

        const [workspace] = await db
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1);

        const workspaceName = workspace?.name ?? projectName;

        await putInstallResult(installDeviceId, {
          status: 'connected',
          token: minted?.token ?? null,
          workspaceId,
          workspaceName,
          scope: minted?.scope ?? scope,
          mcpUrl: workspaceMcpUrl(APP_URL, workspaceId),
          replacedPrevious: minted?.replacedPrevious ?? false,
        });

        destination = `/install?done=joined&workspace=${encodeURIComponent(workspaceName)}`;
      } else {
        const result = await submitWorkspaceAccessRequest(
          workspaceId,
          requestedScope,
          projectName,
          note || null,
        );

        // Membership landed between the branch above and this call (the owner
        // approved at exactly the wrong moment). Nothing was requested and nothing
        // was minted, so send them back to a freshly rendered page — which will now
        // show the connect view — rather than reporting a request that never happened.
        // Routed through `destination` like every other exit here: `redirect()` throws,
        // and inside this try the catch below would swallow it as an install failure.
        if (result.state === 'member') {
          const back = new URLSearchParams({
            device_id: installDeviceId,
            project: projectName,
            workspace: workspaceId,
          });
          if (oauthMode) back.set('mode', 'oauth');
          destination = `/install?${back.toString()}`;
        } else {
          // The CLI is waiting on the poll channel, so every outcome reports back —
          // a person staring at a terminal deserves to be told "denied" rather than
          // watching it time out.
          await putInstallResult(installDeviceId, {
            status: result.state === 'denied' ? 'denied' : 'requested',
            token: null,
            workspaceId,
            // Never the real name: this branch is reached by non-members.
            workspaceName: projectName,
            scope: requestedScope,
            mcpUrl: workspaceMcpUrl(APP_URL, workspaceId),
            retryAt: result.state === 'denied' ? result.retryAt : undefined,
          });

          destination = `/install?done=${result.state === 'denied' ? 'denied' : 'requested'}&workspace=${encodeURIComponent(projectName)}`;
        }
      }
    } catch (err) {
      failure = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
    }

    if (destination) redirect(destination);

    const back = new URLSearchParams({
      device_id: installDeviceId,
      project: projectName,
      workspace: workspaceId,
      error: failure ?? 'unknown',
    });
    if (oauthMode) back.set('mode', 'oauth');
    redirect(`/install?${back.toString()}`);
  }

  return (
    <JoinForm
      projectName={projectName}
      userName={userName}
      authMode={oauthMode ? 'oauth' : 'pat'}
      access={
        access.state === 'member'
          ? { state: 'member', maxScope: access.maxScope, viewer: access.role === 'viewer' }
          : access.state === 'denied'
            ? { state: 'denied', retryAt: access.retryAt.toISOString() }
            : { state: access.state }
      }
      error={error ? cleanLabel(error, t('genericError')).slice(0, 200) : undefined}
      onJoin={handleJoin}
    />
  );
}

async function tError(key: string): Promise<string> {
  const t = await getTranslations('Errors');
  return t(key);
}

async function InstallDoneView({
  workspaceName,
  kind,
}: {
  workspaceName: string;
  kind: 'connected' | 'joined' | 'requested' | 'denied';
}) {
  const t = await getTranslations('Install');
  // 'requested' and 'denied' are both "nothing was connected" outcomes, so they share
  // the waiting-clock treatment rather than the green tick.
  const settled = kind === 'connected' || kind === 'joined';

  const title = kind === 'requested'
    ? t('requestedTitle')
    : kind === 'denied'
      ? t('deniedTitle')
      : kind === 'joined' ? t('joinedTitle') : t('doneTitle');

  const hint = kind === 'requested'
    ? t('requestedHint')
    : kind === 'denied'
      ? t('deniedHint')
      : kind === 'joined'
        ? t('joinedHint', { workspace: workspaceName })
        : t('doneHint', { workspace: workspaceName });

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${settled ? 'bg-green-500/15' : 'bg-amber-500/15'}`}>
          {!settled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="#e0b568" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="#7fc36d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">{hint}</p>
        {settled && (
          <Link href="/app" className="inline-block mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            {t('openWorkspace')}
          </Link>
        )}
      </div>
    </div>
  );
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold text-white mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
