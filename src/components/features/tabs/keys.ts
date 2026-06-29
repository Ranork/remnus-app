import type { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query keys for the keep-alive tab panes (`TabPane`). Shared so that
 * `useTabNav().refresh()` can invalidate exactly the active pane's data without
 * touching the other (kept-alive) panes' in-memory state.
 */
export const tabKeys = {
  standalone: (itemId: string) => ['tab', 'standalone', itemId] as const,
  subItems: (id: string) => ['tab', 'subItems', id] as const,
  database: (id: string) => ['tab', 'database', id] as const,
  pages: (id: string) => ['tab', 'pages', id] as const,
  dbPage: (pageId: string) => ['tab', 'dbPage', pageId] as const,
  members: (workspaceId: string) => ['tab', 'members', workspaceId] as const,
};

/** Invalidate only the queries backing the pane for `href` (a refresh). */
export function invalidateTabHref(qc: QueryClient, href: string): void {
  const parts = href.split('?')[0].split('#')[0].split('/').filter(Boolean);
  if (parts[0] === 'page' && parts[1]) {
    qc.invalidateQueries({ queryKey: tabKeys.standalone(parts[1]) });
    qc.invalidateQueries({ queryKey: tabKeys.subItems(parts[1]) });
  } else if (parts[0] === 'db' && parts[1] && parts[2]) {
    qc.invalidateQueries({ queryKey: tabKeys.database(parts[1]) });
    qc.invalidateQueries({ queryKey: tabKeys.dbPage(parts[2]) });
    qc.invalidateQueries({ queryKey: tabKeys.subItems(parts[2]) });
  } else if (parts[0] === 'db' && parts[1]) {
    qc.invalidateQueries({ queryKey: tabKeys.database(parts[1]) });
    qc.invalidateQueries({ queryKey: tabKeys.pages(parts[1]) });
  }
}
