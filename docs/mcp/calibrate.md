# Calibrate

`npx remnus init` connected a project to a Remnus workspace that has not been set up
for it yet (`.remnus/config.json` in that project still says `"calibrated": false`).
This page is a one-time checklist for whichever agent is working in that project —
not a human document. It's served live from this Remnus instance rather than copied
into the project, so it can't go stale: whatever's on this page is always what
following it does, no local file to fall behind as the guide improves.

Before step 1: skim the workspace first (`list_workspace`, `search_workspace`). If
it already has real content — this project reused an existing workspace rather
than a brand-new one — adapt rather than duplicate: fill genuine gaps, don't
recreate what is already there.

## 1. Understand the project

Read enough of the project to describe it accurately: its manifest (`package.json`,
`pyproject.toml`, `Cargo.toml`, a `.csproj`, whatever it uses), its README, its
top-level folder structure and main modules, its commit history (`git log`, not
just the latest commit — look for the *shape* of the work over time), and any docs
a human already wrote for agents (`AGENTS.md`/`CLAUDE.md` above the Remnus section,
`docs/`, `.ai/`). Do not guess — everything you write into the workspace next should
trace back to something you actually read, not to what a project like this
"usually" has.

Also mine what you already know, not just the file tree: if you (the calibrating
agent) have access to earlier conversation or session history for this project —
prior chats, commit messages, PR descriptions, design discussions — read that too.
Decisions, rejected approaches, and the *why* behind a piece of code often live only
in that history and nowhere in the current files. Surfacing exactly that kind of
knowledge before it disappears is the whole point of Remnus — treat this step as
seriously as reading the code.

## 2. Build a workspace that fits *this* project

Use the Remnus MCP tools (`list_workspace`, `create_page`, `create_workspace_database`,
`update_page`, …) to build out what a real project of *this* size and maturity would
actually need to track — don't default to a fixed page count in either direction.

- A small or early-stage project (a fresh scaffold, little history) deserves little:
  one honest page, maybe nothing else. Inventing structure for content that doesn't
  exist yet is worse than a short workspace.
- An established project with real history, multiple modules, and real complexity
  deserves a genuinely elaborate workspace — not capped at two or three pages. Pull
  it apart into what it actually needs: architecture/orientation, conventions and
  gotchas worth remembering, a decisions log (especially anything you found in step
  1's conversation history), a backlog/roadmap seeded from real open work. Keep
  going while you are still finding real, grounded material — stop when you run out
  of substance, not when you hit some page count.

Depth over volume either way: every page/row should trace to something you actually
read, never to what a project "like this" usually has. But for a project with real
substance, a shallow two-page skeleton is just as wrong as an invented one.

## 3. Finish

- Edit the project's local `.remnus/config.json` and set `"calibrated": true` — this
  is the only local file this checklist touches.
- Tell the human, in one or two sentences, what you set up and where to look.
- Then continue with whatever you were actually asked to do — this checklist was a
  detour, not the task.
