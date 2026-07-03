'use server';
import { db } from '@/db';
import { agentTokens, workspaceMembers, workspaces, agentActivity, oauthAccessTokens, oauthClients } from '@/db/schema';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { checkCanAddAgent } from '@/lib/services/billing';
import { captureServer, isCaptureAllowedFromRequest } from '@/lib/analytics/server';
import { maybeSendAgentConnectedEmail } from '@/lib/email/lifecycle';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const TOKEN_PREFIX = process.env.MCP_TOKEN_PREFIX ?? 'rmns';

async function assertOwnerAccess(workspaceId: string): Promise<string> {
  const user = await getCurrentUser();

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  const t = await getTranslations('Errors');
  if (!member) throw new Error(t('unauthorized'));
  // Admins get owner-level access for token management too
  if (member.role !== 'owner' && user.role !== 'admin') throw new Error(t('unauthorized'));
  return user.id;
}

export async function mintAgentToken(
  workspaceId: string,
  name: string,
  scope: 'read' | 'write',
  agentName?: string,
  expiresInDays?: number | null,
): Promise<{ token: string }> {
  const userId = await assertOwnerAccess(workspaceId);

  // Agent limit — the billing owner's plan caps connected agents (PAT + OAuth).
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const code = await checkCanAddAgent(workspaceId);
    if (code) {
      // Funnel: a PAT mint was blocked by a plan limit — same "why can't they add
      // an agent" signal as the OAuth agent_limit_reached path. Capture the exact code.
      await captureServer({
        event: 'mcp_token_mint_blocked',
        userId,
        allowed: await isCaptureAllowedFromRequest(),
        role: user.role,
        properties: { reason: code, type: 'pat', scope, workspaceId },
      }).catch(() => {});
      const t = await getTranslations('Errors');
      throw new Error(t(code));
    }
  }

  const prefix8 = randomBytes(4).toString('hex'); // 8 hex chars
  const secret = randomBytes(32).toString('hex');  // 64 hex chars
  const fullToken = `${TOKEN_PREFIX}_${prefix8}_${secret}`;
  const hash = await bcrypt.hash(secret, 12);

  const expiresAt =
    expiresInDays != null
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await db.insert(agentTokens).values({
    workspaceId,
    name,
    agentName: agentName || null,
    tokenPrefix: prefix8,
    tokenHash: hash,
    scope,
    createdBy: userId,
    createdAt: new Date(),
    expiresAt,
  });

  // Funnel: 'mcp_token_created' (second activation step).
  try {
    const u = await getCurrentUser();
    await captureServer({
      event: 'mcp_token_created',
      userId,
      allowed: await isCaptureAllowedFromRequest(),
      role: u.role,
      properties: { type: 'pat', scope, agentName: agentName ?? null, workspaceId },
    });
  } catch {
    // best-effort
  }

  // First-agent celebration email (once per user, ever). No-throw.
  await maybeSendAgentConnectedEmail(userId);

  return { token: fullToken };
}

export async function getAgentTokens(workspaceId: string) {
  await assertOwnerAccess(workspaceId);

  return db
    .select({
      id: agentTokens.id,
      name: agentTokens.name,
      agentName: agentTokens.agentName,
      tokenPrefix: agentTokens.tokenPrefix,
      scope: agentTokens.scope,
      createdAt: agentTokens.createdAt,
      expiresAt: agentTokens.expiresAt,
      lastUsedAt: agentTokens.lastUsedAt,
      revokedAt: agentTokens.revokedAt,
    })
    .from(agentTokens)
    .where(eq(agentTokens.workspaceId, workspaceId))
    .orderBy(agentTokens.createdAt);
}

/** Total active agent connections for the user: PAT tokens + OAuth tokens (both non-revoked). */
export async function getUserAgentTokenCount(): Promise<number> {
  const user = await getCurrentUser();

  const [patRows, oauthRows] = await Promise.all([
    db
      .select({ id: agentTokens.id })
      .from(agentTokens)
      .innerJoin(workspaceMembers, and(
        eq(workspaceMembers.workspaceId, agentTokens.workspaceId),
        eq(workspaceMembers.userId, user.id),
      ))
      .where(isNull(agentTokens.revokedAt)),
    db
      .select({ id: oauthAccessTokens.id })
      .from(oauthAccessTokens)
      .where(and(
        eq(oauthAccessTokens.userId, user.id),
        isNull(oauthAccessTokens.revokedAt),
      )),
  ]);

  return patRows.length + oauthRows.length;
}

