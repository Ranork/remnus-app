import { z } from 'zod';
import {
  DASHBOARD_BLOCK_CATALOG,
  DASHBOARD_SPEC_VERSION,
  MAX_DASHBOARD_BLOCKS,
  activityBlockSchema,
  chartBlockSchema,
  databaseEmbedBlockSchema,
  linksBlockSchema,
  listBlockSchema,
  metricBlockSchema,
  textBlockSchema,
  validateDashboardSpec,
  type DashboardBlockType,
} from './schema';

/**
 * The block catalog an agent reads before building a dashboard — served as the
 * MCP resource `remnus://dashboard/catalog`, deliberately NOT embedded in the
 * tool schemas: `tools/list` is paid by every session, this only by the ones
 * that build a dashboard.
 *
 * Field signatures are derived from the zod schemas themselves
 * (`z.toJSONSchema`), and summaries come from `DASHBOARD_BLOCK_CATALOG`, so the
 * catalog cannot drift from what the write gate accepts. The only hand-written
 * parts are the rules zod cannot express (`NOTES`) and the templates, which are
 * run through the strict write gate before they are served (an invalid one is
 * logged and left out rather than taught to an agent).
 * `docs/mcp/dashboards.md` is the human-facing copy of the same content.
 */

const SCHEMAS: Record<DashboardBlockType, z.ZodType> = {
  metric: metricBlockSchema,
  chart: chartBlockSchema,
  database_embed: databaseEmbedBlockSchema,
  list: listBlockSchema,
  text: textBlockSchema,
  links: linksBlockSchema,
  activity: activityBlockSchema,
};

/** Rules a JSON schema cannot carry (refinements, runtime semantics). */
const NOTES: Partial<Record<DashboardBlockType, string>> = {
  metric: 'columnId is required unless aggregate is count; trend compares the last `days` with the `days` before, by a date column.',
  chart: 'groupBy a date column + bucket gives a time axis; valueColumnId is required when aggregate is sum; categories past `limit` collapse into "Other".',
  database_embed: 'viewId: a table or kanban view id or name (get_database_schema lists them); omitted = the first one. The view is shown as saved.',
  list: 'Rows in database order unless `sort`; showColumns adds up to 3 property columns.',
  text: 'Headings, **bold**, _italic_, `code`, links and simple lists. Long content belongs on a page.',
  links: 'itemId: any page, database or dashboard of this workspace.',
};

/** Fields every block shares; listed once instead of in every signature. */
const COMMON = new Set(['id', 'type', 'title', 'width']);

type JsonSchema = {
  type?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  maxItems?: number;
};

function describeField(schema: JsonSchema): string {
  if (schema.enum) return schema.enum.join('|');
  if (schema.type === 'object' && schema.properties) return `{${describeFields(schema)}}`;
  if (schema.type === 'array' && schema.items) {
    return `[${describeField(schema.items)}]${schema.maxItems != null ? ` ≤${schema.maxItems}` : ''}`;
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return schema.minimum != null && schema.maximum != null ? `${schema.minimum}-${schema.maximum}` : 'number';
  }
  if (schema.type === 'string') return schema.maxLength != null ? `text ≤${schema.maxLength}` : 'string';
  return schema.type ?? 'any';
}

function describeFields(schema: JsonSchema, skip?: Set<string>): string {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {})
    .filter(([name]) => !skip?.has(name))
    .map(([name, field]) => {
      // `source` is explained once in the rules; its nested shape would only repeat.
      const shape = name === 'source' ? '' : `: ${describeField(field)}`;
      const fallback = field.default !== undefined ? ` (default ${field.default})` : '';
      return `${name}${required.has(name) ? '*' : ''}${shape}${fallback}`;
    })
    .join(', ');
}

/** `metric: source*, aggregate: count|sum|avg|min|max (default count), …` */
export function blockSignature(type: DashboardBlockType): string {
  const schema = z.toJSONSchema(SCHEMAS[type], { io: 'input' }) as JsonSchema;
  return describeFields(schema, COMMON) || '(no fields beyond the common ones)';
}

// ── Templates ────────────────────────────────────────────────────────────────

/**
 * Skeletons an agent fills in instead of designing from scratch. Placeholders:
 * `$DB` a databaseId; `$STATUS`, `$OWNER`, `$DATE` column names; `$DONE` the
 * status value meaning finished. Column fields accept names, so a skeleton
 * needs no schema lookup beyond knowing which columns exist.
 */
