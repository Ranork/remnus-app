import { db } from '@/db';
import { agentActivity, databases, pages, workspaceItems } from '@/db/schema';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getAgentMetrics } from '@/lib/services/agentMetrics';

/**
 * A first home dashboard for a workspace nobody has calibrated yet (V2 R6-G) —
 * composed on the server from the databases the workspace already has, instead
 * of the empty grid the sidebar's "Pano" button used to open.
 *
 * The rule is the calibration guide's: **no zeros**. A block goes in only when it
 * would show something today — an open-items metric only if items are open, a
 * status bar only if there are at least two statuses to compare, activity only if an
 * agent has worked here, savings only if something was measured. A workspace with
 * nothing to show gets the note (and links, if it has items) and no filler.
 *
 * Everything is stored by id (database id, column id, exact option spelling), so
 * the spec passes the strict write gate as-is and survives renames.
 */

type Column = { id: string; name: string; type: string; options?: unknown[] };

/** Words for the stored block titles, in the creating user's language. */
export type HomeComposeLabels = {
  note: string;
  open: (database: string) => string;
  byStatus: (database: string) => string;
  nextDue: (database: string) => string;
  stillOpen: (database: string) => string;
  latest: (database: string) => string;
  whereToLook: string;
  agentActivity: string;
};

const STATUS_NAME = /^(status|state|stage|durum|aşama|asama|estado|statut|zustand|статус|状态|स्थिति)$/i;
const DONE_WORDS = /done|complete|closed|shipped|resolved|cancel|finished|merged|released|tamam|bitti|kapal|iptal|terminé|erledigt|hecho|готов|完成|पूर्ण|पूरा/i;

function optionEntries(column: Column): { value: string; group?: string }[] {
  return (column.options ?? [])
    .map((o) => {
      if (typeof o === 'string') return { value: o };
      if (o && typeof o === 'object' && typeof (o as { value?: unknown }).value === 'string') {
        const entry = o as { value: string; group?: unknown };
        return { value: entry.value, group: typeof entry.group === 'string' ? entry.group : undefined };
      }
      return null;
    })
    .filter((o): o is { value: string; group?: string } => o !== null);
}

/** The column that tracks lifecycle, and the values that mean "finished". */
function statusColumn(schema: Column[]): { column: Column; done: string[] } | null {
  const column =
    schema.find((c) => c.type === 'status') ??
    schema.find((c) => c.type === 'select' && STATUS_NAME.test(c.name.trim()));
  if (!column) return null;
  const options = optionEntries(column);
  const grouped = options.filter((o) => o.group === 'complete').map((o) => o.value);
  const done = grouped.length ? grouped : options.filter((o) => DONE_WORDS.test(o.value)).map((o) => o.value);
  return { column, done };
}

const dateColumn = (schema: Column[]) => schema.find((c) => c.type === 'date' || c.type === 'datetime') ?? null;

const clip = (text: string) => (text.length > 80 ? `${text.slice(0, 79)}…` : text);

