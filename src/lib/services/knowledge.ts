/**
 * Cookie-free knowledge/context policy service used by MCP and server actions.
 * OKF is an interchange projection; these tables are the native source of truth.
 */
import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import {
  contextRuns,
  databases,
  knowledgeMetadata,
  knowledgeReviews,
  pages,
  standalonePages,
  workspaceContextPolicies,
  workspaceItems,
} from '@/db/schema';

export type ContextActor = {
  tokenId: string;
  tokenKind: 'pat' | 'oauth';
  workspaceId: string;
  ownerUserId: string | null;
};

export type KnowledgeItemType = 'page' | 'database' | 'database_row';
export type KnowledgeStatus = 'draft' | 'stable' | 'deprecated';
export type ContextMode = 'manual' | 'smart' | 'strict';
export type ContextTrustPolicy = 'any' | 'prefer-human-reviewed' | 'human-reviewed-only';
export type KnowledgeTrust = 'human-reviewed' | 'external-human-asserted' | 'machine-confirmed' | 'unverified';

export interface KnowledgeSource {
  resource: string;
  title?: string;
}

export interface KnowledgeMetadataInput {
  conceptType?: string | null;
  description?: string | null;
  tags?: string[];
  sources?: KnowledgeSource[];
  status?: KnowledgeStatus | null;
  staleAfter?: string | null;
}

export interface KnowledgeCorpusItem {
  id: string;
  itemType: KnowledgeItemType;
  title: string;
  content: string;
  breadcrumb: string[];
  databaseId?: string;
  metadata: {
    id?: string;
    conceptType?: string;
    description?: string;
    tags: string[];
    sources: KnowledgeSource[];
    status?: KnowledgeStatus;
    staleAfter?: string;
    stale: boolean;
    trust: KnowledgeTrust;
    generatedBy?: string;
    reviewedAt?: string;
  };
}

export interface ContextPolicy {
  mode: ContextMode;
  autoMaxTokens: number;
  trustPolicy: ContextTrustPolicy;
}

const DEFAULT_CONTEXT_POLICY: ContextPolicy = {
  mode: 'smart',
  autoMaxTokens: 2_000,
  trustPolicy: 'prefer-human-reviewed',
};

type ResolvedKnowledgeItem = {
  id: string;
  itemType: KnowledgeItemType;
  title: string;
  content: string;
  databaseId?: string;
};

function cleanStrings(values: string[] | undefined, max: number): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))].slice(0, max);
}

function cleanSources(values: KnowledgeSource[] | undefined): KnowledgeSource[] {
  const seen = new Set<string>();
  const sources: KnowledgeSource[] = [];
  for (const value of values ?? []) {
    const resource = value.resource.trim();
    if (!resource || seen.has(resource)) continue;
    seen.add(resource);
    sources.push({ resource, ...(value.title?.trim() ? { title: value.title.trim() } : {}) });
    if (sources.length >= 20) break;
  }
  return sources;
}

export function hashKnowledgeContent(title: string, content: string): string {
  return createHash('sha256').update(`${title.trim()}\0${content.trim()}`, 'utf8').digest('hex');
}

async function resolveKnowledgeItem(workspaceId: string, itemId: string): Promise<ResolvedKnowledgeItem> {
  const [item] = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      workspaceId: workspaceItems.workspaceId,
      pageContent: standalonePages.content,
      databaseId: databases.id,
      databaseSchema: databases.schema,
    })
    .from(workspaceItems)
    .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    return {
      id: item.id,
      itemType: item.type,
      title: item.title,
      content: item.type === 'page'
        ? item.pageContent ?? ''
        : JSON.stringify(item.databaseSchema ?? []),
      ...(item.databaseId ? { databaseId: item.databaseId } : {}),
    };
  }

  const [row] = await db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      databaseId: pages.databaseId,
      workspaceId: workspaceItems.workspaceId,
    })
    .from(pages)
    .innerJoin(databases, eq(databases.id, pages.databaseId))
    .innerJoin(workspaceItems, eq(workspaceItems.id, databases.itemId))
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!row || row.workspaceId !== workspaceId) throw new Error('Not found');
  return {
    id: row.id,
    itemType: 'database_row',
    title: row.title,
    content: row.content ?? '',
    databaseId: row.databaseId,
  };
}

function trustFor(
  row: typeof knowledgeMetadata.$inferSelect | undefined,
  contentHash: string,
  reviews: Array<typeof knowledgeReviews.$inferSelect>,
): { trust: KnowledgeTrust; reviewedAt?: string } {
  const review = reviews.find(candidate => !candidate.revokedAt && candidate.contentHash === contentHash);
  if (review) return { trust: 'human-reviewed', reviewedAt: review.reviewedAt.toISOString() };
  if ((row?.externalVerified ?? []).some(value => value.by.toLowerCase().startsWith('human:'))) {
    return { trust: 'external-human-asserted' };
  }
  if (row?.generatedBy || (row?.externalVerified ?? []).length > 0) return { trust: 'machine-confirmed' };
  return { trust: 'unverified' };
}

