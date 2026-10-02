import type { DatabaseView } from '@/lib/types/views';
import { addDays, formatYMD, parseYMD } from '@/lib/recurrence/rule';
import type {
  BookKey,
  EventRowKey,
  MemoryRowKey,
  StockDatabaseText,
  TaskTrackerRowKey,
  TemplateText,
} from '@/lib/starterContent/types';

// Item templates. This file is the language-free structure — ids, icons, column ids
// and types, which option sits in which status group, which seed row has which value.
// Every word comes from a `TemplateText` (`src/lib/starterContent/templates/<locale>.ts`)
// and is filled in on the server at creation time, in the request's language
// (`createFromTemplate`, actions/templates.ts). The picker only needs the catalog below,
// so the client bundle carries no template text.

export interface SchemaColumn {
  id: string;
  name: string;
  type:
    | 'id'
    | 'text'
    | 'number'
    | 'select'
    | 'multi_select'
    | 'status'
    | 'user'
    | 'multi_user'
    | 'date'
    | 'datetime'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'phone';
  options?: ({ value: string; color?: string; group?: 'todo' | 'in_progress' | 'complete' } | string)[];
  dateFormat?: 'default' | 'iso' | 'uk' | 'us' | 'relative';
}

export interface SeedRow {
  title: string;
  properties: Record<string, unknown>;
}

export type TemplateId =
  | 'page-blank'
  | 'page-meeting-notes'
  | 'page-project-brief'
  | 'dashboard-blank'
  | 'db-blank'
  | 'db-task-tracker'
  | 'db-event-calendar'
  | 'db-reading-list'
  | 'db-agent-memory';

export type TemplateCategory = 'page' | 'database' | 'dashboard';

/** What the picker shows. The name and description are `Templates.<nameKey>` / `<nameKey>Desc`. */
export interface TemplateCatalogEntry {
  id: TemplateId;
  category: TemplateCategory;
  icon: string;
  iconColor?: string;
  nameKey:
    | 'blankPage'
    | 'meetingNotes'
    | 'projectBrief'
    | 'blankDashboard'
    | 'blankDatabase'
    | 'taskTracker'
    | 'eventCalendar'
    | 'readingList'
    | 'agentMemory';
}

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  { id: 'page-blank', category: 'page', icon: '📄', nameKey: 'blankPage' },
  { id: 'page-meeting-notes', category: 'page', icon: '🗓️', nameKey: 'meetingNotes' },
  { id: 'page-project-brief', category: 'page', icon: '📋', nameKey: 'projectBrief' },
  { id: 'dashboard-blank', category: 'dashboard', icon: '📊', nameKey: 'blankDashboard' },
  { id: 'db-blank', category: 'database', icon: '🗃️', nameKey: 'blankDatabase' },
  { id: 'db-task-tracker', category: 'database', icon: '✅', nameKey: 'taskTracker' },
  { id: 'db-event-calendar', category: 'database', icon: '📅', nameKey: 'eventCalendar' },
  { id: 'db-reading-list', category: 'database', icon: '📚', nameKey: 'readingList' },
  { id: 'db-agent-memory', category: 'database', icon: '🧠', nameKey: 'agentMemory' },
];

export function getCatalogEntry(id: string): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((entry) => entry.id === id);
}

export interface PageTemplateDefinition {
  id: TemplateId;
  category: 'page';
  initialContent: string;
}

export interface DatabaseTemplateDefinition {
  id: TemplateId;
  category: 'database';
  schema: SchemaColumn[];
  views: DatabaseView[];
  seedRows?: SeedRow[];
}

/**
 * A dashboard template carries a spec, not content or columns. v1 ships only
 * the blank one: a seeded dashboard would have to name `databaseId`s that do
 * not exist until the user creates them, so every block of a "sample" template
 * would render as "source removed" on the first open. A dashboard's blocks come
 * from an agent that can see the workspace.
 */
export interface DashboardTemplateDefinition {
  id: TemplateId;
  category: 'dashboard';
  /** Validated by `dashboardSpecSchema` before it reaches the database. */
  spec: { version: 1; blocks: unknown[] };
}

export type TemplateDefinition =
  | PageTemplateDefinition
  | DatabaseTemplateDefinition
  | DashboardTemplateDefinition;

/**
 * The stock database's columns, in one language. Its status options carry their
 * status group even though the column is a plain `select`: that is how a new row
 * finds its first "to do" option (`createPage`) and how the home dashboard knows which
 * value means finished — in any language, without matching English words.
 */
