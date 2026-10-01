// The words of the content Remnus writes for a user: the item templates, the stock
// database and the sample workspace every signup and demo starts with. One file per
// locale (`templates/<locale>.ts`, `sample/<locale>.ts`); the structure — column ids,
// option groups, which row has which value — lives once in `src/lib/templates.ts` and
// `src/lib/seed.ts`. These types are what make a locale complete: a missing word is a
// `tsc` error, not an English leftover.
//
// Server-only by convention: the text is loaded where the content is created
// (`getTemplateText` / `getSampleText`), never shipped to the client bundle.

/** The stock database: the blank template, "/database" and every bare "new database". */
export interface StockDatabaseText {
  /** The title column. Every template's title column uses this name too. */
  title: string;
  status: string;
  id: string;
  todo: string;
  inProgress: string;
  done: string;
}

export type TaskTrackerRowKey = 'landing' | 'ci' | 'tests' | 'review' | 'docs' | 'staging' | 'loginBug';
export type EventRowKey = 'standup' | 'planning' | 'productReview' | 'mvp' | 'summit' | 'handoff' | 'offsite';
export type BookKey = 'pragmatic' | 'dune' | 'sapiens' | 'cleanCode' | 'threeBody' | 'briefHistory' | 'thinking';
export type MemoryRowKey = 'postgres' | 'functional' | 'rateLimit' | 'tokens';

export interface TemplateText {
  stock: StockDatabaseText;
  views: { table: string; board: string; calendar: string };
  /** Page bodies, markdown. */
  meetingNotes: string;
  projectBrief: string;
  taskTracker: {
    columns: { priority: string; assignee: string; dueDate: string };
    status: { backlog: string; inProgress: string; review: string; done: string };
    priority: { low: string; medium: string; high: string };
    rows: Record<TaskTrackerRowKey, string>;
  };
  eventCalendar: {
    columns: { eventDate: string; category: string; notes: string };
    category: { meeting: string; conference: string; deadline: string; personal: string };
    rows: Record<EventRowKey, { title: string; notes: string }>;
  };
  readingList: {
    columns: { rating: string; genre: string; author: string };
    status: { wantToRead: string; reading: string; done: string };
    genre: { fiction: string; nonFiction: string; tech: string; science: string };
    /** The title each book is published under in this language. */
    books: Record<BookKey, string>;
  };
  agentMemory: {
    columns: { type: string; tags: string; date: string };
    type: { decision: string; preference: string; gotcha: string; fact: string };
    tags: { architecture: string; conventions: string; api: string; database: string; infra: string };
    /** The kanban view's name. */
    byType: string;
    rows: Record<MemoryRowKey, string>;
  };
}

export type SprintTaskKey =
  | 'scaffold' | 'brush' | 'eraser' | 'brushSize' | 'fill' | 'clear' | 'colorPicker' | 'palette'
  | 'line' | 'rect' | 'ellipse' | 'save' | 'open' | 'undo' | 'toolbar' | 'shortcuts';

export interface SampleText {
  /** A signup's first workspace, named after them. */
  workspaceName: (userName: string) => string;
  /** …when the account has no name. */
  personalWorkspace: string;
  demoWorkspace: string;
  demoUserName: string;
  /** The planted demo token, as the AI Agents panel lists it. */
  agentTokenName: string;
  /** `{{HOW_BUILT_CB}}` marks where the "How this was built" child page sits. */
  startHere: { title: string; content: string };
  howBuilt: { title: string; content: string };
  productSpec: { title: string; content: string };
  sprintBoard: {
    name: string;
    columns: { title: string; status: string; priority: string; category: string };
    status: { backlog: string; inProgress: string; done: string };
    priority: { high: string; medium: string; low: string };
    category: { canvas: string; color: string; shapes: string; file: string; ui: string };
    views: { board: string; table: string };
  };
  tasks: Record<SprintTaskKey, { title: string; content: string }>;
}