function toCorpusMetadata(
  row: typeof knowledgeMetadata.$inferSelect | undefined,
  item: ResolvedKnowledgeItem,
  reviews: Array<typeof knowledgeReviews.$inferSelect>,
  now: Date,
): KnowledgeCorpusItem['metadata'] {
  const trust = trustFor(row, hashKnowledgeContent(item.title, item.content), reviews);
  const staleAt = row?.staleAfter ? new Date(row.staleAfter) : undefined;
  return {
    ...(row?.id ? { id: row.id } : {}),
    ...(row?.conceptType ? { conceptType: row.conceptType } : {}),
    ...(row?.description ? { description: row.description } : {}),
    tags: row?.tags ?? [],
    sources: row?.sources ?? [],
    ...(row?.status ? { status: row.status } : {}),
    ...(row?.staleAfter ? { staleAfter: row.staleAfter } : {}),
    stale: !!staleAt && Number.isFinite(staleAt.getTime()) && staleAt.getTime() < now.getTime(),
    ...trust,
    ...(row?.generatedBy ? { generatedBy: row.generatedBy } : {}),
  };
}

export async function getKnowledgeItem(workspaceId: string, itemId: string): Promise<KnowledgeCorpusItem> {
  const item = await resolveKnowledgeItem(workspaceId, itemId);
  const [metadata] = await db
    .select()
    .from(knowledgeMetadata)
    .where(and(
      eq(knowledgeMetadata.workspaceId, workspaceId),
      eq(knowledgeMetadata.itemId, item.id),
      eq(knowledgeMetadata.itemType, item.itemType),
    ))
    .limit(1);
  const reviews = metadata
    ? await db.select().from(knowledgeReviews).where(eq(knowledgeReviews.metadataId, metadata.id)).orderBy(desc(knowledgeReviews.reviewedAt))
    : [];
  return {
    ...item,
    breadcrumb: [],
    metadata: toCorpusMetadata(metadata, item, reviews, new Date()),
  };
}

export async function saveKnowledgeMetadata(
  workspaceId: string,
  itemId: string,
  input: KnowledgeMetadataInput,
  ownerUserId: string | null,
): Promise<KnowledgeCorpusItem> {
  const item = await resolveKnowledgeItem(workspaceId, itemId);
  const now = new Date();
  await db.insert(knowledgeMetadata).values({
    workspaceId,
    itemId,
    itemType: item.itemType,
    conceptType: input.conceptType?.trim() || null,
    description: input.description?.trim() || null,
    tags: cleanStrings(input.tags, 30),
    sources: cleanSources(input.sources),
    status: input.status ?? null,
    staleAfter: input.staleAfter?.trim() || null,
    ownerUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [knowledgeMetadata.workspaceId, knowledgeMetadata.itemId, knowledgeMetadata.itemType],
    set: {
      conceptType: input.conceptType?.trim() || null,
      description: input.description?.trim() || null,
      tags: cleanStrings(input.tags, 30),
      sources: cleanSources(input.sources),
      status: input.status ?? null,
      staleAfter: input.staleAfter?.trim() || null,
      ownerUserId,
      updatedAt: now,
    },
  });
  return getKnowledgeItem(workspaceId, itemId);
}

export async function recordGeneratedKnowledge(
  workspaceId: string,
  itemId: string,
  generatedBy: string,
  metadataInput?: KnowledgeMetadataInput,
): Promise<void> {
  const item = await resolveKnowledgeItem(workspaceId, itemId);
  const now = new Date();
  await db.insert(knowledgeMetadata).values({
    workspaceId,
    itemId,
    itemType: item.itemType,
    conceptType: metadataInput?.conceptType?.trim() || null,
    description: metadataInput?.description?.trim() || null,
    tags: cleanStrings(metadataInput?.tags, 30),
    sources: cleanSources(metadataInput?.sources),
    status: metadataInput?.status ?? 'draft',
    staleAfter: metadataInput?.staleAfter?.trim() || null,
    generatedBy,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [knowledgeMetadata.workspaceId, knowledgeMetadata.itemId, knowledgeMetadata.itemType],
    set: {
      ...(metadataInput ? {
        conceptType: metadataInput.conceptType?.trim() || null,
        description: metadataInput.description?.trim() || null,
        tags: cleanStrings(metadataInput.tags, 30),
        sources: cleanSources(metadataInput.sources),
        status: metadataInput.status ?? 'draft',
        staleAfter: metadataInput.staleAfter?.trim() || null,
      } : {}),
      generatedBy,
      generatedAt: now,
      updatedAt: now,
    },
  });
}