export async function composeHomeDashboardBlocks(
  workspaceId: string,
  labels: HomeComposeLabels,
): Promise<Record<string, unknown>[]> {
  const [dbRows, topItems, [agentRow], metrics] = await Promise.all([
    db
      .select({
        id: databases.id,
        name: databases.name,
        schema: databases.schema,
        rows: sql<number>`(select count(*) from ${pages} where ${pages.databaseId} = ${databases.id})`,
      })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db
      .select({ id: workspaceItems.id, type: workspaceItems.type })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.workspaceId, workspaceId), isNull(workspaceItems.parentId)))
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt))
      .limit(12),
    db.select({ one: sql<number>`1` }).from(agentActivity).where(eq(agentActivity.workspaceId, workspaceId)).limit(1),
    getAgentMetrics({ workspaceId }),
  ]);

  // Databases with rows, biggest first: a workspace's main tracker is usually its largest.
  const candidates = dbRows
    .filter((d) => Number(d.rows) > 0)
    .map((d) => ({ ...d, schema: ((d.schema ?? []) as Column[]).filter((c) => c && typeof c.id === 'string') }))
    .sort((a, b) => Number(b.rows) - Number(a.rows));

  const withStatus = candidates
    .map((d) => ({ db: d, status: statusColumn(d.schema) }))
    .filter((x): x is { db: (typeof candidates)[number]; status: NonNullable<ReturnType<typeof statusColumn>> } => !!x.status)
    .slice(0, 2);

  const rowsByDb = new Map<string, Record<string, unknown>[]>();
  if (withStatus.length) {
    const rows = await db
      .select({ databaseId: pages.databaseId, properties: pages.properties })
      .from(pages)
      .where(inArray(pages.databaseId, withStatus.map((x) => x.db.id)));
    for (const row of rows) {
      const list = rowsByDb.get(row.databaseId) ?? [];
      list.push((row.properties ?? {}) as Record<string, unknown>);
      rowsByDb.set(row.databaseId, list);
    }
  }

  const note = { id: 'note', type: 'text', tone: 'info', width: 'full', markdown: labels.note };
  const metricsRow: Record<string, unknown>[] = [];
  const detail: Record<string, unknown>[] = [];

  withStatus.forEach(({ db: database, status }, index) => {
    const rows = rowsByDb.get(database.id) ?? [];
    const values = rows.map((r) => r[status.column.id]).filter((v) => v != null && v !== '').map(String);
    const openFilter = status.done.length
      ? [{ columnId: status.column.id, operator: 'not_equals', value: status.done.length === 1 ? status.done[0] : JSON.stringify(status.done) }]
      : [];
    const openCount = rows.filter((r) => !status.done.includes(String(r[status.column.id] ?? ''))).length;
    const suffix = index === 0 ? '' : `${index + 1}`;

    if (status.done.length && openCount > 0) {
      metricsRow.push({ id: `open${suffix}`, type: 'metric', title: clip(labels.open(database.name)), source: { databaseId: database.id, filters: openFilter } });
    }
    if (index > 0) return; // the second tracker gets its headline number only

    if (new Set(values).size >= 2) {
      detail.push({ id: 'mix', type: 'chart', variant: 'stack', title: clip(labels.byStatus(database.name)), groupBy: status.column.id, source: { databaseId: database.id } });
    }
    if (status.done.length && openCount > 0) {
      const due = dateColumn(database.schema);
      detail.push({
        id: 'next',
        type: 'list',
        title: clip(due ? labels.nextDue(database.name) : labels.stillOpen(database.name)),
        source: { databaseId: database.id, filters: openFilter },
        ...(due ? { sort: { columnId: due.id, direction: 'asc' } } : {}),
      });
    }
  });

  // No lifecycle anywhere: the newest entries of the biggest dated database, if any.
  if (!withStatus.length) {
    const dated = candidates.find((d) => dateColumn(d.schema));
    const due = dated && dateColumn(dated.schema);
    if (dated && due) {
      detail.push({ id: 'latest', type: 'list', title: clip(labels.latest(dated.name)), sort: { columnId: due.id, direction: 'desc' }, source: { databaseId: dated.id } });
    }
  }

  const footer: Record<string, unknown>[] = [];
  const linkable = topItems.filter((i) => i.type !== 'dashboard').slice(0, 6);
  if (linkable.length) {
    footer.push({ id: 'go', type: 'links', title: labels.whereToLook, width: 'half', items: linkable.map((i) => ({ itemId: i.id })) });
  }
  if (agentRow) footer.push({ id: 'agents', type: 'activity', title: labels.agentActivity, width: 'half' });
  if (metrics.savedBytes > 0) footer.push({ id: 'saved', type: 'savings', width: footer.length % 2 ? 'half' : 'full' });

  return fillRows([note, ...metricsRow, ...detail, ...footer]);
}

const SPAN = { quarter: 1, half: 2, full: 4 } as const;
const DEFAULT_SPAN: Record<string, keyof typeof SPAN> = { metric: 'quarter', links: 'quarter', database_embed: 'full', project: 'full' };
const spanOf = (b: Record<string, unknown>) => SPAN[(b.width as keyof typeof SPAN | undefined) ?? DEFAULT_SPAN[String(b.type)] ?? 'half'];

/**
 * Close the gaps a composed layout leaves on the desktop grid (four columns): a row
 * that ends short widens one of its blocks — a quarter to a half, a half to the full
 * row — so the page never shows a hole where a tile was left out for having nothing
 * to say.
 */
function fillRows(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[][] = [];
  let used = 4;
  for (const block of blocks) {
    const span = spanOf(block);
    if (used + span > 4) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(block);
    used += span;
  }
  for (const row of rows) {
    const gap = 4 - row.reduce((sum, b) => sum + spanOf(b), 0);
    if (gap <= 0) continue;
    const grow = [...row].reverse().find((b) => [1, 2, 4].includes(spanOf(b) + gap) && spanOf(b) + gap !== 3);
    if (grow) grow.width = spanOf(grow) + gap === 4 ? 'full' : 'half';
  }
  return blocks;
}
