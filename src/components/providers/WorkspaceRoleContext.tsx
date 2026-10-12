'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

type WorkspaceRoles = { roles: Record<string, string>; isAdmin: boolean };

const WorkspaceRoleContext = createContext<WorkspaceRoles | null>(null);

/**
 * The signed-in person's role in each of their workspaces, read with the workspace list the
 * app layout already loads (no request of its own). Lets any component ask whether it may
 * offer editing — a viewer gets the read-only UI. The server checks the same rule on every
 * write (`lib/auth/workspaceRole.ts`); this only keeps the UI from offering what would fail.
 */
export function WorkspaceRoleProvider({
  roles,
  isAdmin,
  children,
}: WorkspaceRoles & { children: ReactNode }) {
  const value = useMemo(() => ({ roles, isAdmin }), [roles, isAdmin]);
  return <WorkspaceRoleContext.Provider value={value}>{children}</WorkspaceRoleContext.Provider>;
}

/**
 * Whether the signed-in person may change content in `workspaceId`. True when it cannot
 * tell — outside the app shell (a public share has its own rule), or for an id not in the
 * list — because the server decides anyway. A platform admin may edit everywhere.
 */
export function useCanEdit(workspaceId: string | null | undefined): boolean {
  const ctx = useContext(WorkspaceRoleContext);
  if (!ctx || !workspaceId || ctx.isAdmin) return true;
  return ctx.roles[workspaceId] !== 'viewer';
}
