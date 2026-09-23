# Calibrate

`npx remnus init` connected a project to a Remnus workspace that has not been set up
for it yet (`.remnus/config.json` says `"calibrated": false`). This page is a one-time
process for the agent working in that project: read the project, model what it actually
contains, and build that into the workspace. Treat it as real work — closer to writing
the project's first design doc than to filling in a form. It is served live from this
Remnus instance, never copied into the project, so what it says is always current.

Guide version: **2**.

## Before you start

- **No Remnus tools in your session?** Normal right after `init`: agents load MCP servers
  when a session starts. Stop and ask the human to reload them (Claude Code: `/mcp`, then
  reconnect `remnus`, or start a new session). Don't call the HTTP endpoint yourself.
- **Has this run before?** If `.remnus/config.json` has `"calibrated": true`, or
  `.remnus/workspace-map.md` (no map file: the `remnus://workspace/{id}/digest` resource)
  lists a `Calibration Log` page, go to [Running it again](#running-it-again) instead.
- **Workspace already has content but no log?** The project reused a workspace. Grep the
  map, fill real gaps, and never recreate what is there.
- **A write returns `CONTEXT_REQUIRED`?** The workspace is in Strict mode. Call
  `prepare_context` once with the task "Calibrate this workspace to <project>" and pass its
  `contextRunId` on every write.

Everything you write goes over this project's own MCP connection (`.mcp.json`, with the
token the human's sign-in produced), into the workspace they chose. Each write is logged
with tool, time and outcome — visible live in the workspace and in full in the **AI
Agents** panel or `query_audit_log`. Remnus and its CLI are AGPL-3.0:
[github.com/Ranork/remnus-app](https://github.com/Ranork/remnus-app).

## Your role: incoming product manager, not filing clerk

A filing clerk moves documents from one shelf to another, unchanged. A product manager's
first two weeks look different: read everything, form a grounded opinion of what the
product is, who it's for, what stage it's at and what is in motion — then build what they
would want to manage it with: a decisions log filterable by area, a backlog sortable by
priority, a map of how the systems fit. Every opinion traces to something you read or
were told; what changes is what you *do* with it.

## Calibration fails if you

- **Fill a template** — create a database, column or row because projects "like this"
  usually have one, not because you found evidence for it.
- **Paste** — put a README or doc into one page and call it imported, or copy what one
  grep of the repo answers (file lists, dependency lists, signatures) instead of what the
  code can't say: why, status, trade-offs, what was rejected.
- **Leave hollows** — an empty database, a "TBD" page, a row whose body restates its title.
- **Invent** — a decision, date, owner or status you didn't read or get told.
- **Sprawl** — a flat root of twenty siblings, or items without icons.
- **Loop** — one `create_page` per row where one `bulk_create_pages` call would do.

## Keep a Calibration Log

Before anything else, create a root page **Calibration Log** (`lucide:CheckSquare`). It is
how an interrupted run resumes and how the human watches the plan take shape. Keep in it:

- date, guide version, and the project commit (`git rev-parse --short HEAD`);
- the sources you read (files, docs, history range);
- **the plan, written before you build**: the tree, and for each concept page or database
  with its columns;
- a checklist of build steps, ticked as each lands, with the ids it created;
- what you skipped and why; open questions for the human.

A log with unticked steps means you are resuming: continue from the first unticked step
and don't redo ticked ones. Once the overview page exists, move the log under it.

## Phase 1 — Understand the project

Read for structure first, then depth where the concepts live — not every file:

- **What it is and who it's for** — not "a Next.js app": what it does, for whom, at what
  stage. From the README, marketing copy, doc comments, domain names in the code.
- **Shape and history** — the manifest (`package.json`, `pyproject.toml`, `Cargo.toml`,
  `*.csproj`…), top-level structure, entry points, and enough `git log` (`--stat` shows
  where work concentrates) to see the arc: what is active, what is stable, any pivots or
  reverts.
- **What humans wrote for agents** — `AGENTS.md`/`CLAUDE.md` outside the Remnus section,
  `docs/`, `.ai/`, `.serena/memories/`, `.cursor/rules/`, `.clinerules/`, and the paths
  outside the project those files point to. Source material to build from, not boxes to
  leave sealed.
- **What you already know** — earlier conversations, commit messages, PR descriptions.
  Decisions and rejected approaches often live only there; capturing them before they
  disappear is the point of Remnus.

**Then check the [playbooks](playbooks.md).** Compare their recognition signals with what
you read, and read **at most two** whose signals are actually present. If none match, read
none — "the closest one" is the wrong answer. A playbook is a list of things to look for,
not a template: nothing from it gets built without evidence in this project.

## Phase 2 — Model the concepts

Decide what the recurring kinds of thing in this project's world are. Two passes; neither
is optional.

**2a — Process concepts**, common to most projects: decisions, backlog/open work,
systems/architecture, gotchas (each with a real incident behind it — a fix commit
counts), glossary, open questions/risks. Only the ones with material behind them.

**2b — Domain concepts**, what only *this* project has. Ask: what would its product
manager want tracked that has nothing to do with engineering process? A game's enemies,
zones and balance data; a company's roadmap, pricing and positioning; an API's endpoint
inventory and schema versions. Look for evidence (a data model, a design doc, a
spreadsheet, a doc you were pointed at) and model what is there; if it already lives in
another tool, link it rather than make a second copy.

For each concept, choose deliberately:

- **Database** when there are (or clearly will be) several comparable instances a person
  would filter, sort or track by status. Three real decisions justify a Decisions database.
- **Page** when it is singular: the architecture, the orientation, a short glossary.
- Never one page with a list of comparable things pasted in — that is the filing clerk.

**Design each schema from what you found**, not a Title/Status/Priority reflex. A
Decisions database wants `Date`, an `Area` select (filter by part of the product), a
`Status` (`Active` / `Superseded`) — and each row's body is a decision record: situation,
choice, *why*, what was rejected. "We use SQLite locally" is a title; "Chose SQLite over
Postgres for local dev because X; revisit if Y" is a decision. A Backlog row says what
the work is and why it matters; a Gotcha names the incident it came from.

**Files already in the repo** (a decisions log, an architecture doc, a gotcha list) get
converted into this structure, not skipped and not pasted whole. If you're unsure whether
the file or Remnus should be the source of truth from now on, ask the human.

Scale with the material, not a target count: a fresh scaffold may deserve one honest
overview page; an established project deserves several databases with real rows. Stop when
you run out of substance. Write the result into the log as the plan.

## Phase 3 — Build it

The human reads this in a sidebar, so the shape is part of the work.

- **Tree:** 4–9 top-level items — an **overview page** first that orients a newcomer and
  links onward, then the main databases and one parent page per larger area. Nest with
  `parentId`, or `ref`/`parentRef` inside one `bulk_create_pages` call; `create_database`
  takes `parentId` too. Restructure an existing flat list with `bulk_move_items`.
- **Icons on everything** — emoji or `lucide:Name` + `iconColor` (`blue`, `green`…),
  consistent within a section, set at creation.
- **Databases in one pass:** `create_database` with the designed schema, real select/status
  options, and its `views` — Kanban on the status column, Calendar on the date column,
  an extra Table only for a slice people look at on its own. Then **all its rows in one
  `bulk_create_pages` call** (up to 100), each with a real body.
- **Label concepts** so context packs find them: on every concept row, page and
  database pass `knowledge` with `conceptType`, `tags` — the words someone would search
  for, in the team's language *and* English — and `sources`, the repo files it rests on:
  `"knowledge": {"conceptType": "decision", "tags": ["davet", "invitation", "auth"], "sources": [{"resource": "src/auth.ts"}]}`.
  `bulk_create_pages`, `create_page` and `create_database` all take it.
- **A status screen** when a database has a lifecycle or dates worth watching: read
  `remnus://dashboard/catalog`, then one `create_dashboard` with 3–6 blocks over the
  databases you just filled — open items (metric), status mix (donut), next due (list
  sorted by date), links to the overview and main databases. None when nothing has a
  status or date: a dashboard of zeros is noise.
- Write in the team's language — the one its docs, commits and the human asking you use;
  code identifiers stay as they are. Titles are plain text (`Scene Flow & Bootstrap`,
  never `&amp;`). Cross-link where it explains something — the decision behind a system,
  the gotcha behind a decision.

## Phase 4 — Check before you call it done

Run `npx remnus sync` and read `.remnus/workspace-map.md` (or the digest resource) as the
human would see the tree — it is also what the next session starts from. Fix until every
line holds:

1. The root has 4–9 items, overview first; every page, database and dashboard has an icon.
2. Every database has at least 3 real rows (fewer: make it a page, or say why in the log),
   real select/status options, and the Kanban/Calendar view its columns call for.
3. Sample three rows per database with `get_page`: each body says more than its title.
4. You can name the source of every item you built. Delete what you can't, or move it
   to the log as an open question.
5. 2b is answered: domain databases exist, or the log says why none do.
6. Concept items carry `knowledge` tags and sources.
7. Every log step is ticked; open questions are listed.

## Finish

- Set `"calibrated": true`, `"calibratedAt": "<ISO time>"` and `"calibrationGuide": 2`
  in `.remnus/config.json` — the only local file this touches.
- Tell the human in a few sentences what you modeled, why, and where to look (the
  overview, the dashboard, the open questions in the log).
- Then do what you were actually asked to do — this was a detour, not the task.

Ask the human only when sources contradict each other, when it is unclear whether a file
or Remnus is the source of truth, or when restructuring would move content a person wrote.
Don't ask for approval of the plan — it is in the log, where they can already see it.

## Running it again

A calibrated workspace is extended, never rebuilt:

1. Read the Calibration Log: what was built, from which commit, with which guide version.
   No log means guide version 1: read the map instead and create the log now.
2. Scope the pass to what changed — `git log <logged commit>..HEAD` for the project, and
   what this guide added since the logged version (version 2: the log itself, `knowledge`
   labels, the status screen).
3. Add rows and pages for new material, and missing labels, views and icons. A concept
   that already has a database or page gets extended, never a second copy.
4. Don't overwrite a body you didn't write in this run and never delete: `add_comment` on
   what looks wrong and list it in the log for the human.
5. Append a dated section to the log; update `calibratedAt` and `calibrationGuide`.
