export const UNCATEGORIZED_TABLE_GROUP = 'Uncategorized';
export const NO_TABLE_GROUPING_VALUE = '';

type DatabaseColumn = {
  id?: string;
  type?: string;
};

type PageLike = {
  properties?: Record<string, unknown>;
};

export function isTableGroupableColumn(column: unknown): column is DatabaseColumn {
  if (!column || typeof column !== 'object') return false;
  const type = (column as DatabaseColumn).type;
  return type === 'select' || type === 'status';
}

export function getEffectiveTableGroupOrder(options: string[], groupOrder: string[] = []): string[] {
  if (!groupOrder.length) return options;
  const optionSet = new Set(options);
  const ordered = groupOrder.filter((group) => optionSet.has(group));
  const extras = options.filter((option) => !groupOrder.includes(option));
  return [...ordered, ...extras];
}

export function getVisibleTableGroups(
  options: string[],
  groupOrder: string[] = [],
  hiddenGroups: string[] = [],
): string[] {
  const hidden = new Set(hiddenGroups);
  return [...getEffectiveTableGroupOrder(options, groupOrder), UNCATEGORIZED_TABLE_GROUP].filter(
    (group) => !hidden.has(group),
  );
}

export function groupPagesForTable<TPage extends PageLike>(
  pages: TPage[],
  groupByCol: string,
  options: string[],
  visibleGroups: string[],
): Record<string, TPage[]> {
  const optionSet = new Set(options);
  const visibleSet = new Set(visibleGroups);
  const grouped: Record<string, TPage[]> = {};

  for (const group of visibleGroups) {
    grouped[group] = [];
  }

  for (const page of pages) {
    const value = page.properties?.[groupByCol];
    const group = typeof value === 'string' && optionSet.has(value) ? value : UNCATEGORIZED_TABLE_GROUP;
    if (visibleSet.has(group)) {
      grouped[group].push(page);
    }
  }

  return grouped;
}
