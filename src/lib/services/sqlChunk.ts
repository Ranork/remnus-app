/**
 * Multi-row-insert sizing for the bulk write paths.
 *
 * A multi-row `insert().values([...])` binds one parameter per column per row,
 * and SQLite refuses a statement past its bind-parameter ceiling. Older builds
 * cap at 999; newer ones allow far more, so 900 is a deliberately conservative
 * budget that holds everywhere rather than a measured limit.
 *
 * Callers pass the number of columns their rows actually bind — count the keys
 * Drizzle will emit (a `$defaultFn` column binds too; a column left to its SQL
 * default does not), and round up rather than down if the row shape varies.
 */
const MAX_BIND_PARAMS = 900;

export function chunkRows<T>(rows: T[], columnsPerRow: number): T[][] {
  if (rows.length === 0) return [];
  const size = Math.max(1, Math.floor(MAX_BIND_PARAMS / Math.max(1, columnsPerRow)));
  if (rows.length <= size) return [rows];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
