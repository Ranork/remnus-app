import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signOut } from '@/auth';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { getTranslations } from 'next-intl/server';
import { getAllWorkspaceItems, getWorkspaces } from '@/lib/actions/workspace';
import WorkspaceSidebar from '@/components/features/WorkspaceSidebar';
import MobileNavWrapper from '@/components/features/MobileNavWrapper';
import QueryProvider from '@/components/providers/QueryProvider';
import AppShell from '@/components/AppShell';
import ActivityTracker from '@/components/providers/ActivityTracker';
import LastPathTracker from '@/components/providers/LastPathTracker';
import { lastPathOwnerTag } from '@/lib/server/lastPath';
import BillingSuccessModal from '@/components/features/BillingSuccessModal';
import UpdateBanner from '@/components/features/UpdateBanner';
import DownloadToast from '@/components/features/DownloadToast';
import DemoFeedbackPrompt from '@/components/features/DemoFeedbackPrompt';
import PwaInstallNudge from '@/components/features/PwaInstallNudge';
import ProjectWindowBanner from '@/components/features/ProjectWindowBanner';

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

  const [workspacesList, items, cookieStore] = await Promise.all([
    getWorkspaces(),
    getAllWorkspaceItems(),
    cookies(),
  ]);

  // The one source of truth for "this is a project window" — the session's lock claim.
  // Never guessed client-side (user agent, window size): the lock is what actually
  // decides which of the surfaces below would work at all.
  const isProjectWindow = !!lockClaimsOf(session.user).workspaceLock;

  const activeWorkspaceId = cookieStore.get('remnus_workspace_id')?.value;
  const activeWorkspace = workspacesList.find((w) => w.id === activeWorkspaceId) || workspacesList[0];
  const sidebarDensity = (cookieStore.get('remnus_sidebar_density')?.value ?? 'comfortable') as 'compact' | 'comfortable';

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };

  const demoBanner = session.user.role === 'demo' ? (
    <div key="demo-banner" className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
      <div className="flex items-center gap-1.5 text-xs text-amber-400 min-w-0">
        <span className="font-semibold shrink-0">{t('demoMode')}</span>
        <span className="text-amber-500/70 shrink-0">—</span>
        <span className="text-amber-400/80 truncate">{t('demoChangesNote')}</span>
      </div>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button
          type="submit"
          className="shrink-0 text-xs font-medium text-amber-300 hover:text-amber-100 transition-colors self-start sm:self-auto"
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
    <>
      <ActivityTracker isProjectWindow={isProjectWindow} />
      <LastPathTracker ownerTag={lastPathOwnerTag(session.user.id)} />
      {session.user.role === 'demo' && <DemoFeedbackPrompt />}
      {session.user.role !== 'demo' && <PwaInstallNudge />}
      <BillingSuccessModal />
      <UpdateBanner />
      <DownloadToast />
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
            />
          }
          demoBanner={demoBanner ?? projectWindowBanner}
        >
          {children}
        </AppShell>
      </QueryProvider>
    </>
  );
}
