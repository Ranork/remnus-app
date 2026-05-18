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
  cardColorCol?: string;                  // property ID whose select value drives the card's left-border color
  groupColBg?: boolean;                   // tint each column background with the group option's color
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
}

export interface CalendarViewConfig {
  type: 'calendar';
  dateCol: string;         // which date or datetime column to place cards on
  viewMode: 'month' | 'week';
  firstDayOfWeek?: 'sunday' | 'monday';
  filters: ViewFilter[];
  sorts: ViewSort[];
  openBehavior?: OpenBehavior;
  cardColorCol?: string;                  // property ID whose select value drives the card's left-border color
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
}


