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
  cardColorCol?: string;                  // property ID that marks each card ("Mark cards by"), drawn as `cardMarkStyle` says
  cardMarkStyle?: CardMarkStyle;          // how the mark is drawn: a badge (default) or an accent line on `cardBorderSide`
  cardBorderSide?: CardAccentSide;        // the accent line's edge when `cardMarkStyle` is 'accent'; default 'left'
  cardBgCol?: string;                     // property ID whose option colour tints the whole card ("Card background")
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
  cardColorCol?: string;                  // property ID that marks each event, drawn as `cardMarkStyle` says
  cardMarkStyle?: CardMarkStyle;          // how the mark is drawn: a dot / status ring before the title (default) or an accent line
  cardBorderSide?: CardAccentSide;        // the accent line's edge when `cardMarkStyle` is 'accent'; default 'left'
  cardBgCol?: string;                     // property ID whose option colour tints the whole event card ("Card background")
  cardProperties?: string[];              // visible property IDs in display order; undefined = first 1
  showPropertyLabels?: boolean;           // show property name before value; default true
  propertyTextClamp?: 'truncate' | 'wrap'; // single-line truncate or multi-line wrap; default truncate
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
}

export type CardMarkStyle = 'mark' | 'accent';
export type CardAccentSide = 'left' | 'top' | 'right' | 'bottom';

/**
 * How a kanban or calendar view colours its cards (U3, after V2 R8.2): one property
 * marks each card — as a badge/dot or, alternatively, as an accent line along one
 * edge — and an optional property tints the whole card. Read from and written back
 * to the stored config fields with `getCardAppearance` / `applyCardAppearance`.
 */
export interface CardAppearance {
  markCol?: string;
  markStyle: CardMarkStyle;
  accentSide: CardAccentSide;
  tintCol?: string;
}

export const DEFAULT_CARD_APPEARANCE: CardAppearance = { markStyle: 'mark', accentSide: 'left' };

type CardAppearanceFields =Pick<KanbanViewConfig, 'cardColorCol' | 'cardMarkStyle' | 'cardBorderSide' | 'cardBgCol'>;

export function getCardAppearance(cfg: CardAppearanceFields): CardAppearance {
  return {
    markCol: cfg.cardColorCol,
    markStyle: cfg.cardMarkStyle ?? 'mark',
    accentSide: cfg.cardBorderSide ?? 'left',
    tintCol: cfg.cardBgCol,
  };
}

export function applyCardAppearance<T extends CardAppearanceFields>(cfg: T, patch: Partial<CardAppearance>): T {
  const next = { ...cfg };
  if ('markCol' in patch) next.cardColorCol = patch.markCol || undefined;
  if ('markStyle' in patch) next.cardMarkStyle = patch.markStyle;
  if ('accentSide' in patch) next.cardBorderSide = patch.accentSide;
  if ('tintCol' in patch) next.cardBgCol = patch.tintCol || undefined;
  return next;
}

export interface DatabaseView {
  id: string;
  name: string;
  config: TableViewConfig | KanbanViewConfig | CalendarViewConfig;
  icon?: string;
  iconColor?: string;
}