export function stockDatabaseSchema(text: StockDatabaseText): SchemaColumn[] {
  return [
    { id: 'title', name: text.title, type: 'text' },
    {
      id: 'status',
      name: text.status,
      type: 'select',
      options: [
        { value: text.todo, group: 'todo' },
        { value: text.inProgress, group: 'in_progress' },
        { value: text.done, group: 'complete' },
      ],
    },
    { id: 'id', name: text.id, type: 'id' },
  ];
}

/**
 * A new row's value for the stock `status` column (the blank database, the templates):
 * its first option in the "to do" group, in whatever language the database was made
 * ("To Do", "Yapılacak", "Backlog"). Stock columns from before the options carried a
 * group are plain strings — there the old "To Do" still applies.
 */
export function stockStatusDefault(
  options: readonly (string | { value: string; group?: string })[] | undefined,
): string | undefined {
  const entries = (options ?? []).map((o) => (typeof o === 'string' ? { value: o, group: undefined } : o));
  return entries.find((o) => o.group === 'todo')?.value ?? entries.find((o) => o.value === 'To Do')?.value;
}

// Sample dates are days from the Monday of the week the template is created in
// (`weekDay`), never fixed dates: the calendar opens on a grid that starts one week
// before the current one and runs four weeks ahead, so every event lands on it, and
// due dates sit around today in any year. Weekdays hold — the standup is a Monday,
// the offsite a Friday; done tasks were due last week.
const TASK_TRACKER_ROWS: {
  key: TaskTrackerRowKey;
  status: keyof TemplateText['taskTracker']['status'];
  priority: keyof TemplateText['taskTracker']['priority'];
  assignee: string;
  due: number | null;
}[] = [
  { key: 'landing', status: 'backlog', priority: 'high', assignee: 'Aisha Patel', due: 16 },
  { key: 'ci', status: 'inProgress', priority: 'high', assignee: 'Marcus Johnson', due: 10 },
  { key: 'tests', status: 'inProgress', priority: 'medium', assignee: 'Kai Rivera', due: 11 },
  { key: 'review', status: 'review', priority: 'medium', assignee: 'Marcus Johnson', due: 4 },
  { key: 'docs', status: 'backlog', priority: 'low', assignee: '', due: null },
  { key: 'staging', status: 'done', priority: 'high', assignee: 'Marcus Johnson', due: -3 },
  { key: 'loginBug', status: 'done', priority: 'high', assignee: 'Kai Rivera', due: -4 },
];

const EVENT_ROWS: { key: EventRowKey; day: number; category: keyof TemplateText['eventCalendar']['category'] }[] = [
  { key: 'standup', day: 0, category: 'meeting' },
  { key: 'planning', day: 1, category: 'meeting' },
  { key: 'productReview', day: 3, category: 'meeting' },
  { key: 'mvp', day: 11, category: 'deadline' },
  { key: 'summit', day: 17, category: 'conference' },
  { key: 'handoff', day: 9, category: 'deadline' },
  { key: 'offsite', day: 25, category: 'personal' },
];

const BOOK_ROWS: {
  key: BookKey;
  status: keyof TemplateText['readingList']['status'];
  rating: number | null;
  genre: keyof TemplateText['readingList']['genre'];
  author: string;
}[] = [
  { key: 'pragmatic', status: 'done', rating: 5, genre: 'tech', author: 'David Thomas & Andrew Hunt' },
  { key: 'dune', status: 'done', rating: 5, genre: 'fiction', author: 'Frank Herbert' },
  { key: 'sapiens', status: 'reading', rating: null, genre: 'nonFiction', author: 'Yuval Noah Harari' },
  { key: 'cleanCode', status: 'wantToRead', rating: null, genre: 'tech', author: 'Robert C. Martin' },
  { key: 'threeBody', status: 'wantToRead', rating: null, genre: 'fiction', author: 'Liu Cixin' },
  { key: 'briefHistory', status: 'done', rating: 4, genre: 'science', author: 'Stephen Hawking' },
  { key: 'thinking', status: 'wantToRead', rating: null, genre: 'nonFiction', author: 'Daniel Kahneman' },
];

const MEMORY_ROWS: {
  key: MemoryRowKey;
  type: keyof TemplateText['agentMemory']['type'];
  tags: (keyof TemplateText['agentMemory']['tags'])[];
  day: number;
}[] = [
  { key: 'postgres', type: 'decision', tags: ['architecture', 'database'], day: -12 },
  { key: 'functional', type: 'preference', tags: ['conventions'], day: -11 },
  { key: 'rateLimit', type: 'gotcha', tags: ['api', 'infra'], day: -6 },
  { key: 'tokens', type: 'fact', tags: ['conventions'], day: -4 },
];

