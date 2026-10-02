import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signOut } from '@/auth';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { getTranslations } from 'next-intl/server';
import { getAllWorkspaceItems, getWorkspaces, type ShellItemRow, type WorkspaceItemRow } from '@/lib/actions/workspace';
import { loadAgentPresence } from '@/lib/services/agentPresence';
import { EMPTY_PRESENCE } from '@/lib/agentPresence';
import WorkspaceSidebar from '@/components/features/WorkspaceSidebar';
import MobileNavWrapper from '@/components/features/MobileNavWrapper';
import QueryProvider from '@/components/providers/QueryProvider';
import AppShell from '@/components/AppShell';
import ClientMessages from '@/i18n/ClientMessages';
import ActivityTracker from '@/components/providers/ActivityTracker';
import LastPathTracker from '@/components/providers/LastPathTracker';
import { lastPathOwnerTag } from '@/lib/server/lastPath';
import { CHANGELOG_SEEN_COOKIE, countUnseenEntries } from '@/lib/changelog';
import BillingSuccessModal from '@/components/features/BillingSuccessModal';
import UpdateBanner from '@/components/features/UpdateBanner';
import DownloadToast from '@/components/features/DownloadToast';
import { Toaster } from '@/components/ui/toast';
import DemoFeedbackPrompt from '@/components/features/DemoFeedbackPrompt';
import PwaInstallNudge from '@/components/features/PwaInstallNudge';
import ProjectWindowBanner from '@/components/features/ProjectWindowBanner';
import AccessibilityWidgetOff from '@/components/providers/AccessibilityWidgetOff';

// The shell's copy of a sidebar row: everything but the timestamps (see `ShellItemRow`).
function toShellItem(row: WorkspaceItemRow): ShellItemRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    icon: row.icon,
    iconColor: row.iconColor,
    databaseId: row.databaseId,
  };
}

// Layout for the authenticated in-app routes (app / db / page / admin). Lives in the
// (app) route group so it is NOT shared with public routes (share, marketing, auth) —
// that boundary makes the app shell mount/unmount when crossing between a public share
// page and the app, instead of being preserved by App Router across the navigation.
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Project windows (workspace-locked sessions) render this shell too; everything it
  // loads below confines itself to that one workspace.
  const session = await getSessionAllowingWorkspaceLock();
  if (!session?.user) redirect('/login');

  const t = await getTranslations('Layout');

  // When this render reads the database, by the server's clock — taken before the
  // reads, so it never claims more than they saw. Live refresh compares it with the
  // change version to tell whether a write in the same second may be missing from
  // what the user sees (see `mayPredateRender`). `router.refresh()` re-renders this
  // layout, so every refresh brings a new value.
  // eslint-disable-next-line react-hooks/purity -- a per-request server timestamp, by design
  const renderedAt = Date.now();

  const workspacesRead = getWorkspaces();
  const [workspacesList, items, cookieStore, presence] = await Promise.all([
    workspacesRead,
    getAllWorkspaceItems().then((rows) => rows.map(toShellItem)),
    cookies(),
    // Agent presence (V2 R8.8) over the same workspaces the sidebar lists — a project
    // window's one, otherwise the memberships (never an admin's view of everything).
    // It rides on this render, so every live-refresh brings it along at no extra
    // request; a failure only leaves the presence out.
    workspacesRead
      .then((list) => loadAgentPresence(list.map((w) => w.id), renderedAt))
      .catch(() => ({ ...EMPTY_PRESENCE, at: renderedAt })),
  ]);

  // The one source of truth for "this is a project window" — the session's lock claim.
  // Never guessed client-side (user agent, window size): the lock is what actually
  // decides which of the surfaces below would work at all.
  const isProjectWindow = !!lockClaimsOf(session.user).workspaceLock;

  const activeWorkspaceId = cookieStore.get('remnus_workspace_id')?.value;
  const activeWorkspace = workspacesList.find((w) => w.id === activeWorkspaceId) || workspacesList[0];
  const sidebarDensity = (cookieStore.get('remnus_sidebar_density')?.value ?? 'comfortable') as 'compact' | 'comfortable';
  // The What's New badge, counted here so the client loads the changelog only when the
  // list is opened (V2 R9). The cookie is written by the client when the list is read.
  const seenCookie = cookieStore.get(CHANGELOG_SEEN_COOKIE)?.value;
  let seenId: string | null = null;
  try { seenId = seenCookie ? decodeURIComponent(seenCookie) : null; } catch { /* a malformed cookie counts as none */ }
  const whatsNewUnseen = countUnseenEntries(seenId);

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };

  const demoBanner = session.user.role === 'demo' ? (
    // Sits on the desk above the sheet (desktop); a strip over the content on mobile.
    <div key="demo-banner" className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 px-4 py-2 lg:h-11 lg:py-0 lg:pl-4 lg:pr-2 border-b border-line lg:border-0 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
        <span className="font-semibold text-fg shrink-0">{t('demoMode')}</span>
        <span className="text-fg-3 truncate">{t('demoChangesNote')}</span>
      </div>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button
          type="submit"
          className="shrink-0 inline-flex h-7 items-center rounded-control bg-ink px-3 font-semibold text-ink-fg transition-colors hover:bg-ink/90 self-start sm:self-auto"
        >
          {t('createFreeAccount')}
        </button>
      </form>
    </div>
  ) : undefined;

  // Says why account settings, billing and other workspaces are unavailable here,
  // and how to reach the full account from a browser that isn't this isolated profile.
  const projectWindowBanner = isProjectWindow ? (
    <ProjectWindowBanner key="project-window-banner" workspaceName={activeWorkspace?.name ?? ''} />
  ) : undefined;

  return (
    <ClientMessages scope="app">
      <ActivityTracker isProjectWindow={isProjectWindow} renderedAt={renderedAt} />
      <LastPathTracker ownerTag={lastPathOwnerTag(session.user.id)} />
      <AccessibilityWidgetOff />
      {session.user.role === 'demo' && <DemoFeedbackPrompt />}
      {session.user.role !== 'demo' && <PwaInstallNudge />}
      <BillingSuccessModal />
      <UpdateBanner />
      <DownloadToast />
      <Toaster />
      <QueryProvider>
        <AppShell
          items={items}
          activeWorkspaceId={activeWorkspace?.id ?? ''}
          isAdmin={session.user.role === 'admin'}
          currentUserId={currentUser.id}
          sidebar={
            <WorkspaceSidebar
              key="workspace-sidebar"
              items={items}
              workspaces={workspacesList}
              activeWorkspace={activeWorkspace ?? { id: '', name: 'Workspace' }}
              currentUser={currentUser}
              density={sidebarDensity}
              showOnboarding
              isProjectWindow={isProjectWindow}
              renderedAt={renderedAt}
              presence={presence}
              whatsNewUnseen={whatsNewUnseen}
            />
          }
          mobileNav={
            <MobileNavWrapper
              key="mobile-nav"
              items={items}
              workspaces={workspacesList}
              activeWorkspace={activeWorkspace ?? { id: '', name: 'Workspace' }}
              currentUser={currentUser}
              isProjectWindow={isProjectWindow}
              presence={presence}
              whatsNewUnseen={whatsNewUnseen}
            />
          }
          demoBanner={demoBanner ?? projectWindowBanner}
        >
          {children}
        </AppShell>
      </QueryProvider>
    </ClientMessages>
  );
}
