import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { mintAgentToken } from '@/lib/actions/agentToken';
import { createWorkspace } from '@/lib/actions/workspace';
import { isDeviceIdShape, putInstallResult } from '@/lib/services/installSession';
import { workspaceMcpUrl } from '@/lib/mcp/workspaceEndpoint';
import { InstallForm } from './InstallForm';

// The consent screen for `remnus init`. The CLI opens this with the device id it is
// polling on; approving here mints a workspace-scoped token and hands it to that
// waiting CLI, so the user never copies a token and never signs in twice.
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
    return <InstallDoneView workspaceName={cleanLabel(params.workspace, t('title'))} />;
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

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    const back = new URLSearchParams({ device_id: installDeviceId, project: projectName });
    if (oauthMode) back.set('mode', 'oauth');
    redirect(`/login?callbackUrl=${encodeURIComponent(`/install?${back.toString()}`)}`);
  }

  // Only workspaces the user owns: minting a token requires owner access, so offering
  // a workspace they merely belong to would fail at the last step. Admins see all of
  // their own memberships too — the token mint applies its own admin exception.
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

async function tError(key: string): Promise<string> {
  const t = await getTranslations('Errors');
  return t(key);
}

async function InstallDoneView({ workspaceName }: { workspaceName: string }) {
  const t = await getTranslations('Install');
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#7fc36d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">{t('doneTitle')}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">
          {t('doneHint', { workspace: workspaceName })}
        </p>
        <Link href="/app" className="inline-block mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          {t('openWorkspace')}
        </Link>
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
