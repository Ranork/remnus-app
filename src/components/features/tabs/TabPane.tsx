'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getStandalonePageByItemId, getSubItems } from '@/lib/actions/workspace';
import { getDatabase } from '@/lib/actions/database';
import { getPages, getPage } from '@/lib/actions/page';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import DatabaseView from '@/components/features/DatabaseView';
import PageEditor from '@/components/features/PageEditor';
import StandalonePageEditor from '@/components/features/StandalonePageEditor';
import { MembersProvider } from '@/components/features/MembersContext';
import { tabKeys } from './keys';

/**
 * Renders the content for a single keep-alive tab, given only its href — the
 * client-side equivalent of the (app) content route pages. Used ONLY in the
 * Tauri tab host (`TabHost`); the web build keeps the normal server-rendered
 * route. Data is fetched via the existing server actions through TanStack Query
 * so a suspended-then-reopened pane refetches fresh, while a kept-alive pane
 * (just hidden) never re-runs and preserves all of its in-memory UI state.
 *
 * `href` is normalized: `/page/<id>` · `/db/<id>` · `/db/<id>/<pageId>`.
 */
export default function TabPane({ href, isAdmin }: { href: string; isAdmin: boolean }) {
  const parts = href.split('?')[0].split('#')[0].split('/').filter(Boolean);

  // Key by id so an in-place navigation within the SAME tab (e.g. /db/x → /db/z)
  // remounts the editor with fresh state — matching the original route-remount
  // behavior. Switching tabs renders a different pane, so keep-alive is unaffected.
  if (parts[0] === 'page' && parts[1]) {
    return <StandalonePagePane key={`page:${parts[1]}`} itemId={parts[1]} isAdmin={isAdmin} />;
  }
  if (parts[0] === 'db' && parts[1] && parts[2]) {
    return <DatabaseRowPane key={`row:${parts[1]}:${parts[2]}`} dbId={parts[1]} pageId={parts[2]} isAdmin={isAdmin} />;
  }
  if (parts[0] === 'db' && parts[1]) {
    return <DatabasePane key={`db:${parts[1]}`} dbId={parts[1]} />;
  }
  return <PaneFallback />;
}

function PaneSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-850">
      <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
    </div>
  );
}

function PaneFallback() {
  const t = useTranslations('Errors');
  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-850 text-sm text-neutral-500">
      {t('crashTitle')}
    </div>
  );
}

// ── /page/<itemId> ───────────────────────────────────────────────────────────
function StandalonePagePane({ itemId, isAdmin }: { itemId: string; isAdmin: boolean }) {
  const pageQ = useQuery({
    queryKey: tabKeys.standalone(itemId),
    queryFn: () => getStandalonePageByItemId(itemId),
  });
  const subItemsQ = useQuery({
    queryKey: tabKeys.subItems(itemId),
    queryFn: () => getSubItems(itemId),
  });

  if (pageQ.isLoading || subItemsQ.isLoading) return <PaneSpinner />;
  if (pageQ.isError || !pageQ.data || !pageQ.data.page) return <PaneFallback />;

  return (
    <div className="flex-1 overflow-auto bg-neutral-850">
      <StandalonePageEditor
        item={pageQ.data.item}
        page={pageQ.data.page}
        subItems={subItemsQ.data ?? []}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ── /db/<id> ─────────────────────────────────────────────────────────────────
function DatabasePane({ dbId }: { dbId: string }) {
  const dbQ = useQuery({
    queryKey: tabKeys.database(dbId),
    queryFn: () => getDatabase(dbId),
  });
  const pagesQ = useQuery({
    queryKey: tabKeys.pages(dbId),
    queryFn: () => getPages(dbId),
  });
  const workspaceId = dbQ.data?.workspaceId;
  const membersQ = useQuery({
    queryKey: tabKeys.members(workspaceId ?? ''),
    queryFn: () => getWorkspaceMembers(workspaceId as string),
    enabled: !!workspaceId,
  });

  if (dbQ.isLoading || pagesQ.isLoading) return <PaneSpinner />;
  if (dbQ.isError || !dbQ.data) return <PaneFallback />;

  return (
    <div className="flex-1 overflow-hidden bg-neutral-850 flex flex-col">
      <DatabaseView database={dbQ.data} initialPages={pagesQ.data ?? []} members={membersQ.data ?? []} />
    </div>
  );
}

// ── /db/<id>/<pageId> ────────────────────────────────────────────────────────
function DatabaseRowPane({ dbId, pageId, isAdmin }: { dbId: string; pageId: string; isAdmin: boolean }) {
  const dbQ = useQuery({
    queryKey: tabKeys.database(dbId),
    queryFn: () => getDatabase(dbId),
  });
  const pageQ = useQuery({
    queryKey: tabKeys.dbPage(pageId),
    queryFn: () => getPage(pageId),
  });
  const subItemsQ = useQuery({
    queryKey: tabKeys.subItems(pageId),
    queryFn: () => getSubItems(pageId),
  });
  const workspaceId = dbQ.data?.workspaceId;
  const membersQ = useQuery({
    queryKey: tabKeys.members(workspaceId ?? ''),
    queryFn: () => getWorkspaceMembers(workspaceId as string),
    enabled: !!workspaceId,
  });

  if (dbQ.isLoading || pageQ.isLoading || subItemsQ.isLoading) return <PaneSpinner />;
  if (dbQ.isError || pageQ.isError || !dbQ.data || !pageQ.data) return <PaneFallback />;

  return (
    <div className="flex-1 overflow-auto bg-neutral-850">
      <MembersProvider members={membersQ.data ?? []}>
        <PageEditor database={dbQ.data} initialPage={pageQ.data} subItems={subItemsQ.data ?? []} isAdmin={isAdmin} />
      </MembersProvider>
    </div>
  );
}
