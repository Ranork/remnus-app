import { getPage } from '@/lib/actions/page';
import { getDatabase } from '@/lib/actions/database';
import { getSubItems } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import { getCurrentUser } from '@/lib/auth/session';
import PageEditor from '@/components/features/PageEditor';
import { MembersProvider } from '@/components/features/MembersContext';
import NotFoundRedirect from '@/components/features/NotFoundRedirect';

export default async function PageDetail(props: { params: Promise<{ id: string, pageId: string }> }) {
  const params = await props.params;
  const [db, page, subItems, user] = await Promise.all([
    getDatabase(params.id),
    getPage(params.pageId),
    getSubItems(params.pageId),
    getCurrentUser(),
  ]);

  if (!db || !page) return <NotFoundRedirect />;

  const members = db.workspaceId ? await getWorkspaceMembers(db.workspaceId) : [];

  return (
    <div className="flex-1 overflow-auto bg-neutral-850">
      <MembersProvider members={members}>
        <PageEditor database={db} initialPage={page} subItems={subItems} isAdmin={user.role === 'admin'} />
      </MembersProvider>
    </div>
  );
}
