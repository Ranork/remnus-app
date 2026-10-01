export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty';

export interface ViewFilter {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
}

export interface ViewSort {
  id: string;
  columnId: string;
  direction: 'asc' | 'desc';
}

export type OpenBehavior = 'center' | 'side' | 'full';

export interface TableViewConfig {
  type: 'table';
  columnOrder: string[];   // visible column IDs in order; [] = use schema order
  hiddenColumns: string[];
  columnWidths?: Record<string, number>;
  rowColorCol?: string;    // property ID of a select/multi_select/status column that marks each row (a dot or status ring before the title; no tint since V2 R8.2)
  groupByCol?: string;     // optional select/status column used to split the table into vertical groups
  groupOrder?: string[];   // option values in display order; []/undefined = use options order
  groupColBg?: boolean;    // legacy: section tint, ignored since V2 R8.2 (the group's colour is its heading glyph)
  hiddenGroups?: string[];
  collapsedGroups?: string[]; // group values rendered header-only (their rows are hidden)
  filters: ViewFilter[];
  sorts: ViewSort[];
  openBehavior?: OpenBehavior;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
}

export interface KanbanViewConfig {
  type: 'kanban';
  groupByCol: string;
  groupOrder: string[];    // option values in display order; [] = use options order
  filters: ViewFilter[];
  sorts: ViewSort[];
  openBehavior?: OpenBehavior;
  cardProperties?: string[];              // visible property IDs in display order; undefined = first 2
  showPropertyLabels?: boolean;           // show property name before value; default true
  propertyTextClamp?: 'truncate' | 'wrap'; // single-line truncate or multi-line wrap; default truncate
  cardColorCol?: string;                  // property ID that marks each card ("Mark cards by": a status chip or option chips on the card)
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom'; // legacy: accent-line edge, ignored since V2 R8.2
  cardBgCol?: string;                     // legacy: card tint; read as the mark when cardColorCol is unset
  groupColBg?: boolean;                   // legacy: column tint, ignored since V2 R8.2 (the group's colour is its heading glyph)
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  hiddenGroups?: string[];
}

export interface CalendarViewConfig {
  type: 'calendar';
  dateCol: string;         // which date or datetime column to place cards on
  viewMode: 'month' | 'week';
  firstDayOfWeek?: 'sunday' | 'monday';
  filters: ViewFilter[];
  sorts: ViewSort[];
  openBehavior?: OpenBehavior;
  cardColorCol?: string;                  // property ID that marks each event (a dot or status ring before the title)
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom'; // legacy: accent-line edge, ignored since V2 R8.2
  cardBgCol?: string;                     // legacy: card tint; read as the mark when cardColorCol is unset
  cardProperties?: string[];              // visible property IDs in display order; undefined = first 1
  showPropertyLabels?: boolean;           // show property name before value; default true
  propertyTextClamp?: 'truncate' | 'wrap'; // single-line truncate or multi-line wrap; default truncate
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
}

export interface DatabaseView {
  id: string;
  name: string;
  config: TableViewConfig | KanbanViewConfig | CalendarViewConfig;
  icon?: string;
  iconColor?: string;
}

