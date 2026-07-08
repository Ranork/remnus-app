import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '@/db';
import { workspaceItems, pages, databases, agentActivity } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { listWorkspaceItems, getDatabaseSchema, getAnyPageById, getWorkspaceDigest } from '@/lib/services/workspace';
import type { TokenContext } from './context';

export function registerResources(server: McpServer, ctx: TokenContext) {
  // 1. Workspace Schema — remnus://workspace/{id}/schema
  const workspaceSchemaTemplate = new ResourceTemplate('remnus://workspace/{id}/schema', {
    list: async () => ({
      resources: [{
        uri: `remnus://workspace/${ctx.workspaceId}/schema`,
        name: 'Workspace Schema',
        mimeType: 'application/json',
        description: 'Get the JSON schema of a workspace containing databases and metadata',
      }],
    }),
  });

  server.registerResource(
    'Workspace Schema',
    workspaceSchemaTemplate,
    { mimeType: 'application/json', description: 'Get the JSON schema of a workspace containing databases and metadata' },
    async (uri, variables) => {
      const workspaceId = variables.id as string;
      if (workspaceId !== ctx.workspaceId) throw new Error('Access denied or workspace not found');

      const { items } = await listWorkspaceItems(ctx.workspaceId);
      const dbs = items.filter(i => i.type === 'database');
      const schemas = await Promise.all(
        dbs.map(async dbItem => {
          try {
            const schema = await getDatabaseSchema(ctx.workspaceId, dbItem.id);
            return { id: dbItem.id, title: dbItem.title, ...schema };
          } catch { return null; }
        }),
      );
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            workspaceId,
            databases: schemas.filter((s): s is Exclude<typeof s, null> => s !== null),
          }),
        }],
      };
    },
  );

  // 2. Workspace Digest — remnus://workspace/{id}/digest
  const workspaceDigestTemplate = new ResourceTemplate('remnus://workspace/{id}/digest', {
    list: async () => ({
      resources: [{
        uri: `remnus://workspace/${ctx.workspaceId}/digest`,
        name: 'Workspace Digest',
        mimeType: 'text/markdown',
        description: 'Compact one-line-per-item map of the whole workspace (titles, ids, row counts, last-updated) — the cheapest way to orient before targeted reads',
      }],
    }),
  });

  server.registerResource(
    'Workspace Digest',
    workspaceDigestTemplate,
    { mimeType: 'text/markdown', description: 'Compact one-line-per-item map of the whole workspace — read this first to orient, then fetch only what you need' },
    async (uri, variables) => {
      const workspaceId = variables.id as string;
      if (workspaceId !== ctx.workspaceId) throw new Error('Access denied or workspace not found');

      const digest = await getWorkspaceDigest(ctx.workspaceId);
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: digest }] };
    },
  );

  // 3. Page Content — remnus://page/{id}
  const pageTemplate = new ResourceTemplate('remnus://page/{id}', {
    list: async () => {
      const [standalone, dbRows] = await Promise.all([
        db.select({ id: workspaceItems.id, title: workspaceItems.title, updatedAt: workspaceItems.updatedAt })
          .from(workspaceItems)
          .where(and(eq(workspaceItems.workspaceId, ctx.workspaceId), eq(workspaceItems.type, 'page')))
          .orderBy(desc(workspaceItems.updatedAt))
          .limit(20),
        db.select({ id: pages.id, title: pages.title, updatedAt: pages.updatedAt })
          .from(pages)
          .innerJoin(databases, eq(pages.databaseId, databases.id))
          .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
          .where(eq(workspaceItems.workspaceId, ctx.workspaceId))
          .orderBy(desc(pages.updatedAt))
          .limit(20),
      ]);

      const all = [...standalone, ...dbRows]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 20);

      return {
        resources: all.map(p => ({
          uri: `remnus://page/${p.id}`,
          name: p.title || 'Untitled Page',
          mimeType: 'text/markdown',
          description: 'Son güncellenen sayfalar. (Diğer tüm sayfalara doğrudan ID\'leri ile remnus://page/{id} üzerinden erişilebilir.)',
        })),
      };
    },
  });

  server.registerResource(
    'Page Content',
    pageTemplate,
    { mimeType: 'text/markdown', description: 'Get markdown content and properties of a page or database row' },
    async (uri, variables) => {
      const page = await getAnyPageById(ctx.workspaceId, variables.id as string);

      let text = `# ${page.title || 'Untitled'}\n\n`;
      if (page.properties && Object.keys(page.properties).length > 0) {
        text += '## Properties\n';
        for (const [k, v] of Object.entries(page.properties)) {
          if (k === 'title') continue;
          const valStr = Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
          text += `- **${k}**: ${valStr}\n`;
        }
        text += '\n';
      }
      text += page.content || '';

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    },
  );

  // 4. Database Schema — remnus://database/{id}/schema
  const databaseSchemaTemplate = new ResourceTemplate('remnus://database/{id}/schema', {
    list: async () => {
      const { items } = await listWorkspaceItems(ctx.workspaceId);
      return {
        resources: items
          .filter(i => i.type === 'database')
          .map(dbItem => ({
            uri: `remnus://database/${dbItem.id}/schema`,
            name: `${dbItem.title} Schema`,
            mimeType: 'application/json',
            description: `JSON schema for database "${dbItem.title}"`,
          })),
      };
    },
  });

  server.registerResource(
    'Database Schema',
    databaseSchemaTemplate,
    { mimeType: 'application/json', description: 'Get JSON schema columns of a database' },
    async (uri, variables) => {
      const schema = await getDatabaseSchema(ctx.workspaceId, variables.id as string);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(schema) }] };
    },
  );

  // 5. Audit Log — remnus://audit-log/recent
  server.registerResource(
    'Recent Audit Log',
    'remnus://audit-log/recent',
    { mimeType: 'application/json', description: 'Get recent audit activity for the current MCP token' },
    async (uri) => {
      // PAT and OAuth activity live in different FK columns (migration 0034).
      const logs = await db
        .select()
        .from(agentActivity)
        .where(ctx.tokenKind === 'pat'
          ? eq(agentActivity.tokenId, ctx.tokenId)
          : eq(agentActivity.oauthTokenId, ctx.tokenId))
        .orderBy(desc(agentActivity.createdAt))
        .limit(50);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(logs) }] };
    },
  );
}