export async function recordImportedKnowledge(
  workspaceId: string,
  itemId: string,
  input: KnowledgeMetadataInput & {
    trustTier: 'unverified' | 'machine-confirmed' | 'external-human-asserted';
    frontmatterRaw: string;
  },
): Promise<void> {
  const item = await resolveKnowledgeItem(workspaceId, itemId);
  const now = new Date();
  const externalVerified = input.trustTier === 'external-human-asserted'
    ? [{ by: 'human:external-okf' }]
    : input.trustTier === 'machine-confirmed'
      ? [{ by: 'external-okf' }]
      : [];
  await db.insert(knowledgeMetadata).values({
    workspaceId,
    itemId,
    itemType: item.itemType,
    conceptType: input.conceptType?.trim() || null,
    description: input.description?.trim() || null,
    tags: cleanStrings(input.tags, 30),
    sources: cleanSources(input.sources),
    status: input.status ?? null,
    staleAfter: input.staleAfter?.trim() || null,
    externalVerified,
    externalFrontmatter: input.frontmatterRaw,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [knowledgeMetadata.workspaceId, knowledgeMetadata.itemId, knowledgeMetadata.itemType],
    set: {
      conceptType: input.conceptType?.trim() || null,
      description: input.description?.trim() || null,
      tags: cleanStrings(input.tags, 30),
      sources: cleanSources(input.sources),
      status: input.status ?? null,
      staleAfter: input.staleAfter?.trim() || null,
      externalVerified,
      externalFrontmatter: input.frontmatterRaw,
      updatedAt: now,
    },
  });
}

export async function reviewKnowledgeItem(workspaceId: string, itemId: string, reviewerUserId: string): Promise<KnowledgeCorpusItem> {
  const item = await resolveKnowledgeItem(workspaceId, itemId);
  let [metadata] = await db
    .select()
    .from(knowledgeMetadata)
    .where(and(eq(knowledgeMetadata.workspaceId, workspaceId), eq(knowledgeMetadata.itemId, itemId), eq(knowledgeMetadata.itemType, item.itemType)))
    .limit(1);
  if (!metadata) {
    const now = new Date();
    const id = randomUUID();
    await db.insert(knowledgeMetadata).values({ id, workspaceId, itemId, itemType: item.itemType, ownerUserId: reviewerUserId, createdAt: now, updatedAt: now });
    [metadata] = await db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.id, id)).limit(1);
  }
  if (!metadata) throw new Error('Knowledge metadata could not be created');
  await db.insert(knowledgeReviews).values({
    metadataId: metadata.id,
    reviewerUserId,
    contentHash: hashKnowledgeContent(item.title, item.content),
    reviewedAt: new Date(),
  });
  return getKnowledgeItem(workspaceId, itemId);
}

export async function listKnowledgeCorpus(workspaceId: string): Promise<KnowledgeCorpusItem[]> {
  const nativeItems = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      pageContent: standalonePages.content,
      databaseId: databases.id,
      databaseSchema: databases.schema,
    })
    .from(workspaceItems)
    .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.workspaceId, workspaceId));
  const rowItems = await db
    .select({ id: pages.id, title: pages.title, content: pages.content, databaseId: pages.databaseId })
    .from(pages)
    .innerJoin(databases, eq(databases.id, pages.databaseId))
    .innerJoin(workspaceItems, and(eq(workspaceItems.id, databases.itemId), eq(workspaceItems.workspaceId, workspaceId)));
  const metadataRows = await db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId));
  const reviewRows = await db
    .select({ review: knowledgeReviews, metadataId: knowledgeMetadata.id })
    .from(knowledgeReviews)
    .innerJoin(knowledgeMetadata, and(eq(knowledgeMetadata.id, knowledgeReviews.metadataId), eq(knowledgeMetadata.workspaceId, workspaceId)))
    .orderBy(desc(knowledgeReviews.reviewedAt));

  const metadataMap = new Map(metadataRows.map(row => [`${row.itemType}:${row.itemId}`, row]));
  const reviewsMap = new Map<string, Array<typeof knowledgeReviews.$inferSelect>>();
  for (const row of reviewRows) {
    const current = reviewsMap.get(row.metadataId) ?? [];
    current.push(row.review);
    reviewsMap.set(row.metadataId, current);
  }
  const titleMap = new Map(nativeItems.map(item => [item.id, item.title]));
  const now = new Date();
  const corpus: KnowledgeCorpusItem[] = [];
  for (const raw of nativeItems) {
    const item: ResolvedKnowledgeItem = {
      id: raw.id,
      itemType: raw.type,
      title: raw.title,
      content: raw.type === 'page' ? raw.pageContent ?? '' : JSON.stringify(raw.databaseSchema ?? []),
      ...(raw.databaseId ? { databaseId: raw.databaseId } : {}),
    };
    const metadata = metadataMap.get(`${item.itemType}:${item.id}`);
    corpus.push({
      ...item,
      breadcrumb: raw.parentId && titleMap.has(raw.parentId) ? [titleMap.get(raw.parentId)!] : [],
      metadata: toCorpusMetadata(metadata, item, metadata ? reviewsMap.get(metadata.id) ?? [] : [], now),
    });
  }
  for (const raw of rowItems) {
    const item: ResolvedKnowledgeItem = { ...raw, itemType: 'database_row', content: raw.content ?? '' };
    const metadata = metadataMap.get(`database_row:${item.id}`);
    corpus.push({
      ...item,
      breadcrumb: nativeItems.find(candidate => candidate.databaseId === raw.databaseId)?.title
        ? [nativeItems.find(candidate => candidate.databaseId === raw.databaseId)!.title]
        : [],
      metadata: toCorpusMetadata(metadata, item, metadata ? reviewsMap.get(metadata.id) ?? [] : [], now),
    });
  }
  return corpus;
}