export async function getUserWorkspacesWithTokens() {
  const user = await getCurrentUser();

  const wsList = await db
    .select({
      id:         workspaces.id,
      name:       workspaces.name,
      icon:       workspaces.icon,
      iconColor:  workspaces.iconColor,
      memberRole: workspaceMembers.role,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
    ))
    .orderBy(workspaces.name);

  if (wsList.length === 0) return [];

  const wsIds = wsList.map(w => w.id);

  const tokenList = await db
    .select({
      id:          agentTokens.id,
      name:        agentTokens.name,
      agentName:   agentTokens.agentName,
      tokenPrefix: agentTokens.tokenPrefix,
      scope:       agentTokens.scope,
      createdAt:   agentTokens.createdAt,
      expiresAt:   agentTokens.expiresAt,
      lastUsedAt:  agentTokens.lastUsedAt,
      workspaceId: agentTokens.workspaceId,
    })
    .from(agentTokens)
    .where(and(inArray(agentTokens.workspaceId, wsIds), isNull(agentTokens.revokedAt)))
    .orderBy(desc(agentTokens.createdAt));

  return wsList.map(ws => ({
    id:        ws.id,
    name:      ws.name,
    icon:      ws.icon,
    iconColor: ws.iconColor,
    canManage: ws.memberRole === 'owner' || user.role === 'admin',
    tokens: tokenList
      .filter(t => t.workspaceId === ws.id)
      .map(t => ({ ...t, canRevoke: ws.memberRole === 'owner' || user.role === 'admin' })),
  }));
}

export async function getUserAgentTokens() {
  const user = await getCurrentUser();

  const rows = await db
    .select({
      id:               agentTokens.id,
      name:             agentTokens.name,
      agentName:        agentTokens.agentName,
      tokenPrefix:      agentTokens.tokenPrefix,
      scope:            agentTokens.scope,
      createdAt:        agentTokens.createdAt,
      expiresAt:        agentTokens.expiresAt,
      lastUsedAt:       agentTokens.lastUsedAt,
      workspaceId:      workspaces.id,
      workspaceName:    workspaces.name,
      workspaceIcon:    workspaces.icon,
      workspaceIconColor: workspaces.iconColor,
      memberRole:       workspaceMembers.role,
    })
    .from(agentTokens)
    .innerJoin(workspaces, eq(agentTokens.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
    ))
    .where(isNull(agentTokens.revokedAt))
    .orderBy(desc(agentTokens.createdAt));

  return rows.map(row => ({
    ...row,
    canRevoke: row.memberRole === 'owner' || user.role === 'admin',
  }));
}

export async function getUserAgentActivity(count = 60) {
  const user = await getCurrentUser();

  return db
    .select({
      id:            agentActivity.id,
      tool:          agentActivity.tool,
      status:        agentActivity.status,
      createdAt:     agentActivity.createdAt,
      workspaceName: workspaces.name,
      tokenName:     agentTokens.name,
      agentName:     agentTokens.agentName,
    })
    .from(agentActivity)
    .innerJoin(agentTokens, eq(agentActivity.tokenId, agentTokens.id))
    .innerJoin(workspaces, eq(agentActivity.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
    ))
    .orderBy(desc(agentActivity.createdAt))
    .limit(count);
}

