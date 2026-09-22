import { z } from 'zod';

/**
 * Dashboard spec — the ONE source of truth for what a dashboard is.
 *
 * Used by the server renderer (`src/lib/dashboard/data.ts` +
 * `src/components/features/dashboard/`) and, from P7 on, by the MCP write
 * tools. There is deliberately no second schema anywhere: a block shape the
 * renderer understands is exactly a block shape an agent may write.
 *
 * Two invariants the rest of the feature leans on:
 *
 *  1. **Every block carries a stable `id`.** Patching happens by id, never by
 *     array position — an update tool that trusted the order would corrupt a
 *     dashboard the moment two writers reordered blocks.
 *  2. **Blocks name a data SOURCE, never the data.** `databaseId` + filters,
 *     resolved at render time. Embedding rows would make a dashboard stale the
 *     day it was written, which is the one thing a status screen may not be.
 *
 * Objects are strict: an unknown field is a rejected write, not a silently
 * dropped one. Reads are lenient per block — see `parseDashboardSpec`.
 */

export const DASHBOARD_SPEC_VERSION = 1;

/** Short, URL-safe, human-typable. Agents generate these; collisions are rejected. */
export const dashboardBlockIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,32}$/, 'Block id must be 1-32 chars of A-Z a-z 0-9 _ -');

/** Grid span on a 4-column desktop grid; everything is full width on mobile. */
export const dashboardWidthSchema = z.enum(['quarter', 'half', 'full']);
export type DashboardWidth = z.infer<typeof dashboardWidthSchema>;

/** Same operator set the database views use (`src/lib/types/views.ts`), so a
 *  filter written for a view behaves identically inside a dashboard block. */
export const dashboardFilterSchema = z.strictObject({
  columnId: z.string().min(1),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']),
  /** Omitted for is_empty / is_not_empty. A JSON array string matches any of its values. */
  value: z.string().optional(),
});
export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;

/** Where a block's numbers come from. Always one database of THIS workspace. */
export const dashboardSourceSchema = z.strictObject({
  databaseId: z.string().min(1),
  filters: z.array(dashboardFilterSchema).max(8).optional(),
});
export type DashboardSource = z.infer<typeof dashboardSourceSchema>;

const baseFields = {
  id: dashboardBlockIdSchema,
  /** Heading shown above the block. Omit for an untitled tile. */
  title: z.string().max(80).optional(),
  width: dashboardWidthSchema.optional(),
};

// -- metric -------------------------------------------------------------------
export const metricBlockSchema = z
  .strictObject({
    ...baseFields,
    type: z.literal('metric'),
    source: dashboardSourceSchema,
    aggregate: z.enum(['count', 'sum', 'avg', 'min', 'max']).default('count'),
    /** Required for every aggregate except `count`. */
    columnId: z.string().min(1).optional(),
    /** Short suffix shown after the number, e.g. "open" or "h". */
    unit: z.string().max(16).optional(),
    /** Compares the last `days` against the `days` before them, using a date column. */
    trend: z
      .strictObject({ columnId: z.string().min(1), days: z.number().int().min(1).max(365) })
      .optional(),
  })
  .refine((b) => b.aggregate === 'count' || !!b.columnId, {
    message: 'columnId is required unless aggregate is "count"',
    path: ['columnId'],
  });

// -- chart --------------------------------------------------------------------
export const chartBlockSchema = z
  .strictObject({
    ...baseFields,
    type: z.literal('chart'),
    source: dashboardSourceSchema,
    variant: z.enum(['bar', 'line', 'donut']),
    /** Column whose values become the categories (or, for a date column, the axis). */
    groupBy: z.string().min(1),
    /** Only meaningful when `groupBy` is a date/datetime column. */
    bucket: z.enum(['day', 'week', 'month']).optional(),
    aggregate: z.enum(['count', 'sum']).default('count'),
    /** Required when aggregate is "sum". */
    valueColumnId: z.string().min(1).optional(),
    /** Categories to keep; the rest collapse into "Other". Ignored for date axes. */
    limit: z.number().int().min(2).max(12).default(8),
  })
  .refine((b) => b.aggregate !== 'sum' || !!b.valueColumnId, {
    message: 'valueColumnId is required when aggregate is "sum"',
    path: ['valueColumnId'],
  });

