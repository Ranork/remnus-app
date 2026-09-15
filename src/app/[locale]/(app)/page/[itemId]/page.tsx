import { getStandalonePageByItemId, getSubItems } from '@/lib/actions/workspace';
// Opts in to project windows: every data call below confines itself to the window's
// workspace, so the page itself may render for one.
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import StandalonePageEditor from '@/components/features/StandalonePageEditor';
import NotFoundRedirect from '@/components/features/NotFoundRedirect';
import { isTauriRequest } from '@/lib/server/platform';

export default async function StandalonePageRoute(
  props: { params: Promise<{ itemId: string }> }
) {
  // In Tauri the client TabHost renders this content (keep-alive tabs).
  if (await isTauriRequest()) return null;

  const { itemId } = await props.params;
  const [data, subItems, user] = await Promise.all([
    getStandalonePageByItemId(itemId),
    getSubItems(itemId),
    getCurrentUserAllowingWorkspaceLock(),
  ]);
  if (!data || !data.page) return <NotFoundRedirect />;

  return (
    <div className="flex-1 overflow-auto bg-neutral-850">
      <StandalonePageEditor
        item={data.item}
        page={data.page}
        subItems={subItems}
        isAdmin={user.role === 'admin'}
      />
    </div>
  );
}