export const DASHBOARD_TEMPLATES: { key: string; name: string; needs: string; blocks: Record<string, unknown>[] }[] = [
  {
    key: 'project-status',
    name: 'Project status',
    needs: '$DB, $STATUS, $DONE',
    blocks: [
      { id: 'open', type: 'metric', title: 'Open', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'not_equals', value: '$DONE' }] } },
      { id: 'done', type: 'metric', title: 'Done', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'equals', value: '$DONE' }] } },
      { id: 'total', type: 'metric', title: 'All', source: { databaseId: '$DB' } },
      { id: 'mix', type: 'chart', title: 'By status', variant: 'donut', groupBy: '$STATUS', source: { databaseId: '$DB' } },
      { id: 'next', type: 'list', title: 'Still open', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'not_equals', value: '$DONE' }] } },
    ],
  },
  {
    key: 'backlog-health',
    name: 'Backlog health',
    needs: '$DB, $STATUS, $DONE, $OWNER',
    blocks: [
      { id: 'open', type: 'metric', title: 'Open items', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'not_equals', value: '$DONE' }] } },
      { id: 'noowner', type: 'metric', title: 'No owner', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'not_equals', value: '$DONE' }, { columnId: '$OWNER', operator: 'is_empty' }] } },
      { id: 'owners', type: 'chart', title: 'Open by owner', variant: 'bar', groupBy: '$OWNER', source: { databaseId: '$DB', filters: [{ columnId: '$STATUS', operator: 'not_equals', value: '$DONE' }] } },
      { id: 'triage', type: 'list', title: 'Needs an owner', limit: 8, source: { databaseId: '$DB', filters: [{ columnId: '$OWNER', operator: 'is_empty' }] } },
    ],
  },
  {
    key: 'weekly-pulse',
    name: 'Weekly pulse',
    needs: '$DB, $DATE',
    blocks: [
      { id: 'items', type: 'metric', title: 'Items', trend: { columnId: '$DATE', days: 7 }, source: { databaseId: '$DB' } },
      { id: 'flow', type: 'chart', title: 'Per week', variant: 'line', groupBy: '$DATE', bucket: 'week', source: { databaseId: '$DB' } },
      { id: 'latest', type: 'list', title: 'Latest', sort: { columnId: '$DATE', direction: 'desc' }, source: { databaseId: '$DB' } },
      { id: 'agents', type: 'activity', title: 'Agent activity' },
    ],
  },
];

// ── Resource text ────────────────────────────────────────────────────────────

let cached: string | null = null;

/** The catalog as compact markdown. Static per build, so rendered once. */
export function renderDashboardCatalog(): string {
  if (cached) return cached;
  const lines: string[] = [
    `# Dashboard catalog (spec v${DASHBOARD_SPEC_VERSION})`,
    '',
    'A dashboard is a JSON list of blocks that read LIVE from this workspace\'s databases — no HTML, no data copied in.',
    'create_dashboard({title, parentId?, icon?, blocks}) builds one; update_dashboard({dashboardId, add?, update?, remove?, order?}) patches blocks by id — never resend the whole spec. get_page(id) reads it back.',
    '',
    '## Rules',
    `- Every block: {id, type, title?: text ≤80, width?: quarter|half|full}. id: 1-32 of A-Z a-z 0-9 _ -, unique; omit it and one is generated (returned). Max ${MAX_DASHBOARD_BLOCKS} blocks.`,
    '- width is a span of a 4-column grid (phones: full). Default: metric/links quarter, database_embed full, others half.',
    '- source: {databaseId*, filters?}. databaseId: from the workspace map (either id of a database works).',
    '- Column fields (columnId, groupBy, valueColumnId, sort.columnId, showColumns, filters[].columnId) take a column id or name, case-insensitive; the id is stored.',
    '- filters (≤8, all must match): {columnId*, operator*: equals|not_equals|contains|not_contains|is_empty|is_not_empty, value?}. value is a string; \'["A","B"]\' matches any of them. Select/status values must be exact options (case is fixed for you).',
    '- The write result lists warnings for blocks that will render empty or broken (unknown column, no matching rows). Read them; you cannot see the screen.',
    '',
    '## Blocks (* = required)',
  ];
  for (const entry of DASHBOARD_BLOCK_CATALOG) {
    lines.push('', `### ${entry.type}`, `${entry.summary} ${entry.use}`, `Fields: ${blockSignature(entry.type)}`);
    const note = NOTES[entry.type];
    if (note) lines.push(`Note: ${note}`);
  }
  lines.push(
    '',
    '## Templates',
    'Fill the placeholders ($DB a databaseId; $STATUS/$OWNER/$DATE column names; $DONE the finished status value), drop blocks whose column the database lacks, then pass `blocks` to create_dashboard.',
  );
  for (const tpl of DASHBOARD_TEMPLATES) {
    const check = validateDashboardSpec({ version: DASHBOARD_SPEC_VERSION, blocks: tpl.blocks });
    if (!check.ok) {
      console.error(`[dashboard/catalog] template "${tpl.key}" fails the spec and is not served: ${check.error}`);
      continue;
    }
    lines.push('', `### ${tpl.key} — ${tpl.name} (needs ${tpl.needs})`, JSON.stringify(tpl.blocks));
  }
  cached = lines.join('\n');
  return cached;
}
