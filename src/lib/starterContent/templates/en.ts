import type { TemplateText } from '../types';

const text: TemplateText = {
  locale: 'en',
  stock: {
    title: 'Title',
    status: 'Status',
    id: 'ID',
    todo: 'To Do',
    inProgress: 'In Progress',
    done: 'Done',
  },
  views: { table: 'Table', board: 'Board', calendar: 'Calendar' },

  meetingNotes: `## Attendees

- Sarah Chen (PM)
- Marcus Johnson (Engineering Lead)
- Aisha Patel (Designer)

## Agenda

1. Sprint review & velocity check
2. Next quarter's roadmap priorities
3. Design system updates

## Notes

Sprint went well overall. Velocity was slightly above estimate. The new auth flow is live and performing as expected.

Next quarter's priorities: focus on onboarding improvements and mobile responsiveness. Marketing needs the new dashboard by the end of next month.

Design system: Aisha will share updated component library next week.

## Action Items

- [ ] Marcus: set up staging environment by Friday
- [ ] Aisha: share design system v2 draft by next Tuesday
- [ ] Sarah: send next quarter's roadmap draft for team review
`,

  projectBrief: `## Overview

A next-generation analytics dashboard that helps teams track key metrics in real time. The goal is to replace the current spreadsheet-based reporting with a centralized, automated solution.

## Goals

- Reduce manual reporting time by 80%
- Provide real-time visibility into team KPIs
- Support data exports to PDF and CSV

## Timeline

| Milestone | Date |
|-----------|------|
| Kickoff | {{kickoff}} |
| Design complete | {{designDone}} |
| Beta release | {{beta}} |
| Launch | {{launch}} |

## Team

- Product: Sarah Chen
- Engineering: Marcus Johnson, Kai Rivera
- Design: Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'Priority', assignee: 'Assignee', dueDate: 'Due Date' },
    status: { backlog: 'Backlog', inProgress: 'In Progress', review: 'Review', done: 'Done' },
    priority: { low: 'Low', medium: 'Medium', high: 'High' },
    rows: {
      landing: 'Design landing page mockups',
      ci: 'Set up CI/CD pipeline',
      tests: 'Write unit tests for auth module',
      review: 'Code review for feature/payments branch',
      docs: 'Update API documentation',
      staging: 'Deploy to staging environment',
      loginBug: 'Fix login redirect bug',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'Event Date', category: 'Category', notes: 'Notes' },
    category: { meeting: 'Meeting', conference: 'Conference', deadline: 'Deadline', personal: 'Personal' },
    rows: {
      standup: { title: 'Weekly team standup', notes: 'Recurring every Monday' },
      planning: { title: 'Sprint planning', notes: 'Sprint 14 kickoff' },
      productReview: { title: 'Quarterly product review', notes: 'Review roadmap with stakeholders' },
      mvp: { title: 'Project MVP deadline', notes: 'All features must be merged to main' },
      summit: { title: 'Frontend Summit', notes: 'Remote — register at frontendsummit.io' },
      handoff: { title: 'Design system handoff', notes: 'Aisha delivers v2 components' },
      offsite: { title: 'Team offsite', notes: 'Istanbul — 2 nights' },
    },
  },

  readingList: {
    columns: { rating: 'Rating', genre: 'Genre', author: 'Author' },
    status: { wantToRead: 'Want to Read', reading: 'Reading', done: 'Done' },
    genre: { fiction: 'Fiction', nonFiction: 'Non-Fiction', tech: 'Tech', science: 'Science' },
    books: {
      pragmatic: 'The Pragmatic Programmer',
      dune: 'Dune',
      sapiens: 'Sapiens',
      cleanCode: 'Clean Code',
      threeBody: 'The Three-Body Problem',
      briefHistory: 'A Brief History of Time',
      thinking: 'Thinking, Fast and Slow',
    },
  },

  agentMemory: {
    columns: { type: 'Type', tags: 'Tags', date: 'Date' },
    type: { decision: 'Decision', preference: 'Preference', gotcha: 'Gotcha', fact: 'Fact' },
    tags: { architecture: 'architecture', conventions: 'conventions', api: 'api', database: 'database', infra: 'infra' },
    byType: 'By Type',
    rows: {
      postgres: 'Use PostgreSQL for the primary datastore',
      functional: 'Prefer functional React components over class components',
      rateLimit: 'Staging API rate-limits at 100 req/min — batch writes',
      tokens: 'Design tokens live in tokens.css, not the Tailwind config',
    },
  },
};

export default text;
