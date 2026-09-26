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
import {
  getInstallLinkState,
  isDeviceIdShape,
  putInstallResult,
  type InstallLinkState,
} from '@/lib/services/installSession';
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
  /** When the CLI issued this link, epoch seconds in server time (CLI ≥ 0.1.11). */
  issued?: string;
  error?: string;
}

interface LinkContext {
  deviceId: string;
  projectName: string;
  oauthMode: boolean;
  joinTarget: string | null;
  issued: string | undefined;
}

/**
 * This same link, rebuilt from its parts — for the login round trip, for an error, and
 * for sending a spent link back to itself so the page shows why it is spent. Every exit
 * carries `issued` along, or a link could outlive its five minutes by bouncing through
 * the login page.
 */
function linkHref(link: LinkContext, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ device_id: link.deviceId, project: link.projectName });
  if (link.oauthMode) params.set('mode', 'oauth');
  if (link.joinTarget) params.set('workspace', link.joinTarget);
  if (link.issued) params.set('issued', link.issued);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/install?${params.toString()}`;
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
  const link: LinkContext = { deviceId: installDeviceId, projectName, oauthMode, joinTarget, issued: params.issued };

  // Before sign-in on purpose: a spent link has nothing to sign in for. The screen names
  // no workspace, so it tells whoever holds the link nothing they didn't already know.
  const linkState = await getInstallLinkState(installDeviceId, params.issued);
  if (linkState.state !== 'open') {
    return <InstallLinkClosedView state={linkState} command={joinTarget ? 'npx remnus join' : 'npx remnus init'} />;
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(linkHref(link))}`);
  }

  if (joinTarget) {
    return joinView({
      workspaceId: joinTarget,
      userId: user!.id,
      userName: user!.name ?? user!.email ?? '',
      link,
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

    // Re-checked at submit, not only at render: a form left open in a second tab, or past
    // the five minutes, must not mint a token that no terminal will ever pick up.
    if ((await getInstallLinkState(installDeviceId, link.issued)).state !== 'open') redirect(linkHref(link));

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
    redirect(linkHref(link, { error: failure ?? 'unknown' }));
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
  link,
  error,
}: {
  workspaceId: string;
  userId: string;
  userName: string;
  link: LinkContext;
  error?: string;
}) {
  const t = await getTranslations('Install');
  const access = await resolveJoinAccess(workspaceId, userId);
  const { projectName, oauthMode, deviceId: installDeviceId } = link;

  async function handleJoin(formData: FormData) {
    'use server';

    const currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser) return;

    // Same as `handleInstall`: a spent or expired link must not mint (or request) anything.
    if ((await getInstallLinkState(installDeviceId, link.issued)).state !== 'open') redirect(linkHref(link));

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
          role: current.role,
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
          destination = linkHref(link);
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
    redirect(linkHref(link, { error: failure ?? 'unknown' }));
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

/**
 * A link that already did its job, or waited too long. Deliberately a dead end — no form,
 * no "try again" button: the only way to a working link is a fresh CLI run, because only
 * a CLI that is still waiting can receive what the form would produce.
 */
async function InstallLinkClosedView({
  state,
  command,
}: {
  state: Exclude<InstallLinkState, { state: 'open' }>;
  command: string;
}) {
  const t = await getTranslations('Install');
  const connected = state.state === 'used' && state.status === 'connected';

  const title = connected ? t('usedTitle') : state.state === 'used' ? t('usedOtherTitle') : t('expiredTitle');
  const hint = connected
    ? t('usedHint')
    : state.state === 'used'
      ? t('usedOtherHint', { command })
      : t('expiredHint', { command });

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${connected ? 'bg-green-500/15' : 'bg-neutral-800'}`}>
          {connected ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="#7fc36d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          )}
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">{hint}</p>
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
