'use server';
import { db } from '@/db';
import { agentTokens, workspaceMembers } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
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
): Promise<{ token: string }> {
  const userId = await assertOwnerAccess(workspaceId);

  const prefix8 = randomBytes(4).toString('hex'); // 8 hex chars
  const secret = randomBytes(32).toString('hex');  // 64 hex chars
  const fullToken = `${TOKEN_PREFIX}_${prefix8}_${secret}`;
  const hash = await bcrypt.hash(secret, 12);

  await db.insert(agentTokens).values({
    workspaceId,
    name,
    tokenPrefix: prefix8,
    tokenHash: hash,
    scope,
    createdBy: userId,
    createdAt: new Date(),
  });

  return { token: fullToken };
}

export async function getAgentTokens(workspaceId: string) {
  await assertOwnerAccess(workspaceId);

  return db
    .select({
      id: agentTokens.id,
      name: agentTokens.name,
      tokenPrefix: agentTokens.tokenPrefix,
      scope: agentTokens.scope,
      createdAt: agentTokens.createdAt,
      lastUsedAt: agentTokens.lastUsedAt,
      revokedAt: agentTokens.revokedAt,
    })
    .from(agentTokens)
    .where(eq(agentTokens.workspaceId, workspaceId))
    .orderBy(agentTokens.createdAt);
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
