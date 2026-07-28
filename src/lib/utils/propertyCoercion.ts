import { SELECT_COLOR_ORDER, normalizeOption, type SelectOption, type SelectOptionColor } from '@/lib/types/properties';

export interface DatabaseColumn {
  id: string;
  name: string;
  type: string;
  options?: (string | SelectOption)[];
  [key: string]: unknown;
}

export interface CoerceRowResult {
  // Resolved properties keyed by column id, ready to merge into `pages.properties`.
  properties: Record<string, unknown>;
  // Every matched column's raw trimmed input value, keyed by column id — including
  // columns that are never written (`id`, `user`, `multi_user`). Lets callers match
  // rows by a non-writable column (e.g. the row's real primary key) without needing
  // the coerced/written value.
  rawByColumnId: Record<string, string>;
  // Select/multi_select/status values not present in the column's current options,
  // keyed by column id — callers decide whether/how to append them to the schema.
  newOptionsByColumn: Map<string, string[]>;
  // Column names whose values were present in the row but couldn't be written
  // (`id` — always server-generated — and `user`/`multi_user`, whose member
  // resolution isn't supported here).
  skippedColumns: string[];
}

const CHECKBOX_TRUE_RE = /^(yes|true|☑|✓|checked|evet)$/i;

// Bulk-pasted dates are free-form text, not Notion's specific export format, so this
// accepts ISO strings as-is and otherwise falls back to whatever `Date` can parse.
function normalizeDateValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(trimmed)) return trimmed;

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hasTime = /\d{1,2}:\d{2}/.test(trimmed);
  if (!hasTime) return `${yyyy}-${mm}-${dd}`;

  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function buildNameToColumnMap(schema: DatabaseColumn[]): Map<string, DatabaseColumn> {
  return new Map(schema.map((col) => [col.name.trim().toLowerCase(), col]));
}

// Resolves a pasted row (header name -> raw string) into schema-column-id-keyed,
// type-coerced properties. Headers that don't match any column name (case-insensitive)
// are silently ignored — the caller's preview step is responsible for surfacing that.
export function coerceRowValues(schema: DatabaseColumn[], rawRow: Record<string, unknown>): CoerceRowResult {
  const nameToCol = buildNameToColumnMap(schema);
  const properties: Record<string, unknown> = {};
  const rawByColumnId: Record<string, string> = {};
  const newOptionsByColumn = new Map<string, string[]>();
  const skippedColumns: string[] = [];

  for (const [key, rawValue] of Object.entries(rawRow)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    const col = nameToCol.get(trimmedKey.toLowerCase());
    if (!col) continue;

    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (value === '' || value == null) continue;

    rawByColumnId[col.id] = String(value);

    // The row's real primary key is always server-generated — never settable via
    // paste, but still useful as a precise match key in update mode (see rawByColumnId).
    if (col.type === 'id') {
      if (!skippedColumns.includes(col.name)) skippedColumns.push(col.name);
      continue;
    }

    if (col.type === 'user' || col.type === 'multi_user') {
      if (!skippedColumns.includes(col.name)) skippedColumns.push(col.name);
      continue;
    }

    if (col.type === 'checkbox') {
      properties[col.id] = CHECKBOX_TRUE_RE.test(String(value)) ? 'true' : 'false';
    } else if (col.type === 'number') {
      const n = Number(String(value).replace(/,/g, ''));
      if (!Number.isNaN(n)) properties[col.id] = n;
    } else if (col.type === 'date' || col.type === 'datetime') {
      properties[col.id] = normalizeDateValue(String(value));
    } else if (col.type === 'multi_select') {
      const values = String(value).split(',').map((v) => v.trim()).filter(Boolean);
      const existing = new Set((col.options ?? []).map((o) => normalizeOption(o).value));
      const fresh = values.filter((v) => !existing.has(v));
      if (fresh.length) newOptionsByColumn.set(col.id, [...(newOptionsByColumn.get(col.id) ?? []), ...fresh]);
      properties[col.id] = values;
    } else if (col.type === 'select' || col.type === 'status') {
      const strValue = String(value);
      const existing = new Set((col.options ?? []).map((o) => normalizeOption(o).value));
      if (!existing.has(strValue)) {
        newOptionsByColumn.set(col.id, [...(newOptionsByColumn.get(col.id) ?? []), strValue]);
      }
      properties[col.id] = strValue;
    } else {
      // text, url, email, phone — pass through as-is
      properties[col.id] = String(value);
    }
  }

  return { properties, rawByColumnId, newOptionsByColumn, skippedColumns };
}

const OPTION_PALETTE = SELECT_COLOR_ORDER.filter((c) => c !== 'default') as SelectOptionColor[];

function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assigns colors from a shuffled palette so newly auto-created options don't all
// come out in the same fixed order (mirrors src/app/api/import/notion/route.ts).
export function assignOptionColors(values: string[]): SelectOption[] {
  let bag = shuffled(OPTION_PALETTE);
  let idx = 0;
  return values.map((value) => {
    if (idx >= bag.length) { bag = shuffled(OPTION_PALETTE); idx = 0; }
    return { value, color: bag[idx++] };
  });
}
