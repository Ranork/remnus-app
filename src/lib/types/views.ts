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
  rowColorCol?: string;    // property ID of a select/multi_select column that drives the row's background tint color
  groupByCol?: string;     // optional select/status column used to split the table into vertical groups
  groupOrder?: string[];   // option values in display order; []/undefined = use options order
  groupColBg?: boolean;    // tint each grouped table section with the group option's color
  hiddenGroups?: string[];
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
  cardColorCol?: string;                  // property ID whose select value drives the card's accent line color
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom'; // which edge the accent line appears on; default 'left'
  cardBgCol?: string;                     // property ID whose select value drives the card's full background tint
  groupColBg?: boolean;                   // tint each column background with the group option's color
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
  cardColorCol?: string;                  // property ID whose select value drives the card's accent line color
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom'; // which edge the accent line appears on; default 'left'
  cardBgCol?: string;                     // property ID whose select value drives the card's full background tint
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

