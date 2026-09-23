/**
 * Cookie-free knowledge/context policy service used by MCP and server actions.
 * OKF is an interchange projection; these tables are the native source of truth.
 */
import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
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
  workspaces,
} from '@/db/schema';
import { changeVersionFromRows, changeVersionQuery } from './changeVersion';
import { chunkRows } from './sqlChunk';

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
    // Dashboards carry no knowledge metadata: the OKF model describes
    // documents and their review state, and a dashboard is a live view over
    // data that is already covered by its source databases. Treated as
    // not-found here rather than given a fake concept type.
    if (item.type === 'dashboard') throw new Error('Not found');
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

/**
 * `recordGeneratedKnowledge` for a whole batch, in ONE statement.
 *
 * The per-item version resolves each id back to its type with a query first;
 * the bulk write paths already know what they just created, so the caller
 * passes `itemType` and the resolution round-trips disappear entirely. It is
 * the "an agent authored this" stamp every bulk-created item gets; an item may
 * also carry the concept type, tags and sources `bulk_create_pages` accepts per
 * entry — that is how a calibration labels its rows without one call per row.
 * On conflict (an item stamped before) only the provenance moves, as before:
 * this path never overwrites curated metadata.
 *
 * Best-effort by contract — the caller swallows failures, because losing a
 * provenance stamp must not undo the content it describes.
 */
