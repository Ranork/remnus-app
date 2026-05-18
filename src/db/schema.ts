import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceItems = sqliteTable('workspace_items', {
  id:          text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type:        text('type', { enum: ['page', 'database'] }).notNull(),
  title:       text('title').notNull(),
  parentId:    text('parent_id'),
  sortOrder:   integer('sort_order').notNull().default(0),
  icon:        text('icon'),
  iconColor:   text('icon_color'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const standalonePages = sqliteTable('standalone_pages', {
  id:        text('id').primaryKey(),
  itemId:    text('item_id').notNull().references(() => workspaceItems.id, { onDelete: 'cascade' }),
  content:   text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const databases = sqliteTable('databases', {
  id:     text('id').primaryKey(),
  name:   text('name').notNull(),
  itemId: text('item_id').references(() => workspaceItems.id, { onDelete: 'set null' }),
  schema: text('schema', { mode: 'json' }).notNull().$type<any[]>(),
  views: text('views', { mode: 'json' }).$type<any[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull().references(() => databases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  properties: text('properties', { mode: 'json' }).notNull().$type<Record<string, any>>().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  icon: text('icon'),
  iconColor: text('icon_color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
