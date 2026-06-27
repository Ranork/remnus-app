'use server';
import { db } from '@/db';
import { databases, workspaceItems, workspaceMembers, pages, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { createWorkspaceDatabase, getActiveWorkspaceId } from './workspace';
import { publish } from '@/lib/realtime/publish';
import { SELECT_COLOR_ORDER, normalizeOption, type SelectOption } from '@/lib/types/properties';

// Verify user has access to the workspace that owns this database.
// Returns { userId, workspaceId } so callers can emit realtime events.
async function assertDatabaseAccess(databaseId: string): Promise<{ userId: string; workspaceId: string }> {
  const user = await getCurrentUser();

  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, databaseId))
    .limit(1);

  if (!row) throw new Error('Database not found');

  if (user.role !== 'admin') {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, row.workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!member) throw new Error('Unauthorized: no access to this database');
  }

  return { userId: user.id, workspaceId: row.workspaceId };
}

export async function createDatabase(name: string) {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) throw new Error('No active workspace');
  const { dbId } = await createWorkspaceDatabase(workspaceId, name);
  revalidatePath('/', 'layout');
  return dbId;
}

export async function getDatabases() {
  return db.select().from(databases);
}

export async function getDatabase(id: string) {
  await assertDatabaseAccess(id);

  const result = await db
    .select({
      id: databases.id,
      name: databases.name,
      itemId: databases.itemId,
      schema: databases.schema,
      views: databases.views,
      createdAt: databases.createdAt,
      updatedAt: databases.updatedAt,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
      workspaceId: workspaceItems.workspaceId,
      parentId: workspaceItems.parentId,
    })
    .from(databases)
    .leftJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, id));
  return result[0];
}