/** The Project Brief's timeline, same reckoning: kickoff next Monday, launch ~two months on. */
const BRIEF_MILESTONES = { kickoff: 7, designDone: 25, beta: 51, launch: 65 } as const;

const TABLE_DEFAULTS = { filters: [], sorts: [], openBehavior: 'center' as const };

/** `today` (`YYYY-MM-DD`) → the date `n` days from the Monday of its week. */
function weekDays(today: string): (n: number) => string {
  const date = parseYMD(today) ?? new Date();
  const monday = addDays(date, -((date.getDay() + 6) % 7));
  return (n) => formatYMD(addDays(monday, n));
}

/**
 * One template, filled in with one language's words. `today` places the sample dates;
 * pass the creator's local date (the server's own date can be a day off).
 */
export function buildTemplate(id: TemplateId, text: TemplateText, today: string = formatYMD(new Date())): TemplateDefinition {
  const title: SchemaColumn = { id: 'title', name: text.stock.title, type: 'text' };
  const weekDay = weekDays(today);

  switch (id) {
    case 'page-blank':
      return { id, category: 'page', initialContent: '' };
    case 'page-meeting-notes':
      return { id, category: 'page', initialContent: text.meetingNotes };
    case 'page-project-brief': {
      const longDate = new Intl.DateTimeFormat(text.locale, { dateStyle: 'long' });
      const initialContent = text.projectBrief.replace(/\{\{(\w+)\}\}/g, (marker, key: string) =>
        key in BRIEF_MILESTONES
          ? longDate.format(parseYMD(weekDay(BRIEF_MILESTONES[key as keyof typeof BRIEF_MILESTONES]))!)
          : marker,
      );
      return { id, category: 'page', initialContent };
    }
    case 'dashboard-blank':
      return { id, category: 'dashboard', spec: { version: 1, blocks: [] } };

    case 'db-blank':
      return {
        id,
        category: 'database',
        schema: stockDatabaseSchema(text.stock),
        views: [
          {
            id: 'v1',
            name: text.views.table,
            config: { type: 'table', columnOrder: [], hiddenColumns: ['id'], ...TABLE_DEFAULTS },
          },
        ],
      };

    case 'db-task-tracker': {
      const t = text.taskTracker;
      const status = [
        { value: t.status.backlog, color: 'default', group: 'todo' as const },
        { value: t.status.inProgress, color: 'blue', group: 'in_progress' as const },
        { value: t.status.review, color: 'yellow', group: 'in_progress' as const },
        { value: t.status.done, color: 'green', group: 'complete' as const },
      ];
      return {
        id,
        category: 'database',
        schema: [
          title,
          { id: 'status', name: text.stock.status, type: 'status', options: status },
          {
            id: 'priority',
            name: t.columns.priority,
            type: 'select',
            options: [
              { value: t.priority.low, color: 'green' },
              { value: t.priority.medium, color: 'yellow' },
              { value: t.priority.high, color: 'red' },
            ],
          },
          { id: 'assignee', name: t.columns.assignee, type: 'text' },
          { id: 'dueDate', name: t.columns.dueDate, type: 'date', dateFormat: 'default' },
        ],
        views: [
          {
            id: 'v1',
            name: text.views.board,
            config: {
              type: 'kanban',
              groupByCol: 'status',
              groupOrder: status.map((o) => o.value),
              ...TABLE_DEFAULTS,
              cardProperties: ['priority', 'assignee', 'dueDate'],
              showPropertyLabels: true,
              propertyTextClamp: 'truncate',
              cardColorCol: 'priority',
            },
          },
          {
            id: 'v2',
            name: text.views.table,
            config: {
              type: 'table',
              columnOrder: ['title', 'status', 'priority', 'assignee', 'dueDate'],
              hiddenColumns: [],
              ...TABLE_DEFAULTS,
            },
          },
        ],
        seedRows: TASK_TRACKER_ROWS.map((row) => ({
          title: t.rows[row.key],
          properties: {
            status: t.status[row.status],
            priority: t.priority[row.priority],
            assignee: row.assignee,
            dueDate: row.due === null ? '' : weekDay(row.due),
          },
        })),
      };
    }

    case 'db-event-calendar': {
      const t = text.eventCalendar;
      return {
        id,
        category: 'database',
        schema: [
          title,
          { id: 'eventDate', name: t.columns.eventDate, type: 'date', dateFormat: 'default' },
          {
            id: 'category',
            name: t.columns.category,
            type: 'select',
            options: [
              { value: t.category.meeting, color: 'blue' },
              { value: t.category.conference, color: 'purple' },
              { value: t.category.deadline, color: 'red' },
              { value: t.category.personal, color: 'green' },
            ],
          },
          { id: 'notes', name: t.columns.notes, type: 'text' },
        ],
        views: [
          {
            id: 'v1',
            name: text.views.calendar,
            config: {
              type: 'calendar',
              dateCol: 'eventDate',
              viewMode: 'month',
              firstDayOfWeek: 'monday',
              ...TABLE_DEFAULTS,
              cardColorCol: 'category',
              cardProperties: ['category'],
              showPropertyLabels: false,
              propertyTextClamp: 'truncate',
            },
          },
          {
            id: 'v2',
            name: text.views.table,
            config: {
              type: 'table',
              columnOrder: ['title', 'eventDate', 'category', 'notes'],
              hiddenColumns: [],
              ...TABLE_DEFAULTS,
            },
          },
        ],
        seedRows: EVENT_ROWS.map((row) => ({
          title: t.rows[row.key].title,
          properties: { eventDate: weekDay(row.day), category: t.category[row.category], notes: t.rows[row.key].notes },
        })),
      };
    }

    case 'db-reading-list': {
      const t = text.readingList;
      return {
        id,
        category: 'database',
        schema: [
          title,
          {
            id: 'status',
            name: text.stock.status,
            type: 'select',
            options: [
              { value: t.status.wantToRead, color: 'default', group: 'todo' },
              { value: t.status.reading, color: 'blue', group: 'in_progress' },
              { value: t.status.done, color: 'green', group: 'complete' },
            ],
          },
          { id: 'rating', name: t.columns.rating, type: 'number' },
          {
            id: 'genre',
            name: t.columns.genre,
            type: 'select',
            options: [
              { value: t.genre.fiction, color: 'purple' },
              { value: t.genre.nonFiction, color: 'teal' },
              { value: t.genre.tech, color: 'blue' },
              { value: t.genre.science, color: 'green' },
            ],
          },
          { id: 'author', name: t.columns.author, type: 'text' },
        ],
        views: [
          {
            id: 'v1',
            name: text.views.table,
            config: {
              type: 'table',
              columnOrder: ['title', 'status', 'rating', 'genre', 'author'],
              hiddenColumns: [],
              ...TABLE_DEFAULTS,
              rowColorCol: 'status',
            },
          },
        ],
        seedRows: BOOK_ROWS.map((row) => ({
          title: t.books[row.key],
          properties: { status: t.status[row.status], rating: row.rating, genre: t.genre[row.genre], author: row.author },
        })),
      };
    }

    case 'db-agent-memory': {
      const t = text.agentMemory;
      const types = [
        { value: t.type.decision, color: 'blue' },
        { value: t.type.preference, color: 'purple' },
        { value: t.type.gotcha, color: 'red' },
        { value: t.type.fact, color: 'green' },
      ];
      return {
        id,
        category: 'database',
        schema: [
          title,
          { id: 'type', name: t.columns.type, type: 'select', options: types },
          {
            id: 'tags',
            name: t.columns.tags,
            type: 'multi_select',
            options: [
              { value: t.tags.architecture, color: 'teal' },
              { value: t.tags.conventions, color: 'yellow' },
              { value: t.tags.api, color: 'blue' },
              { value: t.tags.database, color: 'purple' },
              { value: t.tags.infra, color: 'green' },
            ],
          },
          { id: 'date', name: t.columns.date, type: 'date', dateFormat: 'default' },
        ],
        views: [
          {
            id: 'v1',
            name: text.views.table,
            config: {
              type: 'table',
              columnOrder: ['title', 'type', 'tags', 'date'],
              hiddenColumns: [],
              ...TABLE_DEFAULTS,
              rowColorCol: 'type',
            },
          },
          {
            id: 'v2',
            name: t.byType,
            config: {
              type: 'kanban',
              groupByCol: 'type',
              groupOrder: types.map((o) => o.value),
              ...TABLE_DEFAULTS,
              cardProperties: ['tags', 'date'],
              showPropertyLabels: false,
              propertyTextClamp: 'truncate',
              cardColorCol: 'type',
            },
          },
        ],
        seedRows: MEMORY_ROWS.map((row) => ({
          title: t.rows[row.key],
          properties: { type: t.type[row.type], tags: row.tags.map((tag) => t.tags[tag]), date: weekDay(row.day) },
        })),
      };
    }
  }
}
