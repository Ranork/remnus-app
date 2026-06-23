import { auth } from '@/auth';
import { getActiveWorkspaceId, getAllWorkspaceItems, type WorkspaceItemRow } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { LAST_PATH_COOKIE } from '@/lib/constants/cookies';

// Validate a remembered path still points at an item the user can open, so a
// deleted/inaccessible page falls through to the default instead of 404ing.
function resolveLastPath(lastPath: string | undefined, items: WorkspaceItemRow[]): string | null {
  if (!lastPath) return null;

  const pageMatch = lastPath.match(/^\/page\/([^/?#]+)/);
  if (pageMatch) {
    return items.some((i) => i.id === pageMatch[1] && i.type === 'page') ? lastPath : null;
  }

  const dbMatch = lastPath.match(/^\/db\/([^/?#]+)/);
  if (dbMatch) {
    return items.some((i) => i.databaseId === dbMatch[1]) ? lastPath : null;
  }

  return null;
}

export default async function AppRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // A pending invite (set while logged out) takes priority — finish accepting it.
  const pendingInvite = (await cookies()).get('pending_invite')?.value;
  if (pendingInvite) {
    redirect(`/invite/${pendingInvite}`);
  }

  // Preserve the post-checkout flag through the redirect so the success modal can show.
  const sp = await searchParams;
  const suffix = sp?.billing === 'success' ? '?billing=success' : '';

  const [allItems, cookieStore] = await Promise.all([getAllWorkspaceItems(), cookies()]);

  // 1) Resume where the user left off — restore the last visited page if it still exists.
  const restored = resolveLastPath(cookieStore.get(LAST_PATH_COOKIE)?.value, allItems);
  if (restored) {
    redirect(`${restored}${suffix}`);
  }

  // 2) Otherwise open the TOP of the active workspace's hierarchy (first root item),
  //    not merely the oldest item in the flat list.
  const activeWorkspaceId = await getActiveWorkspaceId();

  let hasWorkspace = false;

  if (activeWorkspaceId) {
    hasWorkspace = true;
    const items = allItems.filter((i) => i.workspaceId === activeWorkspaceId);
    const first = items.find((i) => i.parentId === null) ?? items[0];

    if (first) {
      if (first.type === 'database' && first.databaseId) {
        redirect(`/db/${first.databaseId}${suffix}`);
      } else {
        redirect(`/page/${first.id}${suffix}`);
      }
    }
  }

  const t = await getTranslations('Home');

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 h-full">
      <Image
        src="/logo-square-transparent.png"
        alt="Remnus"
        width={52}
        height={52}
        className="opacity-20"
      />
      <h2 className="text-base font-medium text-neutral-300">{t('welcomeTitle')}</h2>
      <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
        {hasWorkspace ? t('emptyWorkspaceHint') : t('noWorkspaceHint')}
      </p>
    </div>
  );
}
