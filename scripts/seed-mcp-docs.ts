#!/usr/bin/env tsx
// Idempotent script: seeds docs/mcp/ markdown files as public shared pages
// with custom admin slugs and in_sitemap=true.
//
// Local:  DATABASE_URL="file:local.db" npx tsx scripts/seed-mcp-docs.ts
// Turso:  npx tsx scripts/seed-mcp-docs.ts
//
// Run once after initial deployment, or again whenever doc content changes.
// Existing pages are updated in-place; missing pages are created from scratch.

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

// Import schema using relative path (no tsconfig path aliases needed)
import * as schema from '../src/db/schema';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// ── Doc page definitions — order matters: parents must come before children ──

type DocPage = {
  slug: string;
  file: string;
  title: string;
  sortOrder: number;
  parentSlug: string | null;
  icon: string;
};

const DOCS: DocPage[] = [
  {
    slug: 'docs/mcp',
    file: 'README.md',
    title: 'MCP Documentation',
    sortOrder: 0,
    parentSlug: null,
    icon: '📖',
  },
  {
    slug: 'docs/mcp/getting-started',
    file: 'getting-started.md',
    title: 'Getting Started',
    sortOrder: 0,
    parentSlug: 'docs/mcp',
    icon: '🚀',
  },
  {
    slug: 'docs/mcp/authentication',
    file: 'authentication.md',
    title: 'Authentication',
    sortOrder: 1,
    parentSlug: 'docs/mcp',
    icon: '🔑',
  },
  {
    slug: 'docs/mcp/read-tools',
    file: 'read-tools.md',
    title: 'Read Tools',
    sortOrder: 2,
    parentSlug: 'docs/mcp',
    icon: '🔍',
  },
  {
    slug: 'docs/mcp/write-tools',
    file: 'write-tools.md',
    title: 'Write Tools',
    sortOrder: 3,
    parentSlug: 'docs/mcp',
    icon: '✏️',
  },
  {
    slug: 'docs/mcp/resources',
    file: 'resources.md',
    title: 'Resources',
    sortOrder: 4,
    parentSlug: 'docs/mcp',
    icon: '📦',
  },
  {
    slug: 'docs/mcp/prompts',
    file: 'prompts.md',
    title: 'Prompts',
    sortOrder: 5,
    parentSlug: 'docs/mcp',
    icon: '💡',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function readDoc(file: string): string {
  return readFileSync(join('docs', 'mcp', file), 'utf8');
}

async function findAdminUser(): Promise<string> {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);

  if (!user) {
    throw new Error('No admin user found. Create an admin account first.');
  }
  return user.id;
}

async function findOrCreateDocsWorkspace(adminUserId: string): Promise<string> {
  // Check if the root docs page already has a share — reuse that workspace
  const [existingRoot] = await db
    .select({ workspaceId: schema.sharedPages.workspaceId })
    .from(schema.sharedPages)
    .where(eq(schema.sharedPages.slug, 'docs/mcp'))
    .limit(1);

  if (existingRoot) return existingRoot.workspaceId;

  // Create a new workspace for docs
  const workspaceId = crypto.randomUUID();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: 'Remnus Docs',
    icon: '📚',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.workspaceMembers).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: adminUserId,
    role: 'owner',
    createdAt: new Date(),
  });

  console.log(`  Created workspace: ${workspaceId}`);
  return workspaceId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding MCP documentation pages...\n');

  const adminUserId = await findAdminUser();
  console.log(`Admin user: ${adminUserId}`);

  const workspaceId = await findOrCreateDocsWorkspace(adminUserId);
  console.log(`Workspace: ${workspaceId}\n`);

  // slug → workspace_items.id — built as we process each page
  const slugToItemId = new Map<string, string>();

  for (const doc of DOCS) {
    const content = readDoc(doc.file);

    // Check whether this slug already has a shared page
    const [existing] = await db
      .select({
        shareId: schema.sharedPages.id,
        pageId: schema.sharedPages.pageId,
      })
      .from(schema.sharedPages)
      .where(eq(schema.sharedPages.slug, doc.slug))
      .limit(1);

    if (existing) {
      // ── Update path ────────────────────────────────────────────────────────
      await Promise.all([
        db
          .update(schema.workspaceItems)
          .set({ title: doc.title, icon: doc.icon, updatedAt: new Date() })
          .where(eq(schema.workspaceItems.id, existing.pageId)),
        db
          .update(schema.standalonePages)
          .set({ content, updatedAt: new Date() })
          .where(eq(schema.standalonePages.itemId, existing.pageId)),
        db
          .update(schema.sharedPages)
          .set({ inSitemap: true, width: 'wide' })
          .where(eq(schema.sharedPages.id, existing.shareId)),
      ]);

      slugToItemId.set(doc.slug, existing.pageId);
      console.log(`  [updated] /share/${doc.slug}`);
    } else {
      // ── Create path ────────────────────────────────────────────────────────
      const parentItemId = doc.parentSlug ? (slugToItemId.get(doc.parentSlug) ?? null) : null;
      const itemId = crypto.randomUUID();

      await db.insert(schema.workspaceItems).values({
        id: itemId,
        workspaceId,
        type: 'page',
        title: doc.title,
        icon: doc.icon,
        parentId: parentItemId,
        sortOrder: doc.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.standalonePages).values({
        id: crypto.randomUUID(),
        itemId,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.sharedPages).values({
        id: crypto.randomUUID(),
        slug: doc.slug,
        pageId: itemId,
        workspaceId,
        permission: 'read',
        width: 'wide',
        inSitemap: true,
        createdBy: adminUserId,
        createdAt: new Date(),
      });

      slugToItemId.set(doc.slug, itemId);
      console.log(`  [created] /share/${doc.slug}`);
    }
  }

  console.log('\nDone. Public URLs:');
  for (const doc of DOCS) {
    console.log(`  https://remnus.com/share/${doc.slug}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
