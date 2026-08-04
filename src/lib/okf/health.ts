import { parseOkfFrontmatter, splitTopLevelEntries } from './frontmatter';
import type { OkfWorkspaceSnapshot } from './types';

export interface KnowledgeHealthLink {
  fromId: string;
  toId: string;
}

export interface KnowledgeHealthReport {
  score: number;
  totalContentConcepts: number;
  governedConcepts: number;
  humanReviewedConcepts: number;
  unverifiedConcepts: number;
  staleConcepts: number;
  deprecatedConcepts: number;
  orphanConcepts: number;
  brokenReferences: number;
}

interface SchemaColumn { id?: string; name?: string }

function propertiesByName(schema: unknown[], values: Record<string, unknown>): Record<string, unknown> {
  const byName: Record<string, unknown> = { ...values };
  for (const raw of schema) {
    const column = raw as SchemaColumn;
    if (column.id && column.name && Object.hasOwn(values, column.id)) byName[column.name] = values[column.id];
  }
  return byName;
}

function rawFrontmatter(schema: unknown[], values: Record<string, unknown>): string | undefined {
  const named = propertiesByName(schema, values);
  const match = Object.entries(named).find(([name, value]) => name.toLowerCase().includes('frontmatter') && typeof value === 'string');
  return typeof match?.[1] === 'string' ? match[1] : undefined;
}

export function analyzeKnowledgeHealth(
  snapshot: OkfWorkspaceSnapshot,
  links: KnowledgeHealthLink[],
  now = new Date(),
): KnowledgeHealthReport {
  const contentIds = new Set<string>();
  for (const page of snapshot.standalonePages) contentIds.add(page.itemId);
  for (const database of snapshot.databases) for (const row of database.rows) contentIds.add(row.id);

  const knownTargets = new Set(contentIds);
  for (const database of snapshot.databases) {
    knownTargets.add(database.id);
    knownTargets.add(database.itemId);
  }
  const connected = new Set<string>();
  let brokenReferences = 0;
  for (const link of links) {
    if (contentIds.has(link.fromId)) connected.add(link.fromId);
    if (contentIds.has(link.toId)) connected.add(link.toId);
    if (!knownTargets.has(link.toId)) brokenReferences++;
  }

  let governedConcepts = 0;
  let humanReviewedConcepts = 0;
  let unverifiedConcepts = 0;
  let staleConcepts = 0;
  let deprecatedConcepts = 0;
  const nativeByItem = new Map(snapshot.knowledge.map(metadata => [metadata.itemId, metadata]));
  for (const page of snapshot.standalonePages) {
    const native = nativeByItem.get(page.itemId);
    if (!native) continue;
    governedConcepts++;
    if (native.trust === 'human-reviewed') humanReviewedConcepts++;
    if (native.trust === 'unverified') unverifiedConcepts++;
    if (native.status === 'deprecated') deprecatedConcepts++;
    if (native.staleAfter) {
      const staleAt = new Date(native.staleAfter);
      if (Number.isFinite(staleAt.getTime()) && staleAt.getTime() < now.getTime()) staleConcepts++;
    }
  }
  for (const database of snapshot.databases) {
    for (const row of database.rows) {
      const native = nativeByItem.get(row.id);
      if (native) {
        governedConcepts++;
        if (native.trust === 'human-reviewed') humanReviewedConcepts++;
        if (native.trust === 'unverified') unverifiedConcepts++;
        if (native.status === 'deprecated') deprecatedConcepts++;
        if (native.staleAfter) {
          const staleAt = new Date(native.staleAfter);
          if (Number.isFinite(staleAt.getTime()) && staleAt.getTime() < now.getTime()) staleConcepts++;
        }
        continue;
      }
      const raw = rawFrontmatter(database.schema, row.properties);
      if (!raw) continue;
      governedConcepts++;
      const parsed = parseOkfFrontmatter(raw);
      const verified = splitTopLevelEntries(raw).some(entry => entry.key === 'verified');
      // Legacy imported frontmatter is an external assertion, not a local
      // authenticated exact-revision review, so it never increments this count.
      if (!verified) unverifiedConcepts++;
      if (parsed.status?.toLowerCase() === 'deprecated') deprecatedConcepts++;
      if (parsed.staleAfter) {
        const staleAt = new Date(parsed.staleAfter);
        if (Number.isFinite(staleAt.getTime()) && staleAt.getTime() < now.getTime()) staleConcepts++;
      }
    }
  }

  const orphanConcepts = [...contentIds].filter(id => !connected.has(id)).length;
  const orphanRatio = contentIds.size ? orphanConcepts / contentIds.size : 0;
  const score = Math.max(0, Math.round(
    100
    - Math.min(30, brokenReferences * 10)
    - Math.min(25, staleConcepts * 5)
    - Math.min(20, unverifiedConcepts * 2)
    - Math.min(25, orphanRatio * 25),
  ));

  return {
    score,
    totalContentConcepts: contentIds.size,
    governedConcepts,
    humanReviewedConcepts,
    unverifiedConcepts,
    staleConcepts,
    deprecatedConcepts,
    orphanConcepts,
    brokenReferences,
  };
}
