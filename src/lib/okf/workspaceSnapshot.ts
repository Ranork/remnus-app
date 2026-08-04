import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { databases, pages, standalonePages, workspaceItems, workspaces } from '@/db/schema';
import type { OkfWorkspaceSnapshot } from './types';
import { listKnowledgeCorpus } from '@/lib/services/knowledge';

function safeIso(value: Date | null | undefined): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

export async function getOkfWorkspaceSnapshot(workspaceId: string): Promise<OkfWorkspaceSnapshot> {
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name, updatedAt: workspaces.updatedAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) throw new Error('Workspace not found');

  const [itemRows, standaloneRows, databaseRows, pageRows, knowledgeRows] = await Promise.all([
    db
      .select({
        id: workspaceItems.id,
        type: workspaceItems.type,
        title: workspaceItems.title,
        parentId: workspaceItems.parentId,
        sortOrder: workspaceItems.sortOrder,
        icon: workspaceItems.icon,
        iconColor: workspaceItems.iconColor,
        updatedAt: workspaceItems.updatedAt,
      })
      .from(workspaceItems)
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({
        itemId: standalonePages.itemId,
        content: standalonePages.content,
        updatedAt: standalonePages.updatedAt,
      })
      .from(standalonePages)
      .innerJoin(workspaceItems, eq(standalonePages.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({
        id: databases.id,
        itemId: databases.itemId,
        name: databases.name,
        schema: databases.schema,
        views: databases.views,
        updatedAt: databases.updatedAt,
      })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({
        id: pages.id,
        databaseId: pages.databaseId,
        title: pages.title,
        content: pages.content,
        properties: pages.properties,
        sortOrder: pages.sortOrder,
        icon: pages.icon,
        iconColor: pages.iconColor,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .innerJoin(databases, eq(pages.databaseId, databases.id))
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    listKnowledgeCorpus(workspaceId),
  ]);

  const rowsByDatabase = new Map<string, typeof pageRows>();
  for (const row of pageRows) {
    const bucket = rowsByDatabase.get(row.databaseId) ?? [];
    bucket.push(row);
    rowsByDatabase.set(row.databaseId, bucket);
  }

  return {
    workspace: { id: workspace.id, name: workspace.name, updatedAt: safeIso(workspace.updatedAt) },
    items: itemRows.map(item => ({ ...item, updatedAt: safeIso(item.updatedAt) })),
    standalonePages: standaloneRows.map(page => ({ ...page, updatedAt: safeIso(page.updatedAt) })),
    databases: databaseRows.map(database => ({
      id: database.id,
      itemId: database.itemId!,
      name: database.name,
      schema: Array.isArray(database.schema) ? database.schema : [],
      views: Array.isArray(database.views) ? database.views : [],
      updatedAt: safeIso(database.updatedAt),
      rows: (rowsByDatabase.get(database.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
        .map(row => ({
          ...row,
          properties: row.properties && typeof row.properties === 'object' ? row.properties : {},
          updatedAt: safeIso(row.updatedAt),
        })),
    })),
    knowledge: knowledgeRows
      .filter(item => item.metadata.id)
      .map(item => ({
        itemId: item.id,
        itemType: item.itemType,
        ...(item.metadata.conceptType ? { conceptType: item.metadata.conceptType } : {}),
        ...(item.metadata.description ? { description: item.metadata.description } : {}),
        tags: item.metadata.tags,
        sources: item.metadata.sources,
        ...(item.metadata.status ? { status: item.metadata.status } : {}),
        ...(item.metadata.staleAfter ? { staleAfter: item.metadata.staleAfter } : {}),
        trust: item.metadata.trust,
        ...(item.metadata.generatedBy ? { generatedBy: item.metadata.generatedBy } : {}),
        ...(item.metadata.reviewedAt ? { reviewedAt: item.metadata.reviewedAt } : {}),
      })),
  };
}
