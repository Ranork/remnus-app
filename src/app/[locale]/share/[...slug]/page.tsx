import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getShareBySlug } from '@/lib/actions/sharing';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';
import {
  getShareMapForWorkspace,
  checkUserHasWorkspaceAccess,
} from '@/lib/server/sharing-internals';
import { getAnyPageById } from '@/lib/services/workspace';
import { db } from '@/db';
import { workspaceItems, databases, pages } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import SharedPageView from '@/components/share/SharedPageView';

export type SharedNavItem = {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  iconColor: string | null;
  children: SharedNavItem[];
};

interface Props {
  params: Promise<{ slug: string[] }>;
}

async function buildSharedNavTree(
  shareMap: Record<string, string>,
  workspaceId: string,
): Promise<SharedNavItem[]> {
  const ids = Object.keys(shareMap);
  if (ids.length < 2) return []; // nothing useful to navigate

  const rows = await db
    .select({
      id: workspaceItems.id,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      sortOrder: workspaceItems.sortOrder,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
    })
    .from(workspaceItems)
    .where(inArray(workspaceItems.id, ids));

  // Build node map
  const nodeMap = new Map<string, SharedNavItem & { sortOrder: number; parentId: string | null }>();
  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      title: row.title,
      slug: shareMap[row.id],
      icon: row.icon,
      iconColor: row.iconColor,
      sortOrder: row.sortOrder,
      parentId: row.parentId,
      children: [],
    });
  }

  // Wire children (only connect to shared parents)
  const roots: SharedNavItem[] = [];
  for (const node of nodeMap.values()) {
    const parent = node.parentId ? nodeMap.get(node.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder at every level
  const sortChildren = (items: SharedNavItem[]) => {
    items.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    items.forEach(i => sortChildren(i.children));
  };
  sortChildren(roots);

  return roots;
}

async function resolveShare(slugParts: string[]) {
  const slug = slugParts.join('/');
  const share = await getShareBySlug(slug);
  if (!share) return null;
  try {
    const page = await getAnyPageById(share.workspaceId, share.pageId);
    // Dashboards are not publishable in v1 (AGENTS.md -> Dashboards). The UI
    // doesn't offer it, but a row written directly — or left behind by a later
    // change — must not serve a public page whose body is the raw JSON spec.
    if (page.type === 'dashboard') return null;
    return { share, page };
  } catch {
    return null;
  }
}

// Determine the in-app route for a shared page so workspace members can be redirected
async function getNormalRoute(pageId: string): Promise<string> {
  // Check workspace_items first
  const [item] = await db
    .select({ type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, pageId))
    .limit(1);

  if (item) {
    if (item.type === 'page') return `/page/${pageId}`;
    // Dashboards are not publishable in v1 (see AGENTS.md -> Dashboards), so a
    // shared tree never contains one; if a row somehow points at one, the
    // in-app route is still the honest destination.
    if (item.type === 'dashboard') return `/dashboard/${pageId}`;
    // database: need the databases.id (not the workspace item id) for the /db/ route
    const [dbRow] = await db
      .select({ id: databases.id })
      .from(databases)
      .where(eq(databases.itemId, pageId))
      .limit(1);
    return dbRow ? `/db/${dbRow.id}` : `/app`;
  }

  // Fallback: it's a pages (db row) — find its databaseId
  const [page] = await db
    .select({ databaseId: pages.databaseId })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  return page ? `/db/${page.databaseId}/${pageId}` : `/app`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await resolveShare(slug);
  if (!result) return { title: 'Not Found' };
  const { page } = result;
  const title = page.title || 'Untitled';
  const description = (page.content || '').replace(/[#*`\[\]]/g, '').slice(0, 160) || undefined;
  return {
    metadataBase: new URL(METADATA_BASE_URL),
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function SharedPageRoute({ params }: Props) {
  const { slug } = await params;
  const result = await resolveShare(slug);
  if (!result) notFound();

  const { share, page } = result;
  const session = await auth();
  const t = await getTranslations('Sharing');

  // Workspace members get redirected to the real page instead of the shared view
  if (session?.user?.id) {
    const isAdmin = (session.user as any).role === 'admin';
    const hasMembership = isAdmin || await checkUserHasWorkspaceAccess(session.user.id, share.workspaceId);
    if (hasMembership) {
      const normalRoute = await getNormalRoute(share.pageId);
      redirect(normalRoute);
    }
  }

  const canEdit = share.permission === 'write' && !!session?.user;

  // Fetch share map + parent info in parallel
  const [shareMap, parentItem] = await Promise.all([
    getShareMapForWorkspace(share.workspaceId),
    db
      .select({ parentId: workspaceItems.parentId, title: workspaceItems.title })
      .from(workspaceItems)
      .where(eq(workspaceItems.id, share.pageId))
      .limit(1)
      .then(r => r[0] ?? null),
  ]);

  // If this page has a parent that is also shared, expose it for the back button
  const parentSlug = parentItem?.parentId ? shareMap[parentItem.parentId] : undefined;

  // Build the shared nav tree (empty when fewer than 2 shared pages)
  const navTree = await buildSharedNavTree(shareMap, share.workspaceId);

  return (
    <SharedPageView
      page={page}
      share={share}
      canEdit={canEdit}
      isLoggedIn={!!session?.user}
      shareMap={shareMap}
      parentSlug={parentSlug}
      navTree={navTree}
      notFoundLabel={t('notFound')}
      readOnlyBadge={t('readOnlyBadge')}
      writeBadge={t('writeBadge')}
      saveErrorLabel={t('saveError')}
      savingLabel={t('saving')}
    />
  );
}
