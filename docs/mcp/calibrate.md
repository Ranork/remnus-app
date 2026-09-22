# Calibrate

`npx remnus init` connected a project to a Remnus workspace that has not been set up
for it yet (`.remnus/config.json` in that project still says `"calibrated": false`).
This page is a one-time process for whichever agent is working in that project — not
a human document, and not a five-minute checklist either: treat it as a real piece of
work, on the order of writing the project's first design doc, not filling out a form.
It's served live from this Remnus instance rather than copied into the project, so it
can't go stale: whatever's on this page is always what following it does, no local
file to fall behind as the guide improves.

## Where this writes, and how to check it

This step writes to the Remnus workspace the human connected in
[Step 1 of Project Install](project-install.md#step-1-run-the-cli), over the MCP
connection this project's `.mcp.json` grants for every other Remnus read/write,
authenticated by the token their own browser sign-in produced during `init` — the
same server and the same credential the rest of this session already uses.

Every write is logged with the tool name, timestamp, and outcome, visible to the
human right away in the workspace's own UI, and readable in full afterward from the
**AI Agents** panel or by calling `query_audit_log` directly. Remnus (server and
this CLI) is AGPL-3.0, source at
[github.com/Ranork/remnus-app](https://github.com/Ranork/remnus-app) — what happens
to the content on arrival is exactly what's in that repository.

Before phase 1: skim the workspace first (`list_workspace`, `search_workspace`). If it
already has real content — this project reused an existing workspace rather than a
brand-new one — adapt rather than duplicate: fill genuine gaps, don't recreate what is
already there.

If the Remnus MCP tools aren't available in your session yet — normal right after `init`,
because agents load MCP servers when a session starts — stop and ask the human to reload
them (in Claude Code: `/mcp`, then reconnect `remnus`, or start a new session). Don't
work around it by calling the HTTP endpoint yourself.

## Your role for this process: incoming product manager, not a filing clerk

A filing clerk moves existing documents from one shelf to another, unchanged. That is
not the job. The job is closer to a product manager's first two weeks on a project:
read everything, form an actual opinion about what this product is, who it's for,
what stage it's at and what's actually in motion right now — then build the artifacts
a PM would want to have (a decisions log they can filter by area, a backlog they can
sort by priority, a map of how the systems fit together) because they reflect real
understanding, not because a template said to.

Everything below still has to trace back to something you actually read or were told
— a PM's opinions are grounded in the material, not invented. The shift is in what you
*do* with what you read: not "here is a copy of what already exists," but "here is the
structure a person managing this project would actually want."

## Phase 1 — Understand the project deeply

Read enough to describe the project the way someone who'd need to explain it in a
stakeholder meeting would, not just what its manifest declares:

- **What it is and who it's for.** Not "a Next.js app" — what does it actually do,
  for whom, at what stage (prototype, active product, mature/maintenance)? Pull this
  from the README, marketing copy, doc comments, even variable/module names that
  reveal domain concepts — not from what a project "like this" usually is.
- **Its shape and history.** Manifest (`package.json`, `pyproject.toml`, `Cargo.toml`,
  a `.csproj`, whatever it uses), top-level structure and main modules, and
  `git log` — not just the latest commit, read enough of the history to see the
  *arc* of the work: what's been actively developed recently, what's stable and
  untouched, whether there have been pivots or reverts worth knowing about.
- **What a human already wrote down for agents.** `AGENTS.md`/`CLAUDE.md` above the
  Remnus section, `docs/`, `.ai/` — read these as source material to build *from*,
  not boxes to leave sealed (more on that in Phase 2).
- **What you already know, not just the file tree.** If you (the calibrating agent)
  have access to earlier conversation or session history for this project — prior
  chats, commit messages, PR descriptions, design discussions — read that too.
  Decisions, rejected approaches, and the *why* behind a piece of code often live only
  in that history and nowhere in the current files. Surfacing exactly that kind of
  knowledge before it disappears is the whole point of Remnus — treat this step as
  seriously as reading the code.

Do not guess. Everything you build in Phase 3 should trace back to something you
actually read here.

## Phase 2 — Model the concepts this project actually has

This is the phase a simple "copy the docs over" pass skips, and it's the one that
matters most. Before creating anything, decide: *what are the recurring kinds of
thing in this project's world* — not a fixed checklist, a real answer for this
project. Do this in two passes; **neither is optional**, and the second is the one a
lazy calibration skips entirely.

### 2a — Process concepts

The generic ones that recur across almost any software project. Use this as a prompt
for your own thinking, not a mandatory list:

- **Decisions** — binding calls that shaped the product (architecture choices,
  rejected alternatives, "why we don't do X").
- **Backlog / open work** — what's actively planned, in progress, or blocked.
- **Systems / architecture** — how the pieces fit together *right now*.
- **Gotchas / known traps** — recurring failure modes, each with a real incident
  behind it.
- **Glossary** — terms this project's code and docs use that a newcomer wouldn't know
  for free.
- **Open questions / risks** — things nobody has decided yet, but that come up.

Some of these won't apply — a project with no real decision history yet doesn't get
an empty Decisions database for the sake of having one.

### 2b — Domain concepts: what makes *this specific project* worth managing

Process concepts are the same shape for almost any codebase. This pass is about the
opposite: what would only ever come up for *this* project, because of what it
actually is? Ask directly: **if a product manager or project owner were sitting
where you are, what would they want tracked that has nothing to do with engineering
process at all?** The answer depends entirely on the project's domain — that's the
point, don't skip it because it doesn't fit a template:

- A game project might have creatures/enemies, zones or levels, items, balance
  parameters, narrative or lore — real design data a producer would track, not
  engineering backlog.
- A product/company's own workspace (this one, for instance) might have a roadmap of
  future plans, marketing or growth status, competitive positioning, pricing —
  business reality, not code.
- A data or API project might have a source/endpoint inventory, schema versioning
  history, data-quality issues.

These are illustrations of the *kind* of thing to look for, not a checklist — the
actual answer for a given project could be none of these and something else entirely.
Ground it the same way as everything else: look for real evidence before modeling a
domain concept (an Enemy/Creature data model in the code, a design doc, a balance
spreadsheet, a marketing/roadmap doc or a source you're told about elsewhere) — don't
invent a "Creatures" database for a game project just because it's a game, and don't
skip modeling one if the evidence for it is sitting right there in the codebase or
history. If domain data like this is already tracked somewhere you have access to
(another doc, another connected tool, something mentioned in conversation history),
that's real evidence too — reflect and link it rather than re-inventing a second copy.

**For each concept you decide is real, from either pass, choose page vs. database
deliberately:**

- It's a **database** if there are (or clearly will be) multiple genuinely distinct
  instances of the same kind of thing, and a person managing this project would want
  to filter, sort, or track status across them. Three real decisions already is
  reason enough for a Decisions database — don't wait for ten.
- It's a **page** if it's singular — there's one architecture, one orientation, one
  glossary (though a glossary with many independent terms can also be a database,
  one row per term, if that's more useful to browse).
- Never default to "one page with everything pasted in" for something that is
  structurally a list of comparable things. That is the single biggest way this
  process degrades back into filing-clerk work.

**Design each database's schema on purpose**, from what you actually found — don't
reuse a generic Title/Status/Priority template without thinking about whether it fits.
For a Decisions database, for instance: a `Date` property, a `Category`/area
property (so it's filterable by which part of the product it affects), a `Status`
(`Active` / `Superseded`, with a way to point at what superseded it) — and critically,
the row's **content** should read like an actual decision record: what the situation
was, what was decided, *why*, and what was considered and rejected if you know it —
not just the decision's title restated. "We use SQLite locally" is a title. "Chose
SQLite over Postgres for local dev because X, revisit if Y happens" is a decision.

The same discipline applies to every other concept you model: a Backlog row's content
should say what the work actually is and why it matters, not just restate its title; a
Gotcha's content should name the real incident it came from, not describe a generic
category of bug.

**If this material already exists as plain files in the repo** — a decisions log, an
architecture doc, a gotcha list, checked into git — that is not a reason to skip it.
A file only an agent with a terminal can read is not doing what Remnus is for: making
this content visual, filterable, and reviewable by a human. Convert it *into the
modeled structure above*, don't paste the file's prose into a single page and call it
imported — a wall of text in one page is exactly the failure mode this phase exists to
avoid, whether the source was your own synthesis or someone else's file.

"Don't duplicate" (the workspace-reuse note above) means don't paste in a static
snapshot that will keep silently drifting from a file someone is still editing
directly — it does not mean leave the file untouched and skip importing it. Those are
different failures; this step exists to fix the second one, not to excuse it. If,
after importing, you're unsure whether the local file should stay authoritative going
forward or Remnus should become the new source of truth, ask the human — that's a real
decision, not yours to make silently.

Scale with the project, not with a target count: a small or early-stage project (a
fresh scaffold, little history) genuinely deserves little — one honest orientation
page, maybe nothing else, if that's all the material supports. An established project
with real history and real complexity deserves several well-modeled databases, each
with real rows, not two pages and a token gesture at a backlog. Keep going while
you're still finding real, grounded material; stop when you run out of substance, not
when you hit some number.

## Phase 3 — Build it

Use the Remnus MCP tools to construct what Phase 2 designed. The human will open this
workspace in a sidebar, not read it through an API — so its *shape* is part of the work,
not decoration.

**Plan the tree before writing anything.** Decide the handful of top-level sections a
person would expect to see (typically 4–9: an overview page, the main databases, one
parent page per larger area) and what nests under each. A root that is a flat list of
twenty sibling pages is the most common way a well-researched calibration still ends up
hard to read.

- Start with one **overview page** at the root that orients a newcomer and links to the
  rest.
- Group related pages under a parent: a dozen "System: …" pages belong under one
  "Systems" page — or become rows of a Systems database if they're comparable enough to
  filter — not beside everything else at the root.
- Nest with `parentId` (an existing item) or, inside one `bulk_create_pages` call, with
  `ref` / `parentRef`, so a parent and its children are created together.
- Databases can be nested too (`create_database` takes `parentId`) when they belong to one
  area rather than to the whole project.
- If the workspace already holds a flat list from an earlier pass, restructure it with
  `bulk_move_items` instead of recreating it.

**Give everything an icon.** Every page and database gets one — an emoji (`🗺️`) or a
Lucide icon (`lucide:Map`, with an `iconColor` such as `blue` or `green`). Keep them
consistent within a section so the sidebar can be scanned at a glance. Set them at
creation (`icon`/`iconColor` on `create_page`, `bulk_create_pages`, `create_database`);
fix existing items with `update_page` or `bulk_update_pages`.

**Give every database the views a person would actually use.** A Table view always
exists; add the others when you create the database (`create_database`'s `views`), or
later with `create_database_view`:

- a **Kanban** grouped by the status/state column for anything with a lifecycle — backlog,
  open questions, decisions by status;
- a **Calendar** on the date column for anything dated — decisions, releases, events;
- an extra **Table** only when a slice is genuinely looked at on its own.

Give select/status columns real options; they're colored automatically.

**Build in batches.** `bulk_create_pages` creates up to 100 pages or rows per call — use it
for every database's rows and for each section's pages. One `create_page` per row turns a
ten-minute job into a forty-minute one.

A few more mechanical notes:

- Create each database with the schema you designed, not an afterthought default.
- Write real content into every row — see the decision-record example above. A row with
  only a title and a status is a task list item, not the knowledge Remnus exists to hold.
- Titles are plain text: write `Scene Flow & Bootstrap`, never `Scene Flow &amp; Bootstrap`.
- Cross-reference where it's genuinely useful (a decision that shaped a system, a gotcha
  that explains why a decision was made the way it was) rather than leaving every
  collection floating on its own.

Depth over volume: every page/row should trace to something you actually read in Phase 1,
never to what a project "like this" usually has. But for a project with real substance, a
shallow skeleton is just as wrong as an invented one — this phase should feel like it took
real work, because Phase 2's modeling was real work.

## Phase 4 — Review and finish

- Skim what you built as if you were the human opening it for the first time: does it
  actually read like someone who understands this project put it together, or does it
  read like a template got filled in? If the latter, go back — this is the check that
  catches a lazy pass through Phase 2.
- Look at the structure the way the human will: `list_workspace` at the root should read
  as a short, meaningful set of sections; every page and database should have an icon;
  every database with a status or date column should have the matching Kanban or Calendar
  view. Fix what doesn't before finishing.
- If Phase 2b produced no domain databases, say why in your summary — "nothing in the
  material supported one" is a fine answer; silently skipping the pass is not.
- Edit the project's local `.remnus/config.json` and set `"calibrated": true` — this
  is the only local file this process touches.
- Tell the human, in a few sentences, what concepts you modeled, why (briefly), and
  where to look — not just "I set up a workspace."
- Then continue with whatever you were actually asked to do — this process was a
  detour, not the task.