export async function updateAgentToken(
  tokenId: string,
  updates: {
    name: string;
    scope: 'read' | 'write';
    agentName: string | null;
    expiresInDays: number | null | undefined; // undefined = keep current
  },
): Promise<void> {
  const [token] = await db
    .select({ workspaceId: agentTokens.workspaceId })
    .from(agentTokens)
    .where(and(eq(agentTokens.id, tokenId), isNull(agentTokens.revokedAt)))
    .limit(1);

  const t = await getTranslations('Errors');
  if (!token) throw new Error(t('notFound'));

  await assertOwnerAccess(token.workspaceId);

  const patch: Partial<typeof agentTokens.$inferInsert> = {
    name: updates.name.trim(),
    scope: updates.scope,
    agentName: updates.agentName,
  };

  if (updates.expiresInDays !== undefined) {
    patch.expiresAt =
      updates.expiresInDays != null
        ? new Date(Date.now() + updates.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
  }

  await db.update(agentTokens).set(patch).where(eq(agentTokens.id, tokenId));
}

export async function getUserOAuthTokens() {
  const user = await getCurrentUser();

  const rows = await db
    .select({
      id:             oauthAccessTokens.id,
      clientId:       oauthAccessTokens.clientId,
      workspaceId:    oauthAccessTokens.workspaceId,
      scope:          oauthAccessTokens.scope,
      expiresAt:      oauthAccessTokens.expiresAt,
      createdAt:      oauthAccessTokens.createdAt,
      revokedAt:      oauthAccessTokens.revokedAt,
      agentName:      oauthAccessTokens.agentName,
      displayName:    oauthAccessTokens.displayName,
      workspaceName:  workspaces.name,
      workspaceIcon:  workspaces.icon,
      memberRole:     workspaceMembers.role,
      clientName:     oauthClients.clientName,
    })
    .from(oauthAccessTokens)
    .innerJoin(workspaces, eq(oauthAccessTokens.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
    ))
    .leftJoin(oauthClients, eq(oauthAccessTokens.clientId, oauthClients.clientId))
    .where(and(
      eq(oauthAccessTokens.userId, user.id),
      isNull(oauthAccessTokens.revokedAt),
    ))
    .orderBy(desc(oauthAccessTokens.createdAt));

  return rows.map(row => ({
    ...row,
    canRevoke: row.memberRole === 'owner' || true, // owners can revoke; OAuth tokens are always user-owned
  }));
}

/** Set the canonical agent id (AGENT_MARKS id) override on an OAuth token — for brand-icon display. User-owned. */
export async function setOAuthTokenAgent(tokenId: string, agentName: string | null): Promise<void> {
  const user = await getCurrentUser();
  const t = await getTranslations('Errors');

  const [token] = await db
    .select({ userId: oauthAccessTokens.userId })
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.id, tokenId), isNull(oauthAccessTokens.revokedAt)))
    .limit(1);

  if (!token) throw new Error(t('notFound'));
  if (token.userId !== user.id && user.role !== 'admin') throw new Error(t('unauthorized'));

  await db
    .update(oauthAccessTokens)
    .set({ agentName })
    .where(eq(oauthAccessTokens.id, tokenId));
}

/** Set the canonical agent id (AGENT_MARKS id) on a PAT token — for brand-icon display. Owner/admin only. */
export async function setAgentTokenAgent(tokenId: string, agentName: string | null): Promise<void> {
  const [token] = await db
    .select({ workspaceId: agentTokens.workspaceId })
    .from(agentTokens)
    .where(and(eq(agentTokens.id, tokenId), isNull(agentTokens.revokedAt)))
    .limit(1);

  const t = await getTranslations('Errors');
  if (!token) throw new Error(t('notFound'));

  await assertOwnerAccess(token.workspaceId);

  await db
    .update(agentTokens)
    .set({ agentName })
    .where(eq(agentTokens.id, tokenId));
}

export async function revokeOAuthToken(tokenId: string): Promise<void> {
  const user = await getCurrentUser();
  const t = await getTranslations('Errors');

  const [token] = await db
    .select({ userId: oauthAccessTokens.userId })
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.id, tokenId), isNull(oauthAccessTokens.revokedAt)))
    .limit(1);

  if (!token) throw new Error(t('notFound'));
  if (token.userId !== user.id && user.role !== 'admin') throw new Error(t('unauthorized'));

  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthAccessTokens.id, tokenId));
}

export async function revokeAgentToken(tokenId: string): Promise<void> {
  // Resolve workspace from token, then verify ownership
  const [token] = await db
    .select({ workspaceId: agentTokens.workspaceId })
    .from(agentTokens)
    .where(and(eq(agentTokens.id, tokenId), isNull(agentTokens.revokedAt)))
    .limit(1);

  const t = await getTranslations('Errors');
  if (!token) throw new Error(t('notFound'));

  await assertOwnerAccess(token.workspaceId);

  await db
    .update(agentTokens)
    .set({ revokedAt: new Date() })
    .where(eq(agentTokens.id, tokenId));
}
