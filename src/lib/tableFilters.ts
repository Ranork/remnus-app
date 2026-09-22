import type { ViewFilter, ViewSort } from '@/lib/types/views';

/**
 * Row filtering and sorting for database views — extracted from
 * `DatabaseView.tsx` so the dashboard renderer (a SERVER component) can apply
 * exactly the same semantics without importing a client module.
 *
 * Two copies of these rules would drift, and a filter that selects one set of
 * rows in a database view and a different set in a dashboard metric is worse
 * than no filter at all. Pure functions, no React, no server/client marker.
 */

/** Only the fields the evaluation actually reads — a dashboard filter has no `id`. */
export type FilterSpec = Pick<ViewFilter, 'columnId' | 'operator'> & { value?: string };
export type SortSpec = Pick<ViewSort, 'columnId' | 'direction'>;

type RowLike = { properties: Record<string, unknown> };

export function applyFilters<T extends RowLike>(rows: T[], filters: FilterSpec[]): T[] {
  if (!filters.length) return rows;
  return rows.filter((page) =>
    filters.every((f) => {
      const raw = page.properties[f.columnId];
      const str = raw == null ? '' : Array.isArray(raw) ? raw.join(' ') : String(raw);

      if (f.operator === 'is_empty') {
        return !raw || str === '' || (Array.isArray(raw) && !raw.length);
      }
      if (f.operator === 'is_not_empty') {
        return !!raw && str !== '' && (!Array.isArray(raw) || raw.length > 0);
      }

      let targetValues: string[] = [];
      if (f.value) {
        if (f.value.startsWith('[') && f.value.endsWith(']')) {
          try {
            targetValues = JSON.parse(f.value);
          } catch {
            targetValues = [f.value];
          }
        } else {
          targetValues = [f.value];
        }
      }

      if (targetValues.length === 0) {
        // Empty filters should usually not filter out everything, but for select lists we want it to match nothing
        return false;
      }

      switch (f.operator) {
        case 'equals': {
          if (Array.isArray(raw)) {
            return raw.some((v) => targetValues.includes(String(v)));
          }
          return targetValues.includes(String(raw));
        }
        case 'not_equals': {
          if (Array.isArray(raw)) {
            return !raw.some((v) => targetValues.includes(String(v)));
          }
          return !targetValues.includes(String(raw));
        }
        case 'contains': {
          if (Array.isArray(raw)) {
            return raw.some((v) => targetValues.some((tv) => String(v).toLowerCase().includes(tv.toLowerCase())));
          }
          return targetValues.some((tv) => String(raw).toLowerCase().includes(tv.toLowerCase()));
        }
        case 'not_contains': {
          if (Array.isArray(raw)) {
            return !raw.some((v) => targetValues.some((tv) => String(v).toLowerCase().includes(tv.toLowerCase())));
          }
          return !targetValues.some((tv) => String(raw).toLowerCase().includes(tv.toLowerCase()));
        }
        default:
          return true;
      }
    }),
  );
}

export function applySorts<T extends RowLike>(rows: T[], sorts: SortSpec[]): T[] {
  if (!sorts.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const aV = a.properties[s.columnId];
      const bV = b.properties[s.columnId];
      const aStr = aV == null ? '' : String(aV);
      const bStr = bV == null ? '' : String(bV);
      const cmp = aStr.localeCompare(bStr, 'en');
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}
