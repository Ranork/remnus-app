# How to Build an AI-Native Workspace for Vibe Coding

It starts with one prompt: "build me a habit tracker with auth and a paid tier." An hour later you have a working app. A week later you have forty more prompts scattered across three chat threads, a bug you fixed once that came back, a payment flow you're not sure was ever tested, and no memory of why you picked the database you picked. The code still works — mostly — but you've lost the map.

["Vibe coding,"](https://en.wikipedia.org/wiki/Vibe_coding) the term Andrej Karpathy coined in February 2025 for describing a task in a prompt and letting an LLM generate the code, is a genuinely fast way to get from idea to working software. It's also not a project-management methodology, and it was never meant to be one. This guide is for indie hackers, designers, and founders who want more structure than "scroll up in the chat" without adopting a process built for a 200-person engineering org.

## Why vibe-coded projects become chaotic

None of this is a knock on non-traditional developers or a reason to distrust AI-assisted code — it's what happens to *any* fast-moving project, agent-built or not, when nothing outside the conversation tracks state.

- **Requirements scattered across chats.** The actual spec for a feature lives in whichever chat thread you happened to describe it in, and there are now five of those.
- **Repeated context explanations.** Every new session starts by re-explaining the same architecture decision, because nothing wrote it down outside that one conversation.
- **Untracked bugs.** A bug gets mentioned, "fixed" in the same breath, and never actually verified — so it comes back, and nobody remembers it was ever reported the first time.
- **Accidental regressions.** A later prompt touches code a different feature depended on, and nothing catches it because there was never a list of what "working" meant for the earlier feature.
- **Missing deployment notes.** The one command that has to run before deploy, or the env var that has to be set, lived in a terminal scrollback that's long gone.

This isn't hypothetical caution. A December 2025 CodeRabbit analysis found AI-co-authored code carried 1.7 times more major issues and 2.74 times higher security-vulnerability rates than human-reviewed baselines — not because the model writes bad code on purpose, but because nothing was tracking what needed a second look. Structure is what closes that gap, and it doesn't have to be heavy.

## The minimum viable workspace

Seven pieces cover most of what a vibe-coded MVP needs to stay legible. Not all of them require a dedicated tool — some are just a database you set up once with the right columns:

| Piece | What it holds | In Remnus |
| --- | --- | --- |
| Product brief | What you're building and for whom, in one page | The built-in **Project Brief** page template |
| Feature database | Every feature, its status, and what "done" means | A custom database — field template below |
| Bug tracker | Every reported bug, with reproduction steps and status | A custom database — field template below |
| Kanban board | What's actively being worked on right now | The built-in **Task Tracker** template (ships with a Board view) |
| Decision log | Why you chose X over Y, so it's not re-litigated | A custom database — field template below |
| Release checklist | What must be true before you ship | A page or a simple checklist database |
| Agent memory | Durable facts, gotchas, and preferences across sessions | The built-in **Agent Memory** template |

Three of these — Project Brief, Task Tracker, and Agent Memory — are templates that ship with Remnus (**New item → Templates**). The rest are databases you create once with `create_database` or the **New item** menu; there's no dedicated "Bug Tracker" or "Decision Log" template today, which is exactly why the field templates below exist — copy the schema once and you're done.

## A recommended project structure

A sidebar this size is enough for most solo or two-person MVPs:

```
Workspace
├── Product Brief              (page)
├── Decision Log                (database)
├── Release Checklist           (page)
├── Feature Tracker             (database)
│   └── each row = one feature, linked to its bugs
├── Bug Tracker                 (database)
├── Kanban Board                (Task Tracker template)
└── Agent Memory                (Agent Memory template)
```

**Feature database — copyable field template:**

| Column | Type | Notes |
| --- | --- | --- |
| Title | text | The feature name |
| Status | select | Backlog / In Progress / Shipped / Cut |
| Priority | select | High / Medium / Low |
| Spec | text (body) | What it does, written once, referenced instead of re-explained |
| Linked bugs | text or relation | Reference bug rows tied to this feature |

**Bug database — copyable field template:**

| Column | Type | Notes |
| --- | --- | --- |
| Title | text | Short description |
| Status | select | Open / Fixed / Verified / Won't Fix |
| Severity | select | Blocker / High / Low |
| Repro steps | text (body) | Exact steps — this is what stops a "fixed" bug from silently coming back |
| Found in | text | Feature or area affected |

**Decision log — copyable field template:**

| Column | Type | Notes |
| --- | --- | --- |
| Title | text | The decision, stated as a conclusion ("Use Postgres, not SQLite") |
| Date | date | When it was made |
| Alternatives considered | text (body) | What else was on the table |
| Reasoning | text (body) | Why this one won — this is the part that gets asked again in a month |

## Session-start and session-end agent routines

**At the start of a session:** point the agent at the product brief and the current kanban column before writing any code — "Read the product brief and the In Progress column. Tell me what you're picking up and why before you start."

**At the end of a session:** don't let the session close without a status update — "Update the feature/bug row with what changed, move it on the kanban board if its status changed, and propose one decision-log entry if you made an architectural choice this session. Wait for my OK before writing it."

That second habit is the one that actually prevents the "why did we pick this" problem — it only works if it happens every session, not "when you remember to."

## Example workflow for building an MVP

A fictional example: you're building **Loopnote**, a small habit-tracking app with email auth and a $5/month paid tier.

1. **Day 1** — write the product brief by hand (or dictate it to the agent): what Loopnote does, who it's for, what's in the free tier vs. paid. This becomes the thing every later session gets pointed at instead of re-explained.
2. **Day 1–2** — create the feature database, add rows for "Habit CRUD," "Daily check-in streak," "Email auth," "Stripe subscription." Mark them Backlog.
3. **Day 2** — start building. As the agent implements "Habit CRUD," move that row to In Progress on the kanban board, then Shipped once it works end to end.
4. **Day 3** — a bug shows up: streaks reset a day early in one timezone. Log it in the bug database with exact repro steps *before* asking the agent to fix it — that's what makes "fixed" verifiable instead of just claimed.
5. **Day 4** — you pick Stripe over a custom billing table. Log it in the decision log with the alternative you considered and why Stripe won, in two sentences.
6. **Day 5** — before adding auth, the agent (per its session-start routine) reads the product brief and the decision log, so it doesn't re-propose the billing approach you already settled.
7. **Ship day** — run through the release checklist by hand. This step doesn't get delegated.

Nothing here is heavy. It's the same five documents most competent teams keep — just sized for one person and an agent instead of a department.

## What the human must still review

An agent can write the code, draft the decision-log entry, and move the kanban card. It should not be the last check on anything in this list — a person reviews these before shipping, every time:

- **Security** — auth flows, input validation, anything touching user-submitted data.
- **Payments** — Stripe or any billing integration, including webhook handling and what happens on a failed or disputed charge.
- **Authentication** — session handling, password reset flows, and anything that decides who's allowed to see what.
- **Data deletion** — does "delete my account" actually delete the data, and does it cascade correctly?
- **Migrations** — a schema change that runs cleanly in development can still corrupt production data; review the migration, don't just run it.
- **Deployment** — env vars, secrets, and the exact deploy steps, confirmed working, not assumed working.

Vibe coding doesn't remove the need for testing, security review, or architectural judgment — it changes who's available to apply that judgment at each step, which makes writing it down more important, not less.

## How Remnus can become the shared workspace

Everything above works as plain documents in any tool. Where [Remnus](https://remnus.com) fits is when the AI agent itself needs to read and write the same feature database, bug tracker, and decision log you're looking at — not a copy, the actual records — over MCP. The [Project Brief and Task Tracker templates](https://remnus.com/wiki/getting-started) give you the product brief and kanban board in one click; the [Agent Memory](https://remnus.com/wiki/agent-memory) template and its `save-memory` / `recall-context` prompts handle the "don't re-explain the architecture every session" problem directly, as ordinary, human-editable pages rather than something hidden in a vector store. For the deeper mechanics of why that beats retyping context into every new chat, see [How to Give Claude Code Persistent Memory and a Shared Workspace](/docs/claude-code-persistent-memory-workspace). For the fuller framework this guide is a lightweight version of — approval gates, permissions, auditability — see [AI Agent Project Management: The Complete Guide](/docs/ai-agent-project-management-guide).

## Copy-ready prompts

1. **Session start:** "Read the product brief and the current In Progress column on the kanban board. Tell me what you're picking up and why, before writing any code."
2. **New feature:** "Create a row in the Feature database titled '<feature>' with status Backlog. Write a two-paragraph spec in the body before implementing anything."
3. **Bug report:** "Log a row in the Bug database for <symptom>, with exact reproduction steps in the body and severity set. Don't fix it yet — just log it."
4. **Bug fix verification:** "Before marking this bug Fixed, restate the original repro steps and confirm each one no longer reproduces the issue."
5. **Decision log:** "Propose a decision-log entry for the choice we just made: what we chose, what we considered instead, and why. Wait for my approval before writing it."
6. **Session end:** "Update every feature/bug row you touched this session with its current status, move kanban cards to match, and summarize what's still open."
7. **Pre-release review:** "Walk through the release checklist item by item. For each one, tell me whether it's verified or still assumed, and don't mark anything verified you haven't actually checked."
8. **Context reload:** "Recall what the workspace already knows about <topic> before we continue — decisions, gotchas, and anything relevant from the bug tracker."

## FAQ

### Does vibe coding mean I don't need to review the code?

No. Vibe coding describes how the code gets written — from a prompt rather than line by line — not whether it needs review. Testing, security review, and architectural judgment are still required; a workspace like this makes it clear *when* to apply them, not optional to apply them.

### Is this overkill for a weekend project?

For a true throwaway prototype, probably. The moment a project has a second work session, a paying user, or data you'd be upset to lose, the five documents above cost less than the time you'll spend reconstructing context without them.

### Do I need separate databases for features and bugs, or can I combine them?

Combining them works for very small projects — a single "Type" column (Feature / Bug) can substitute. Splitting them helps once either list grows past what fits on one screen, since features and bugs have genuinely different fields (a spec vs. repro steps).

### What if I'm using a client that doesn't support MCP resources or prompts?

Everything here still works as plain tool calls or, at minimum, as documents a person edits directly — the workspace structure doesn't depend on any one client's UI. Client support for MCP resources and prompts specifically does vary, so check what your editor supports.

### How is this different from just using a project-management tool like Linear or Notion?

It's not fundamentally different in structure — it's the same five documents. The difference is whether your AI agent can read and write them directly as part of doing the work, instead of you copying context back and forth between a chat window and a separate tool.

### What's the single highest-leverage piece to set up first?

The product brief. Everything else — what a feature's spec references, what a decision log entry justifies, what the kanban board tracks — points back to it. A five-minute product brief prevents more repeated-context sessions than any other single document here.

## Start light, add structure as it earns its place

None of this needs to exist before you write the first line of code. Add the product brief on day one, the feature and bug databases when you notice yourself re-explaining something, and the decision log the first time you catch yourself asking "wait, why did we do it this way?" The workspace should grow with the project, not gate it.

[Try Remnus](https://remnus.com/) to set up a Project Brief, Task Tracker, and Agent Memory in a few minutes, then connect your coding agent and keep building.