export async function recordGeneratedKnowledgeBulk(
  workspaceId: string,
  items: {
    itemId: string;
    itemType: KnowledgeItemType;
    metadata?: Pick<KnowledgeMetadataInput, 'conceptType' | 'tags' | 'sources'>;
  }[],
  generatedBy: string,
): Promise<void> {
  if (items.length === 0) return;
  const now = new Date();
  // The table is unique on (workspace_id, item_id, item_type) — a duplicate id
  // inside one call would make the statement conflict with itself.
  const seen = new Set<string>();
  const rows = items.flatMap(item => {
    const key = `${item.itemId}|${item.itemType}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      workspaceId,
      itemId: item.itemId,
      itemType: item.itemType,
      conceptType: item.metadata?.conceptType?.trim() || null,
      description: null,
      tags: cleanStrings(item.metadata?.tags, 30),
      sources: cleanSources(item.metadata?.sources),
      status: 'draft' as const,
      staleAfter: null,
      generatedBy,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    }];
  });

  // 14 bind params per row (id comes from $defaultFn). Several chunks still
  // ship as one batch, so the round-trip count stays flat as the call grows.
  const statements = chunkRows(rows, 14).map(chunk =>
    db.insert(knowledgeMetadata).values(chunk).onConflictDoUpdate({
      target: [knowledgeMetadata.workspaceId, knowledgeMetadata.itemId, knowledgeMetadata.itemType],
      set: { generatedBy, generatedAt: now, updatedAt: now },
    }),
  );
  if (statements.length === 1) await statements[0];
  else if (statements.length > 1) await db.batch(statements as [any, ...any[]]);
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

/**
 * Every page, database and row of the workspace with its knowledge metadata —
 * the corpus `prepare_context` ranks and the OKF snapshot exports.
 *
 * The four reads are independent, so they ship as ONE `db.batch` round-trip
 * instead of four sequential awaits (Turso is remote: the turns, not the
 * queries, are the cost — see AGENTS.md → Performance Rules).
 */
export async function listKnowledgeCorpus(workspaceId: string): Promise<KnowledgeCorpusItem[]> {
  const [nativeItems, rowItems, metadataRows, reviewRows] = await db.batch([
    db
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
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({ id: pages.id, title: pages.title, content: pages.content, databaseId: pages.databaseId })
      .from(pages)
      .innerJoin(databases, eq(databases.id, pages.databaseId))
      .innerJoin(workspaceItems, and(eq(workspaceItems.id, databases.itemId), eq(workspaceItems.workspaceId, workspaceId))),
    db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId)),
    db
      .select({ review: knowledgeReviews, metadataId: knowledgeMetadata.id })
      .from(knowledgeReviews)
      .innerJoin(knowledgeMetadata, and(eq(knowledgeMetadata.id, knowledgeReviews.metadataId), eq(knowledgeMetadata.workspaceId, workspaceId)))
      .orderBy(desc(knowledgeReviews.reviewedAt)),
  ]);

  const metadataMap = new Map(metadataRows.map(row => [`${row.itemType}:${row.itemId}`, row]));
  const reviewsMap = new Map<string, Array<typeof knowledgeReviews.$inferSelect>>();
  for (const row of reviewRows) {
    const current = reviewsMap.get(row.metadataId) ?? [];
    current.push(row.review);
    reviewsMap.set(row.metadataId, current);
  }
  const titleMap = new Map(nativeItems.map(item => [item.id, item.title]));
  const databaseTitle = new Map(nativeItems.flatMap(item => item.databaseId ? [[item.databaseId, item.title] as const] : []));
  const now = new Date();
  const corpus: KnowledgeCorpusItem[] = [];
  for (const raw of nativeItems) {
    // See resolveKnowledgeItem: dashboards are not knowledge items.
    if (raw.type === 'dashboard') continue;
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
      // A map, not a find() per row: that was rows × items on every call.
      breadcrumb: databaseTitle.get(raw.databaseId) ? [databaseTitle.get(raw.databaseId)!] : [],
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

// Guards the aggregates below against legacy CURRENT_TIMESTAMP-as-TEXT values
// (see changeVersion.ts): SQLite ranks TEXT above INTEGER in max().
const epochMaxSql = (column: string) =>
  `coalesce(max(case when typeof(${column}) = 'integer' then ${column} else 0 end), 0)`;

export async function getKnowledgeRevision(workspaceId: string): Promise<string> {
  // Aggregated in SQL: this runs on every prepare_context call, and it used to
  // pull one row per metadata record just to take a count and a max.
  const [row] = await db
    .select({ count: sql<number>`count(*)`, newest: sql<number>`${sql.raw(epochMaxSql('updated_at'))}` })
    .from(knowledgeMetadata)
    .where(eq(knowledgeMetadata.workspaceId, workspaceId));
  const newest = Number(row?.newest ?? 0) * 1000;
  return createHash('sha256').update(`${workspaceId}:${Number(row?.count ?? 0)}:${newest}`).digest('hex').slice(0, 20);
}

// Timestamps are second-granular and written by many instances; a second this
// close to "now" may still receive writes (same margin as the change cursor's
// HOT_SECOND_MS in services/workspace.ts).
const HOT_SECOND_MS = 2_000;

/**
 * Cache key for the prepare_context corpus index (`services/contextPack.ts`),
 * or null when the corpus must not be cached yet because its newest change is
 * still inside the hot second.
 *
 * It is the live-UI change version plus what that number cannot see: the
 * knowledge tables (a review, a revocation or a metadata edit changes ranking
 * and trust without touching any content timestamp) and the item/row counts (a
 * delete path that writes no tombstone — recurrence pruning — would otherwise
 * leave a removed row in the cache). The knowledge aggregates are kept out of
 * `computeChangeVersion` on purpose: that runs on every 2.5s poll of every
 * project window, and no screen needs to refresh when a review is recorded.
 *
 * One round-trip: the change-version UNION and the aggregates share a batch.
 */
export async function getKnowledgeCorpusVersion(workspaceId: string): Promise<string | null> {
  const workspaceFilter = sql`workspace_id = ${workspaceId}`;
  const [changeRows, statsRows] = await db.batch([
    changeVersionQuery([workspaceId]),
    db
      .select({
        items: sql<number>`(select count(*) from workspace_items where ${workspaceFilter})`,
        rows: sql<number>`(select count(*) from pages join databases on databases.id = pages.database_id join workspace_items on workspace_items.id = databases.item_id where workspace_items.${workspaceFilter})`,
        metaCount: sql<number>`(select count(*) from knowledge_metadata where ${workspaceFilter})`,
        metaMax: sql<number>`(select ${sql.raw(epochMaxSql('updated_at'))} from knowledge_metadata where ${workspaceFilter})`,
        reviewCount: sql<number>`(select count(*) from knowledge_reviews join knowledge_metadata on knowledge_metadata.id = knowledge_reviews.metadata_id where knowledge_metadata.${workspaceFilter})`,
        reviewMax: sql<number>`(select ${sql.raw(epochMaxSql('knowledge_reviews.reviewed_at'))} from knowledge_reviews join knowledge_metadata on knowledge_metadata.id = knowledge_reviews.metadata_id where knowledge_metadata.${workspaceFilter})`,
        revokedMax: sql<number>`(select ${sql.raw(epochMaxSql('knowledge_reviews.revoked_at'))} from knowledge_reviews join knowledge_metadata on knowledge_metadata.id = knowledge_reviews.metadata_id where knowledge_metadata.${workspaceFilter})`,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId)),
  ]);
  const stats = statsRows[0];
  if (!stats) return null;
  const change = changeVersionFromRows(changeRows);
  const newest = Math.max(change, Number(stats.metaMax), Number(stats.reviewMax), Number(stats.revokedMax));
  if (Date.now() - newest * 1000 < HOT_SECOND_MS) return null;
  return [change, stats.items, stats.rows, stats.metaCount, stats.metaMax, stats.reviewCount, stats.reviewMax, stats.revokedMax]
    .map(Number)
    .join(':');
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