// -- database_embed -----------------------------------------------------------
export const databaseEmbedBlockSchema = z.strictObject({
  ...baseFields,
  type: z.literal('database_embed'),
  databaseId: z.string().min(1),
  /** A saved view of that database (table or kanban). Omitted = its first view. */
  viewId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

// -- list ---------------------------------------------------------------------
export const listBlockSchema = z.strictObject({
  ...baseFields,
  type: z.literal('list'),
  source: dashboardSourceSchema,
  limit: z.number().int().min(1).max(20).default(5),
  sort: z.strictObject({ columnId: z.string().min(1), direction: z.enum(['asc', 'desc']) }).optional(),
  /** Up to 3 property columns shown next to each row's title. */
  showColumns: z.array(z.string().min(1)).max(3).optional(),
});

// -- text ---------------------------------------------------------------------
export const textBlockSchema = z.strictObject({
  ...baseFields,
  type: z.literal('text'),
  /** Short markdown: headings, bold/italic/code, links and simple lists. */
  markdown: z.string().min(1).max(2000),
  tone: z.enum(['default', 'info', 'warning']).default('default'),
});

// -- links --------------------------------------------------------------------
export const linksBlockSchema = z.strictObject({
  ...baseFields,
  type: z.literal('links'),
  items: z
    .array(
      z.strictObject({
        /** A workspace item id (page, database or dashboard) of this workspace. */
        itemId: z.string().min(1),
        /** Overrides the item's own title in the link. */
        label: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(12),
});

// -- activity -----------------------------------------------------------------
export const activityBlockSchema = z.strictObject({
  ...baseFields,
  type: z.literal('activity'),
  limit: z.number().int().min(1).max(20).default(6),
});

export const dashboardBlockSchema = z.discriminatedUnion('type', [
  metricBlockSchema,
  chartBlockSchema,
  databaseEmbedBlockSchema,
  listBlockSchema,
  textBlockSchema,
  linksBlockSchema,
  activityBlockSchema,
]);

export type DashboardBlock = z.infer<typeof dashboardBlockSchema>;
export type DashboardBlockType = DashboardBlock['type'];
export type MetricBlock = z.infer<typeof metricBlockSchema>;
export type ChartBlock = z.infer<typeof chartBlockSchema>;
export type DatabaseEmbedBlock = z.infer<typeof databaseEmbedBlockSchema>;
export type ListBlock = z.infer<typeof listBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type LinksBlock = z.infer<typeof linksBlockSchema>;
export type ActivityBlock = z.infer<typeof activityBlockSchema>;

export const MAX_DASHBOARD_BLOCKS = 40;

/** Strict, all-or-nothing. This is the WRITE gate (web actions today, MCP in P7). */
export const dashboardSpecSchema = z
  .strictObject({
    version: z.literal(DASHBOARD_SPEC_VERSION),
    blocks: z.array(dashboardBlockSchema).max(MAX_DASHBOARD_BLOCKS),
  })
  .superRefine((spec, ctx) => {
    const seen = new Set<string>();
    spec.blocks.forEach((block, i) => {
      if (seen.has(block.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate block id "${block.id}" - ids are how blocks are patched, so they must be unique`,
          path: ['blocks', i, 'id'],
        });
      }
      seen.add(block.id);
    });
  });

export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;

export const EMPTY_DASHBOARD_SPEC: DashboardSpec = { version: DASHBOARD_SPEC_VERSION, blocks: [] };

/** Default grid span per type, when a block doesn't state one. */
const DEFAULT_WIDTH: Record<DashboardBlockType, DashboardWidth> = {
  metric: 'quarter',
  chart: 'half',
  database_embed: 'full',
  list: 'half',
  text: 'half',
  links: 'quarter',
  activity: 'half',
};

export function blockWidth(block: DashboardBlock): DashboardWidth {
  return block.width ?? DEFAULT_WIDTH[block.type];
}

// -- Lenient read -------------------------------------------------------------

export type ParsedBlock =
  | { ok: true; block: DashboardBlock }
  | { ok: false; id: string | null; error: string };

export type ParsedDashboardSpec = {
  /** null when the document isn't a dashboard spec at all (not just a bad block). */
  version: number | null;
  blocks: ParsedBlock[];
  /** Set when the whole document was unreadable; `blocks` is then empty. */
  fatal?: string;
};

function issuesToMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

/**
 * Read a stored spec WITHOUT letting one bad block take the page down. An
 * unknown `type`, a field the catalog doesn't define, a number out of range —
 * each costs exactly its own tile, which renders as "this block could not be
 * read". The strict `dashboardSpecSchema` above is what refuses to *store*
 * such a block in the first place; this exists for specs that predate a rule,
 * or that were written straight into the database.
 */
export function parseDashboardSpec(raw: unknown): ParsedDashboardSpec {
  let doc = raw;
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc);
    } catch {
      return { version: null, blocks: [], fatal: 'Spec is not valid JSON' };
    }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { version: null, blocks: [], fatal: 'Spec is not an object' };
  }

  const shell = doc as { version?: unknown; blocks?: unknown };
  const version = typeof shell.version === 'number' ? shell.version : null;
  if (version !== DASHBOARD_SPEC_VERSION) {
    return { version, blocks: [], fatal: `Unsupported spec version: ${String(shell.version)}` };
  }
  if (!Array.isArray(shell.blocks)) {
    return { version, blocks: [], fatal: 'Spec has no blocks array' };
  }

  const blocks: ParsedBlock[] = shell.blocks.slice(0, MAX_DASHBOARD_BLOCKS).map((entry) => {
    const result = dashboardBlockSchema.safeParse(entry);
    if (result.success) return { ok: true, block: result.data };
    const id =
      entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
        ? (entry as { id: string }).id
        : null;
    return { ok: false, id, error: issuesToMessage(result.error) };
  });

  return { version, blocks };
}

/** Strict validation for a write. Returns the parsed spec or a readable reason. */
export function validateDashboardSpec(
  raw: unknown,
): { ok: true; spec: DashboardSpec } | { ok: false; error: string } {
  const result = dashboardSpecSchema.safeParse(raw);
  if (result.success) return { ok: true, spec: result.data };
  return { ok: false, error: issuesToMessage(result.error) };
}

// -- Catalog ------------------------------------------------------------------

/**
 * What an agent is told each block does. Kept beside the schema on purpose:
 * P7 serves this verbatim as the block catalog, and a description that lives
 * apart from the shape it describes drifts from it. English only, like every
 * other MCP-facing string — this is not UI copy.
 */
export const DASHBOARD_BLOCK_CATALOG: { type: DashboardBlockType; summary: string; use: string }[] = [
  {
    type: 'metric',
    summary: 'One number from a database - a count, sum, average, min or max, with an optional label and trend arrow.',
    use: 'Open items, total budget, average score. Use `trend` with a date column to show the change against the previous period.',
  },
  {
    type: 'chart',
    summary: 'A bar, line or donut chart of one database grouped by one column.',
    use: 'Status breakdowns (donut), per-owner totals (bar), volume over time (line + a date column with `bucket`).',
  },
  {
    type: 'database_embed',
    summary: 'A saved view of an existing database, rendered inline as its real table or kanban board.',
    use: 'When the rows themselves are the answer. Point `viewId` at a view that is already filtered the way you want.',
  },
  {
    type: 'list',
    summary: 'The first N rows of a filtered query as a compact list of titles.',
    use: 'Open decisions, next deadlines, blocked tasks - short lists a reader scans rather than studies.',
  },
  {
    type: 'text',
    summary: 'A short markdown block: heading, explanation or warning.',
    use: 'Say what the dashboard is for, or annotate a number. Long-form content belongs on a page, not here.',
  },
  {
    type: 'links',
    summary: 'Quick links to chosen pages, databases or dashboards of this workspace.',
    use: 'The three or four places a reader goes next after looking at the numbers.',
  },
  {
    type: 'activity',
    summary: 'The most recent agent activity in this workspace.',
    use: 'Showing what the agents have been doing, and when they last touched the workspace.',
  },
];
