'use server';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { getRequestLocale } from '@/i18n/requestLocale';
import { buildTemplate, getCatalogEntry } from '@/lib/templates';
import { getTemplateText } from '@/lib/starterContent';
import { createStandalonePage, createWorkspaceDatabase } from './workspace';
import { createDashboard } from './dashboard';

export type CreatedFromTemplate = {
  type: 'page' | 'database' | 'dashboard';
  /** The URL id: `databases.id` for a database, the workspace item id otherwise. */
  navId: string;
  itemId: string;
};

/**
 * Creates an item from a template, in the request's language: column, option and view
 * names, sample rows and page bodies all come from that locale's `TemplateText`. Each
 * create helper asserts workspace access itself. Seed rows go in as one insert — the
 * picker used to send one `createPage` round trip per row.
 */
export async function createFromTemplate(
  workspaceId: string,
  templateId: string,
  title: string,
  parentId?: string,
): Promise<CreatedFromTemplate> {
  const entry = getCatalogEntry(templateId);
  if (!entry) throw new Error(`Unknown template: ${templateId}`);

  const template = buildTemplate(entry.id, await getTemplateText(await getRequestLocale()));
  const icon = entry.icon;
  const iconColor = entry.iconColor ?? null;

  if (template.category === 'dashboard') {
    const { itemId } = await createDashboard(workspaceId, title, parentId, { spec: template.spec, icon, iconColor });
    return { type: 'dashboard', navId: itemId, itemId };
  }

  if (template.category === 'page') {
    const { itemId } = await createStandalonePage(workspaceId, title, parentId, {
      initialContent: template.initialContent,
      icon,
      iconColor,
    });
    return { type: 'page', navId: itemId, itemId };
  }

  const { itemId, dbId } = await createWorkspaceDatabase(workspaceId, title, {
    schema: template.schema,
    views: template.views.map((view) => ({ ...view, id: crypto.randomUUID().slice(0, 8) })),
    icon,
    iconColor,
    parentId,
  });

  if (template.seedRows?.length) {
    const now = new Date();
    await db.insert(pages).values(
      template.seedRows.map((row, index) => ({
        id: crypto.randomUUID(),
        databaseId: dbId,
        title: row.title,
        content: '',
        properties: { title: row.title, ...row.properties },
        sortOrder: index + 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return { type: 'database', navId: dbId, itemId };
}