export async function updateDatabaseSchema(id: string, newSchema: any[]) {
  const { userId, workspaceId } = await assertDatabaseAccess(id);

  // 1. Fetch current database schema to compare
  const [dbRow] = await db
    .select({ schema: databases.schema })
    .from(databases)
    .where(eq(databases.id, id))
    .limit(1);

  const oldSchema = dbRow?.schema ?? [];

  // 2. Identify select/multi_select option renames
  const renames: { colId: string; type: string; oldVal: string; newVal: string }[] = [];
  for (const newCol of newSchema) {
    if (newCol.type !== 'select' && newCol.type !== 'multi_select' && newCol.type !== 'status') continue;
    const oldCol = oldSchema.find((c: any) => c.id === newCol.id);
    if (!oldCol) continue;

    const oldOpts = oldCol.options ?? [];
    const newOpts = newCol.options ?? [];
    const minLen = Math.min(oldOpts.length, newOpts.length);

    for (let i = 0; i < minLen; i++) {
      const oldOpt = oldOpts[i];
      const newOpt = newOpts[i];
      if (!oldOpt || !newOpt) continue;

      const oldVal = typeof oldOpt === 'string' ? oldOpt : oldOpt.value;
      const newVal = typeof newOpt === 'string' ? newOpt : newOpt.value;

      if (oldVal && newVal && oldVal !== newVal) {
        renames.push({ colId: newCol.id, type: newCol.type, oldVal, newVal });
      }
    }
  }

  // 3. Detect type conversions among the {select, multi_select, user, multi_user}
  //    family. These four share a "list of tokens" shape, so we can migrate the
  //    stored values across them as smoothly as possible:
  //      - label types (select/multi_select) hold option values (names/labels)
  //      - user types (user/multi_user) hold workspace member ids
  //    Converting label → user matches each label against member names/emails;
  //    converting user → label resolves each member id back to a display name.
  const CONVERTIBLE = new Set(['select', 'multi_select', 'user', 'multi_user']);
  const MULTI = new Set(['multi_select', 'multi_user']);
  const USERY = new Set(['user', 'multi_user']);
  const typeChanges: { colId: string; oldType: string; newType: string }[] = [];
  for (const newCol of newSchema) {
    const oldCol = oldSchema.find((c: any) => c.id === newCol.id);
    if (!oldCol || oldCol.type === newCol.type) continue;
    if (!CONVERTIBLE.has(oldCol.type) || !CONVERTIBLE.has(newCol.type)) continue;
    typeChanges.push({ colId: newCol.id, oldType: oldCol.type, newType: newCol.type });
  }

  // 4. Build a member lookup (only when a conversion actually needs it).
  const memberByKey = new Map<string, string>(); // normalized name/email -> userId
  const memberIdToName = new Map<string, string>(); // userId -> display name
  const needsMembers = typeChanges.length > 0;
  if (needsMembers) {
    const members = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    for (const m of members) {
      memberIdToName.set(m.id, (m.name || m.email || '').trim());
      const keys = [m.name, m.email, m.email?.split('@')[0]];
      for (const k of keys) {
        const nk = k?.trim().toLowerCase();
        if (nk && !memberByKey.has(nk)) memberByKey.set(nk, m.id);
      }
    }
  }

  // Normalize a stored cell value into a flat token array for the given type.
  const toTokens = (val: unknown, type: string): string[] => {
    if (val == null || val === '') return [];
    if (MULTI.has(type)) return Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string' && !!v) : [];
    return typeof val === 'string' ? [val] : [];
  };

  // 5. Update the database schema. For user → label conversions we enrich the
  //    target column's options with the resolved member names so the chips
  //    render with a label + color immediately (the type dropdown clears options).
  // We compute page mutations first so we can collect the option names to add.
  const optionsToAdd = new Map<string, Set<string>>(); // colId -> set of new option values
  const dbPages = (renames.length > 0 || typeChanges.length > 0)
    ? await db.select({ id: pages.id, properties: pages.properties }).from(pages).where(eq(pages.databaseId, id))
    : [];

  for (const pageRow of dbPages) {
    const properties = pageRow.properties ?? {};
    let changed = false;

    // 5a. Apply option renames first (value-level relabel within label types).
    for (const rename of renames) {
      const currentVal = properties[rename.colId];
      if (rename.type === 'select' || rename.type === 'status') {
        if (currentVal === rename.oldVal) {
          properties[rename.colId] = rename.newVal;
          changed = true;
        }
      } else if (rename.type === 'multi_select' && Array.isArray(currentVal)) {
        const updatedList = currentVal.map((v: string) => v === rename.oldVal ? rename.newVal : v);
        if (JSON.stringify(updatedList) !== JSON.stringify(currentVal)) {
          properties[rename.colId] = updatedList;
          changed = true;
        }
      }
    }

    // 5b. Apply type conversions (reads the possibly-renamed value).
    for (const conv of typeChanges) {
      let tokens = toTokens(properties[conv.colId], conv.oldType);
      const fromUser = USERY.has(conv.oldType);
      const toUser = USERY.has(conv.newType);

      if (fromUser && !toUser) {
        // member id -> display name (drop ids no longer resolvable)
        tokens = tokens.map((t) => memberIdToName.get(t) || '').filter(Boolean);
        if (!optionsToAdd.has(conv.colId)) optionsToAdd.set(conv.colId, new Set());
        const set = optionsToAdd.get(conv.colId)!;
        for (const name of tokens) set.add(name);
      } else if (!fromUser && toUser) {
        // label -> matched member id (drop labels with no matching member)
        tokens = tokens.map((t) => memberByKey.get(t.trim().toLowerCase()) || '').filter(Boolean);
      }
      // (label↔label and user↔user only change arity, tokens pass through)

      tokens = [...new Set(tokens)]; // de-dupe
      const newVal: unknown = MULTI.has(conv.newType) ? tokens : (tokens[0] ?? '');

      if (JSON.stringify(newVal) !== JSON.stringify(properties[conv.colId] ?? (MULTI.has(conv.newType) ? [] : ''))) {
        properties[conv.colId] = newVal;
        changed = true;
      }
    }

    if (changed) {
      await db.update(pages).set({ properties, updatedAt: new Date() }).where(eq(pages.id, pageRow.id));
    }
  }

  // 6. Merge resolved member names into the target select/multi_select options.
  if (optionsToAdd.size > 0) {
    for (const newCol of newSchema) {
      const names = optionsToAdd.get(newCol.id);
      if (!names || names.size === 0) continue;
      if (newCol.type !== 'select' && newCol.type !== 'multi_select') continue;
      const existing: (string | SelectOption)[] = newCol.options ?? [];
      const existingValues = new Set(existing.map((o) => normalizeOption(o).value));
      let colorIdx = existing.length;
      for (const name of names) {
        if (existingValues.has(name)) continue;
        existing.push({ value: name, color: SELECT_COLOR_ORDER[colorIdx % SELECT_COLOR_ORDER.length] });
        existingValues.add(name);
        colorIdx++;
      }
      newCol.options = existing;
    }
  }

  // 7. Persist the (possibly enriched) schema.
  await db.update(databases).set({ schema: newSchema, updatedAt: new Date() }).where(eq(databases.id, id));

  revalidatePath(`/db/${id}`);
  publish({ scope: 'database', workspaceId, resourceId: id, actorId: userId });
}

export async function updateDatabaseViews(id: string, views: any[]) {
  const { userId, workspaceId } = await assertDatabaseAccess(id);
  await db.update(databases).set({ views, updatedAt: new Date() }).where(eq(databases.id, id));
  publish({ scope: 'database', workspaceId, resourceId: id, actorId: userId });
}
