'use server';

import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getContextPolicy,
  getKnowledgeItem,
  reviewKnowledgeItem,
  saveKnowledgeMetadata,
  setContextPolicy,
  type ContextPolicy,
  type KnowledgeMetadataInput,
} from '@/lib/services/knowledge';

async function requireWorkspaceRole(workspaceId: string, write = false, ownerOnly = false) {
  const user = await getCurrentUser();
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  const t = await getTranslations('Errors');
  if (!member && user.role !== 'admin') throw new Error(t('unauthorized'));
  if (user.role !== 'admin' && write && member?.role === 'viewer') throw new Error(t('unauthorized'));
  if (user.role !== 'admin' && ownerOnly && member?.role !== 'owner') throw new Error(t('unauthorized'));
  return user;
}

export async function getPageKnowledge(workspaceId: string, itemId: string) {
  await requireWorkspaceRole(workspaceId);
  return getKnowledgeItem(workspaceId, itemId);
}

export async function updatePageKnowledge(workspaceId: string, itemId: string, input: KnowledgeMetadataInput) {
  const user = await requireWorkspaceRole(workspaceId, true);
  return saveKnowledgeMetadata(workspaceId, itemId, input, user.id);
}

export async function markPageKnowledgeReviewed(workspaceId: string, itemId: string) {
  const user = await requireWorkspaceRole(workspaceId, true);
  return reviewKnowledgeItem(workspaceId, itemId, user.id);
}

export async function getWorkspaceContextPolicy(workspaceId: string) {
  await requireWorkspaceRole(workspaceId);
  return getContextPolicy(workspaceId);
}

export async function updateWorkspaceContextPolicy(workspaceId: string, policy: ContextPolicy) {
  await requireWorkspaceRole(workspaceId, true, true);
  return setContextPolicy(workspaceId, policy);
}
