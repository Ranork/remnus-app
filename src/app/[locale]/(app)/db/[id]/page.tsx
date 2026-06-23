import { getDatabase } from '@/lib/actions/database';
import { getPages } from '@/lib/actions/page';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import DatabaseView from '@/components/features/DatabaseView';
import NotFoundRedirect from '@/components/features/NotFoundRedirect';

export default async function DatabasePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [db, pages] = await Promise.all([
    getDatabase(params.id),
    getPages(params.id),
  ]);

  if (!db) return <NotFoundRedirect />;

  const members = db.workspaceId ? await getWorkspaceMembers(db.workspaceId) : [];

  return (
    <div className="flex-1 overflow-hidden bg-neutral-850 flex flex-col">
      <DatabaseView database={db} initialPages={pages} members={members} />
    </div>
  );
}
