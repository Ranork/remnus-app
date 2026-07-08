import type { DatabaseView } from '@/lib/types/views';

export interface SchemaColumn {
  id: string;
  name: string;
  type:
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

export interface PageTemplateDefinition {
  id: string;
  category: 'page';
  name: string;
  description: string;
  icon: string;
  iconColor?: string;
  initialContent: string;
}

export interface DatabaseTemplateDefinition {
  id: string;
  category: 'database';
  name: string;
  description: string;
  icon: string;
  iconColor?: string;
  schema: SchemaColumn[];
  views: DatabaseView[];
  seedRows?: SeedRow[];
}

export type TemplateDefinition = PageTemplateDefinition | DatabaseTemplateDefinition;

export const TEMPLATES: TemplateDefinition[] = [
  // ── Pages ──────────────────────────────────────────────────────────────────
  {
    id: 'page-blank',
    category: 'page',
    name: 'Blank Page',
    description: 'Start with a clean slate',
    icon: '📄',
    initialContent: '',
  },
  {
    id: 'page-meeting-notes',
    category: 'page',
    name: 'Meeting Notes',
    description: 'Structured notes with agenda and action items',
    icon: '🗓️',
    initialContent: `## Attendees

- Sarah Chen (PM)
- Marcus Johnson (Engineering Lead)
- Aisha Patel (Designer)

## Agenda

1. Sprint review & velocity check
2. Q3 roadmap priorities
3. Design system updates

## Notes

Sprint went well overall. Velocity was slightly above estimate. The new auth flow is live and performing as expected.

Q3 priorities: focus on onboarding improvements and mobile responsiveness. Marketing needs the new dashboard by end of July.

Design system: Aisha will share updated component library next week.

## Action Items

- [ ] Marcus: set up staging environment by Friday
- [ ] Aisha: share design system v2 draft by next Tuesday
- [ ] Sarah: send Q3 roadmap draft for team review
`,
  },
  {
    id: 'page-project-brief',
    category: 'page',
    name: 'Project Brief',
    description: 'Overview, goals, timeline and team',
    icon: '📋',
    initialContent: `## Overview

A next-generation analytics dashboard that helps teams track key metrics in real time. The goal is to replace the current spreadsheet-based reporting with a centralized, automated solution.

## Goals

- Reduce manual reporting time by 80%
- Provide real-time visibility into team KPIs
- Support data exports to PDF and CSV

## Timeline

| Milestone | Date |
|-----------|------|
| Kickoff | June 2, 2026 |
| Design complete | June 20, 2026 |
| Beta release | July 15, 2026 |
| Launch | August 1, 2026 |

## Team

- Product: Sarah Chen
- Engineering: Marcus Johnson, Kai Rivera
- Design: Aisha Patel
`,
  },

  // ── Databases ──────────────────────────────────────────────────────────────
  {
    id: 'db-blank',
    category: 'database',
    name: 'Blank Database',
    description: 'Empty table with Title and Status',
    icon: '🗃️',
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        options: ['To Do', 'In Progress', 'Done'],
      },
    ],
    views: [
      {
        id: 'v1',
        name: 'Table',
        config: {
          type: 'table',
          columnOrder: [],
          hiddenColumns: [],
          filters: [],
          sorts: [],
          openBehavior: 'center',
        },
      },
    ],
  },
  {
    id: 'db-task-tracker',
    category: 'database',
    name: 'Task Tracker',
    description: 'Kanban board with priority, assignee, and due date',
    icon: '✅',
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      {
        id: 'status',
        name: 'Status',
        type: 'status',
        options: [
          { value: 'Backlog', color: 'default', group: 'todo' },
          { value: 'In Progress', color: 'blue', group: 'in_progress' },
          { value: 'Review', color: 'yellow', group: 'in_progress' },
          { value: 'Done', color: 'green', group: 'complete' },
        ],
      },
      {
        id: 'priority',
        name: 'Priority',
        type: 'select',
        options: [
          { value: 'Low', color: 'green' },
          { value: 'Medium', color: 'yellow' },
          { value: 'High', color: 'red' },
        ],
      },
      { id: 'assignee', name: 'Assignee', type: 'text' },
      { id: 'dueDate', name: 'Due Date', type: 'date', dateFormat: 'default' },
    ],
    views: [
      {
        id: 'v1',
        name: 'Board',
        config: {
          type: 'kanban',
          groupByCol: 'status',
          groupOrder: ['Backlog', 'In Progress', 'Review', 'Done'],
          filters: [],
          sorts: [],
          openBehavior: 'center',
          cardProperties: ['priority', 'assignee', 'dueDate'],
          showPropertyLabels: true,
          propertyTextClamp: 'truncate',
          cardColorCol: 'priority',
          groupColBg: true,
        },
      },
      {
        id: 'v2',
        name: 'Table',
        config: {
          type: 'table',
          columnOrder: ['title', 'status', 'priority', 'assignee', 'dueDate'],
          hiddenColumns: [],
          filters: [],
          sorts: [],
          openBehavior: 'center',
        },
      },
    ],
    seedRows: [
      { title: 'Design landing page mockups', properties: { status: 'Backlog', priority: 'High', assignee: 'Aisha Patel', dueDate: '2026-06-10' } },
      { title: 'Set up CI/CD pipeline', properties: { status: 'In Progress', priority: 'High', assignee: 'Marcus Johnson', dueDate: '2026-05-28' } },
      { title: 'Write unit tests for auth module', properties: { status: 'In Progress', priority: 'Medium', assignee: 'Kai Rivera', dueDate: '2026-05-30' } },
      { title: 'Code review for feature/payments branch', properties: { status: 'Review', priority: 'Medium', assignee: 'Marcus Johnson', dueDate: '2026-05-22' } },
      { title: 'Update API documentation', properties: { status: 'Backlog', priority: 'Low', assignee: '', dueDate: '' } },
      { title: 'Deploy to staging environment', properties: { status: 'Done', priority: 'High', assignee: 'Marcus Johnson', dueDate: '2026-05-19' } },
      { title: 'Fix login redirect bug', properties: { status: 'Done', priority: 'High', assignee: 'Kai Rivera', dueDate: '2026-05-18' } },
    ],
  },
  {
    id: 'db-event-calendar',
    category: 'database',
    name: 'Event Calendar',
    description: 'Monthly calendar for meetings, conferences, and deadlines',
    icon: '📅',
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'eventDate', name: 'Event Date', type: 'date', dateFormat: 'default' },
      {
        id: 'category',
        name: 'Category',
        type: 'select',
        options: [
          { value: 'Meeting', color: 'blue' },
          { value: 'Conference', color: 'purple' },
          { value: 'Deadline', color: 'red' },
          { value: 'Personal', color: 'green' },
        ],
      },
      { id: 'notes', name: 'Notes', type: 'text' },
    ],
    views: [
      {
        id: 'v1',
        name: 'Calendar',
        config: {
          type: 'calendar',
          dateCol: 'eventDate',
          viewMode: 'month',
          firstDayOfWeek: 'monday',
          filters: [],
          sorts: [],
          openBehavior: 'center',
          cardColorCol: 'category',
          cardProperties: ['category'],
          showPropertyLabels: false,
          propertyTextClamp: 'truncate',
        },
      },
      {
        id: 'v2',
        name: 'Table',
        config: {
          type: 'table',
          columnOrder: ['title', 'eventDate', 'category', 'notes'],
          hiddenColumns: [],
          filters: [],
          sorts: [],
          openBehavior: 'center',
        },
      },
    ],
    seedRows: [
      { title: 'Weekly team standup', properties: { eventDate: '2026-05-21', category: 'Meeting', notes: 'Recurring every Monday' } },
      { title: 'Sprint planning', properties: { eventDate: '2026-05-22', category: 'Meeting', notes: 'Sprint 14 kickoff' } },
      { title: 'Q3 product review', properties: { eventDate: '2026-05-26', category: 'Meeting', notes: 'Review roadmap with stakeholders' } },
      { title: 'Project MVP deadline', properties: { eventDate: '2026-05-30', category: 'Deadline', notes: 'All features must be merged to main' } },
      { title: 'Frontend Summit 2026', properties: { eventDate: '2026-06-05', category: 'Conference', notes: 'Remote — register at frontendsummit.io' } },
      { title: 'Design system handoff', properties: { eventDate: '2026-06-03', category: 'Deadline', notes: 'Aisha delivers v2 components' } },
      { title: 'Team offsite', properties: { eventDate: '2026-06-12', category: 'Personal', notes: 'Istanbul — 2 nights' } },
    ],
  },
  {
    id: 'db-reading-list',
    category: 'database',
    name: 'Reading List',
    description: 'Track books with status, rating, and genre',
    icon: '📚',
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        options: [
          { value: 'Want to Read', color: 'default' },
          { value: 'Reading', color: 'blue' },
          { value: 'Done', color: 'green' },
        ],
      },
      { id: 'rating', name: 'Rating', type: 'number' },
      {
        id: 'genre',
        name: 'Genre',
        type: 'select',
        options: [
          { value: 'Fiction', color: 'purple' },
          { value: 'Non-Fiction', color: 'teal' },
          { value: 'Tech', color: 'blue' },
          { value: 'Science', color: 'green' },
        ],
      },
      { id: 'author', name: 'Author', type: 'text' },
    ],
    views: [
      {
        id: 'v1',
        name: 'Table',
        config: {
          type: 'table',
          columnOrder: ['title', 'status', 'rating', 'genre', 'author'],
          hiddenColumns: [],
          filters: [],
          sorts: [],
          openBehavior: 'center',
          rowColorCol: 'status',
        },
      },
    ],
    seedRows: [
      { title: 'The Pragmatic Programmer', properties: { status: 'Done', rating: 5, genre: 'Tech', author: 'David Thomas & Andrew Hunt' } },
      { title: 'Dune', properties: { status: 'Done', rating: 5, genre: 'Fiction', author: 'Frank Herbert' } },
      { title: 'Sapiens', properties: { status: 'Reading', rating: null, genre: 'Non-Fiction', author: 'Yuval Noah Harari' } },
      { title: 'Clean Code', properties: { status: 'Want to Read', rating: null, genre: 'Tech', author: 'Robert C. Martin' } },
      { title: 'The Three-Body Problem', properties: { status: 'Want to Read', rating: null, genre: 'Fiction', author: 'Liu Cixin' } },
      { title: 'A Brief History of Time', properties: { status: 'Done', rating: 4, genre: 'Science', author: 'Stephen Hawking' } },
      { title: 'Thinking, Fast and Slow', properties: { status: 'Want to Read', rating: null, genre: 'Non-Fiction', author: 'Daniel Kahneman' } },
    ],
  },
  {
    id: 'db-agent-memory',
    category: 'database',
    name: 'Agent Memory',
    description: 'Durable, human-readable memory your AI agent saves and recalls over MCP',
    icon: '🧠',
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      {
        id: 'type',
        name: 'Type',
        type: 'select',
        options: [
          { value: 'Decision', color: 'blue' },
          { value: 'Preference', color: 'purple' },
          { value: 'Gotcha', color: 'red' },
          { value: 'Fact', color: 'green' },
        ],
      },
      {
        id: 'tags',
        name: 'Tags',
        type: 'multi_select',
        options: [
          { value: 'architecture', color: 'teal' },
          { value: 'conventions', color: 'yellow' },
          { value: 'api', color: 'blue' },
          { value: 'database', color: 'purple' },
          { value: 'infra', color: 'green' },
        ],
      },
      { id: 'date', name: 'Date', type: 'date', dateFormat: 'default' },
    ],
    views: [
      {
        id: 'v1',
        name: 'Table',
        config: {
          type: 'table',
          columnOrder: ['title', 'type', 'tags', 'date'],
          hiddenColumns: [],
          filters: [],
          sorts: [],
          openBehavior: 'center',
          rowColorCol: 'type',
        },
      },
      {
        id: 'v2',
        name: 'By Type',
        config: {
          type: 'kanban',
          groupByCol: 'type',
          groupOrder: ['Decision', 'Preference', 'Gotcha', 'Fact'],
          filters: [],
          sorts: [],
          openBehavior: 'center',
          cardProperties: ['tags', 'date'],
          showPropertyLabels: false,
          propertyTextClamp: 'truncate',
          cardColorCol: 'type',
          groupColBg: true,
        },
      },
    ],
    seedRows: [
      { title: 'Use PostgreSQL for the primary datastore', properties: { type: 'Decision', tags: ['architecture', 'database'], date: '2026-07-01' } },
      { title: 'Prefer functional React components over class components', properties: { type: 'Preference', tags: ['conventions'], date: '2026-07-02' } },
      { title: 'Staging API rate-limits at 100 req/min — batch writes', properties: { type: 'Gotcha', tags: ['api', 'infra'], date: '2026-07-04' } },
      { title: 'Design tokens live in tokens.css, not the Tailwind config', properties: { type: 'Fact', tags: ['conventions'], date: '2026-07-05' } },
    ],
  },
];