export async function getContextPolicy(workspaceId: string): Promise<ContextPolicy> {
  const [row] = await db.select().from(workspaceContextPolicies).where(eq(workspaceContextPolicies.workspaceId, workspaceId)).limit(1);
  return row ? { mode: row.mode, autoMaxTokens: row.autoMaxTokens, trustPolicy: row.trustPolicy } : DEFAULT_CONTEXT_POLICY;
}

export async function setContextPolicy(workspaceId: string, policy: ContextPolicy): Promise<ContextPolicy> {
  const now = new Date();
  const normalized: ContextPolicy = {
    mode: policy.mode,
    autoMaxTokens: Math.min(16_000, Math.max(1_000, Math.floor(policy.autoMaxTokens))),
    trustPolicy: policy.trustPolicy,
  };
  await db.insert(workspaceContextPolicies).values({ workspaceId, ...normalized, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: workspaceContextPolicies.workspaceId, set: { ...normalized, updatedAt: now } });
  return normalized;
}

export async function getKnowledgeRevision(workspaceId: string): Promise<string> {
  const metadata = await db.select({ updatedAt: knowledgeMetadata.updatedAt }).from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId));
  const newest = metadata.reduce((max, row) => Math.max(max, row.updatedAt.getTime()), 0);
  return createHash('sha256').update(`${workspaceId}:${metadata.length}:${newest}`).digest('hex').slice(0, 20);
}

export async function createContextRun(
  ctx: ContextActor,
  task: string,
  conceptIds: string[],
  trustPolicy: ContextTrustPolicy,
  estimatedTokens: number,
): Promise<{ contextRunId: string; expiresAt: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60_000);
  const id = randomUUID();
  db.delete(contextRuns)
    .where(and(eq(contextRuns.workspaceId, ctx.workspaceId), lt(contextRuns.expiresAt, now)))
    .catch(() => {});
  await db.insert(contextRuns).values({
    id,
    workspaceId: ctx.workspaceId,
    tokenId: ctx.tokenKind === 'pat' ? ctx.tokenId : null,
    oauthTokenId: ctx.tokenKind === 'oauth' ? ctx.tokenId : null,
    ownerUserId: ctx.ownerUserId,
    taskHash: createHash('sha256').update(task).digest('hex'),
    conceptSetHash: createHash('sha256').update([...conceptIds].sort().join('\0')).digest('hex'),
    knowledgeRevision: await getKnowledgeRevision(ctx.workspaceId),
    trustPolicy,
    estimatedTokens,
    expiresAt,
    createdAt: now,
  });
  return { contextRunId: id, expiresAt: expiresAt.toISOString() };
}

export async function validateContextRunForWrite(
  ctx: ContextActor,
  contextRunId: string | undefined,
): Promise<{ ok: true; mode: ContextMode } | { ok: false; mode: 'strict'; reason: string }> {
  const policy = await getContextPolicy(ctx.workspaceId);
  if (policy.mode !== 'strict') return { ok: true, mode: policy.mode };
  if (!contextRunId) return { ok: false, mode: 'strict', reason: 'Call prepare_context first and pass its contextRunId.' };
  const [run] = await db.select().from(contextRuns).where(and(eq(contextRuns.id, contextRunId), eq(contextRuns.workspaceId, ctx.workspaceId))).limit(1);
  const actorMatches = run && (ctx.tokenKind === 'pat' ? run.tokenId === ctx.tokenId : run.oauthTokenId === ctx.tokenId);
  if (!run || !actorMatches) return { ok: false, mode: 'strict', reason: 'The context run does not belong to this agent and workspace.' };
  if (run.expiresAt.getTime() <= Date.now()) return { ok: false, mode: 'strict', reason: 'The context run expired; call prepare_context again.' };
  return { ok: true, mode: 'strict' };
}
