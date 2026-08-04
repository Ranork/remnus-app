import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { databases } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { normalizeNotionDate, type ImportItem, type ImportSpacePayload } from '@/lib/import/notion-parser';
import { createPageInWorkspace, createDatabaseInWorkspace } from '@/lib/services/workspace';
import { SELECT_COLOR_ORDER, type SelectOptionColor } from '@/lib/types/properties';
import { createImportedWorkspaceForUser } from '@/lib/import/workspace-import';

// ── Import flow ──────────────────────────────────────────────────────────────────
// The Notion export ZIP is parsed ENTIRELY in the browser (JSZip) and images are
// uploaded individually from the browser straight to Cloudinary. This route only
// receives the final, fully-materialized JSON tree (content already contains real
// image URLs) and writes it to the DB — so the (potentially huge) ZIP never has to
// be uploaded anywhere, sidestepping both Vercel's 4.5 MB body limit and
// Cloudinary's 10 MB single-file limit. The client sends one request per space.

const PALETTE = SELECT_COLOR_ORDER.filter(c => c !== 'default') as SelectOptionColor[];

// Fisher–Yates shuffle (returns a new array).
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assign colors from a per-column shuffled palette so options don't always come
// out in the fixed red→orange→yellow→green order. Colors stay distinct until the
// palette is exhausted, then it reshuffles and cycles.
function assignColors(options: string[]): { value: string; color: SelectOptionColor }[] {
  let bag = shuffled(PALETTE);
  let idx = 0;
  return options.map(value => {
    if (idx >= bag.length) { bag = shuffled(PALETTE); idx = 0; }
    return { value, color: bag[idx++] };
  });
}

const ICON_PALETTE = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
function randomIconColor(): string {
  return ICON_PALETTE[Math.floor(Math.random() * ICON_PALETTE.length)];
}

// Notion's CSV export carries no view metadata, so infer useful views from the
// column types: always a Table, plus a Kanban grouped by the first select column
// and a Calendar on the first date column when present. Returns null (→ default
// Table) when there's nothing extra to add.
function inferViews(schema: { id: string; name: string; type: string }[]) {
  const uid = () => crypto.randomUUID().slice(0, 8);
  const selects = schema.filter(c => c.type === 'select');
  const firstSelect = selects[0];
  const firstDate = schema.find(c => c.type === 'date' || c.type === 'datetime');
  if (!firstSelect && !firstDate) return null;

  const views: any[] = [
    { id: uid(), name: 'Table', config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center' } },
  ];

  if (firstSelect) {
    // Background tint from groupByCol so each card visually belongs to its column.
    // Accent line from a different select when possible to add extra info.
    const cardColorCol = (selects.find(c => c.id !== firstSelect.id) ?? firstSelect).id;
    views.push({
      id: uid(),
      name: 'Board',
      config: {
        type: 'kanban', groupByCol: firstSelect.id, groupOrder: [], filters: [], sorts: [],
        openBehavior: 'center', cardBgCol: firstSelect.id, cardColorCol, groupColBg: true,
      },
    });
  }

  if (firstDate) {
    const cardProperties = schema
      .filter(c => c.id !== 'title' && c.id !== firstDate.id && c.type !== 'date' && c.type !== 'datetime')
      .slice(0, 2)
      .map(c => c.id);
    views.push({
      id: uid(),
      name: 'Calendar',
      config: {
        type: 'calendar', dateCol: firstDate.id, viewMode: 'month', filters: [], sorts: [],
        openBehavior: 'center',
        ...(firstSelect ? { cardBgCol: firstSelect.id, cardColorCol: firstSelect.id } : {}),
        ...(cardProperties.length ? { cardProperties } : {}),
      },
    });
  }

  return views;
}

async function importItems(
  items: ImportItem[],
  workspaceId: string,
  parentId: string | undefined,
  counters: { pages: number; databases: number; rows: number },
) {
  for (const item of items) {
    if (item.type === 'page') {
      const result = await createPageInWorkspace(workspaceId, {
        title: item.title || 'Untitled',
        content: item.content,
        parentId,
        iconColor: randomIconColor(),
      });
      counters.pages++;
      if (item.children.length > 0) {
        await importItems(item.children, workspaceId, result.id, counters);
      }
    } else {
      const { databaseId } = await createDatabaseInWorkspace(workspaceId, {
        name: item.title || 'Untitled',
        parentId,
        iconColor: randomIconColor(),
        schema: item.columns.length > 0
          ? item.columns.map(col => ({
              name: col.name,
              type: col.type,
              ...(col.options ? { options: assignColors(col.options) } : {}),
            }))
          : undefined,
      });
      counters.databases++;

      // Fetch schema to map column names → generated IDs.
      const [dbRecord] = await db
        .select({ schema: databases.schema })
        .from(databases)
        .where(eq(databases.id, databaseId))
        .limit(1);
      const resolvedSchema = (dbRecord?.schema ?? []) as { id: string; name: string; type: string }[];
      const nameToId = new Map<string, string>();
      const idToType = new Map<string, string>();
      for (const col of resolvedSchema) {
        nameToId.set(col.name, col.id);
        idToType.set(col.id, col.type);
      }

      // Auto-create Kanban/Calendar views inferred from the column types.
      const views = inferViews(resolvedSchema);
      if (views) {
        await db.update(databases).set({ views }).where(eq(databases.id, databaseId));
      }

      const firstColName = item.columns[0]?.name ?? 'Title';
      for (const row of item.rows) {
        const properties: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(row.properties)) {
          if (k === firstColName || !v) continue;
          const colId = nameToId.get(k);
          if (!colId) continue;
          const colType = idToType.get(colId);
          if (colType === 'multi_select') {
            properties[colId] = v.split(',').map(s => s.trim()).filter(Boolean);
          } else if (colType === 'checkbox') {
            properties[colId] = /^(yes|true|☑|✓|checked)$/i.test(v) ? 'true' : 'false';
          } else if (colType === 'date' || colType === 'datetime') {
            properties[colId] = normalizeNotionDate(v);
          } else {
            properties[colId] = v;
          }
        }

        await createPageInWorkspace(workspaceId, {
          databaseId,
          title: row.title || 'Untitled',
          content: row.content,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        });
        counters.rows++;
      }
    }
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { space?: ImportSpacePayload } | null;
    const space = body?.space;
    if (!space || typeof space.name !== 'string' || !Array.isArray(space.items)) {
      return NextResponse.json({ error: 'Invalid import payload' }, { status: 400 });
    }

    const workspaceId = await createImportedWorkspaceForUser(user.id, space.name);
    const counters = { pages: 0, databases: 0, rows: 0 };
    await importItems(space.items, workspaceId, undefined, counters);

    return NextResponse.json({ ok: true, name: space.name, workspaceId, imported: counters });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('[import/notion]', err);
    return NextResponse.json({ error: err?.message ?? 'Import failed' }, { status: 500 });
  }
}
