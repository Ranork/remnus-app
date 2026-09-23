# Playbook: Web App / SaaS

What an agent looks for and models when calibrating a web app or SaaS product: features, experiments and flags, customer feedback, plans.

For [Calibrate](../calibrate.md), Phase 2b. Index: [Playbooks](../playbooks.md).

**Evidence first.** This playbook is a list of things to look for, not a template: no
database, column or row gets created unless this project's code, docs or history shows it.

## Pick it when

A web framework in the manifest — `next`, `nuxt`, `@remix-run/*`, `@sveltejs/kit`,
`astro`, `django`, `rails`, `laravel/framework` — **plus at least two product signals**:
user routes (`app/`, `pages/`, `src/routes/`), auth (`next-auth`, `@auth/*`, `devise`,
`@clerk/*`, `@supabase/*`), billing (`stripe`, `@paddle/*`), feature flags or product
analytics (`posthog-js`, `launchdarkly-*`, `@vercel/flags`, `unleash-*`), pricing or
marketing pages, locale message files. A framework alone is a website, not a product.

## Concepts to model

**Features** (`conceptType: feature`) — the product as users meet it, named the way the
app's own navigation names it; never the route or component list.
Columns: `Area` select (from the navigation) · `Status` status (`Idea`, `Planned` → `Building`
→ `Shipped`, `Retired`) · `Audience` select (from the plans: `Free`, `Pro`, `Admin`…) ·
`Shipped` date · `Flag` text (the key that gates it, if any).

**Experiments & flags** (`experiment`) — only with a flag or experiment SDK in use.
`Flag key` text · `Status` status (`Draft` → `Running` → `Rolled out`, `Removed`) ·
`Metric` text · `Started` date · `Ended` date.

**Customer feedback** (`feedback`) — only when feedback exists: issue labels such as
`bug`/`feature-request`, a support export, a feedback model in the code, notes you were
given. `Type` select (`Bug`, `Request`, `Praise`, `Churn reason`) · `Area` select ·
`Source` select (`Support`, `Issue`, `Interview`, `Review`) · `Received` date ·
`Link` url.

**Plans & pricing** (`plan`) — only when prices or limits live in code (price ids, a
limits constant). `Price` number · `Interval` select (`Monthly`, `Yearly`) ·
`Status` select (`Live`, `Legacy`). Body: the limits, quoted from the code.

## Example rows

- **Features** — *Team invitations* · Area `Workspace` · Status `Shipped` · Audience `Pro`.
  Body: "Owners invite by email; the link expires after 7 days (`INVITE_TTL` in
  `src/lib/invites.ts`). Seats are checked when the invite is accepted, not when it's sent,
  so an over-limit invite fails late — see the gotcha."
- **Customer feedback** — *Export loses table formatting* · Type `Bug` · Area `Export` ·
  Source `Issue` · Link to the issue. Body: "Three reports since v2.3; nested tables flatten
  to text. Affects the PDF path only."

## Status screen

`Product status`, next to the overview:
- `metric` Features, filter Status equals `Building`, unit "building"
- `chart` donut, Features grouped by Status
- `list` Features, filter Status equals `Planned`, showColumns Area, Audience
- `metric` Feedback, trend on Received over 30 days — only if Feedback exists
- `chart` bar, Feedback grouped by Area
- `links` overview, Decisions, Features

## Don't

- Turn the route tree or component folder into Features — that is one grep away; a
  feature is what a user would name.
- Import every issue as feedback. Model the recurring themes with a few representative
  rows, and link the tracker.
- Copy prices from marketing copy when the code disagrees. Write what the code says and
  log the mismatch as an open question.
