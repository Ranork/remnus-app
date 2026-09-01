# How Claude, Cursor, and Codex Can Share One AI Workspace

Most teams don't use one AI coding tool. Someone drafts specs with Claude, someone else lives in Cursor for frontend work, and a CI job runs Codex for tests or refactors. Each tool is good at what it does. The problem shows up between them: Cursor has no idea what Claude decided yesterday, Codex has no idea a task even exists unless someone tells it, and every handoff turns into a person re-typing context that already existed in someone else's chat window.

This is tool fragmentation, and it's not a client problem — it's a state problem. Claude Code, Cursor, and OpenAI Codex are each excellent at reading a repository and executing inside it. None of them ships a concept of "the project," independent of the conversation you're currently having. Their memory, when they have any, is local to that tool and that chat.

This article looks at what it actually takes to run these three agents against one shared project without pretending they synchronize automatically — because they don't, and no MCP client today makes that claim for you.

**A note before we start:** everything below assumes one person is directing an agent at a time, or that agents work on clearly separated, non-overlapping pieces of a task. None of Claude Code, Cursor, or Codex coordinate with each other automatically, and MCP does not provide a locking protocol that makes concurrent writes to the same file or the same task safe by itself.

## Why chat history is not a shared project system

Each of these tools keeps a conversation. Claude Code has a session transcript. Cursor keeps chat/composer history per workspace. Codex keeps its own session log. All three are private to the tool that produced them — and, practically, to the account and machine that ran them.

Three things follow from that:

1. **Chat history doesn't transfer.** If Claude Code decides an API should return a `Result<T, Error>` type instead of throwing, that decision lives in Claude Code's transcript. Cursor never sees it unless a human copies it somewhere, or unless it was written into a file both tools actually read — code, a comment, a committed doc.
2. **A model doesn't "know" what another model did.** There's no cross-vendor channel where Claude's session state leaks into Codex's context, and there shouldn't be — it would be a significant privacy and security problem if it worked that way. Each agent's context is whatever its client assembles for it: repository files, instruction files (`CLAUDE.md`, `.cursor/rules`, `AGENTS.md`), and whatever tools it calls during the session.
3. **Repository files are the closest thing to shared state, but they're partial.** Code and committed docs *are* visible to all three tools, because all three read the filesystem. But "why did we reject the queue-based approach" or "this task is 60% done and blocked on X" usually isn't written into a source file — it lived in a chat and disappeared.

The fix isn't a smarter client. It's treating a small set of project facts as data that lives outside every chat, in a place all three tools can read and write over a common protocol — which is exactly what the Model Context Protocol (MCP) is for. MCP defines how an AI application (the client — Claude Code, Cursor, Codex) calls tools, reads resources, and invokes prompts exposed by a server. It doesn't make chat histories interoperable; it gives every client a shared place to read and write project state explicitly, as an ordinary write, not a hidden hallway between models.

## What information should be shared

Not everything belongs in shared state — only the facts a different tool, a different model, or a different person genuinely needs later. In practice that's a short list:

- **Product requirements.** The spec a feature is being built against — what "done" means, not the conversation that produced it.
- **Active tasks.** What's in progress, who or what owns it, and its current status — a kanban board or task database, not a chat thread.
- **Architecture decisions.** The "we chose X over Y because Z" record. Small, durable, and useless if it's buried three screens into a transcript.
- **Known bugs.** Reproducible issues with enough detail that any agent can pick one up cold.
- **Current status.** Where the project actually is right now, distinct from where a particular agent's session left off.
- **Agent-generated notes.** Gotchas, constraints, and preferences an agent learned mid-task that would otherwise vanish when the session ends — a rate limit discovered by trial and error, a flag that has to stay off in staging.

The common trait: these are things a *different* agent, tool, or person should be able to pick up without re-deriving them from scratch. If it only matters for the next five minutes of the current session, it doesn't belong in shared state — see the next section.

## What should stay tool-specific

Some things genuinely belong to one tool and shouldn't be forced into a shared system:

- **In-flight conversation and reasoning.** The back-and-forth of "try this, no, try that instead" is noise once the task is done. Only the outcome is worth keeping.
- **Tool-specific configuration.** `.cursor/rules`, `CLAUDE.md`, and `AGENTS.md` (or `config.toml` for Codex) are how each client is instructed to behave locally. They can *reference* the shared workspace ("check the task database before starting"), but the instruction file itself is tool-specific by design.
- **Local editor state.** Open tabs, cursor position, undo history — none of it is project knowledge.
- **Draft output before review.** Code an agent is still iterating on, before a human or a second pass has looked at it, doesn't need to be broadcast anywhere. Push it to shared state once it's a real decision or a completed task, not while it's still being shaped.

Getting this split wrong in either direction is its own failure mode: push too much into shared state and it becomes another dumping ground nobody reads; push too little and you're back to chat history as the only record.

## Example workflow

Take a fictional SaaS project — call it **Northwind**, a small internal tool for tracking customer onboarding checklists. None of the specifics below are real; they're here to make the workflow concrete.

```text
1. Human writes a one-line request: "Add a per-customer onboarding
   progress bar to the dashboard."

2. Claude prepares the specification.
   - Reads existing product requirements and related decisions from
     the shared workspace.
   - Writes a new spec page: what the feature does, the data model
     change, and the UI requirement.
   - Creates a task: "Implement onboarding progress bar" — status
     "Backlog," linked to the spec.

3. A human reviews the spec, approves it, moves the task to
   "Ready for dev."

4. Cursor implements the frontend.
   - Reads the task and the linked spec from the shared workspace
     before touching any code.
   - Implements the progress bar component against the spec.
   - Updates the task: status "In Review," a short note on what
     was built and any deviation from the spec.

5. Codex handles tests and a small refactor.
   - Reads the same task and the diff Cursor produced.
   - Writes tests against the new component.
   - Notices the onboarding-status calculation is duplicated in two
     places and extracts it — logs that as a small decision note so
     nobody re-discovers the duplication later.
   - Updates the task: status "Ready for review."

6. A human reviews the code and the task notes, merges, and marks
   the task "Done."
```

The important part isn't that three different models touched the project — it's that at every handoff, the *next* agent's first move is reading shared state, not asking a person to re-explain what happened. Claude never talks to Cursor. Cursor never talks to Codex. Each one reads and writes the same task and spec.

## Preventing conflicts

None of this works safely without a few conventions, and none of the conventions below invent capabilities that don't exist — they're a discipline you apply on top of an ordinary shared task database.

- **One task, one active owner.** Before starting work, an agent (or the person directing it) should set the task's status to something like "In Progress" and, if the schema has one, an owner field, *before* editing anything. A `select`/`status` column and a `user` column are ordinary database fields, not a locking mechanism — nothing prevents a second agent from ignoring that field and editing anyway. The convention only works if every agent's instructions actually check it first.
- **No silent concurrent edits to the same task.** If two agents are pointed at the same task at the same time, that's a process failure, not something the workspace resolves for you. Split work into tasks with non-overlapping scope, or have a human sequence them.
- **Timestamps on everything.** A shared task or page should carry when it was last updated and by what. That's enough for an agent to notice "this task changed since I last read it" and re-read before acting, instead of overwriting a concurrent change blind.
- **Review status is separate from task status.** "Ready for review" and "approved" are not the same state, and a human approval step belongs between "an agent finished" and "this is merged/shipped." Don't let an agent mark its own work as approved.
- **Human approval at the boundary that matters.** Agents can draft specs, implement code, and write tests. Whether that work actually merges, deploys, or becomes the new source of truth is a decision a person makes — the shared workspace can record that decision, but it shouldn't be the thing making it.

## Shared memory vs shared database

"Agent memory" and "shared project database" solve different problems, and conflating them causes trouble.

**Agent memory** is what one agent carries forward about how to work — a preference, a gotcha, a decision it should remember on the next session. It's useful, but it's inherently that agent's (or that tool's) accumulated context, not a project record other tools are expected to consult as authoritative.

**A shared database** is project state that's true regardless of which agent or person is looking at it: the current status of a task, the current spec, the current list of known bugs. It doesn't belong to any one agent's memory — it's the thing every agent's memory should defer to when the two disagree.

The practical rule: if a fact should survive a specific agent forgetting it, and should be visible to a *different* tool or a human without translation, it belongs in the shared database, not in one tool's private memory. [Remnus](https://remnus.com) — an open-source, MCP-native workspace — implements durable agent memory as an ordinary database of pages (with `save-memory` and `recall-context` prompts for writing and reading it token-efficiently), specifically so it isn't a separate opaque store: memory entries are pages like any other, visible to every connected client, and a person can read, correct, or delete one directly.

## Security and permission separation

Connecting three separate coding tools to one workspace multiplies the number of credentials with write access to your project data, and that's worth taking seriously rather than glossing over.

- **Each client authenticates separately.** Claude Code, Cursor, and Codex each hold their own connection to the workspace — their own OAuth grant or their own personal access token. There's no shared credential between them, and there shouldn't be one: if Cursor's token is compromised, you want to be able to revoke it without touching Claude Code's or Codex's access.
- **Read vs write scope matters more with more agents in the loop.** A tool that only needs to read the spec and task board doesn't need a write-scoped token. The more agents you connect, the more that distinction is worth actually using instead of defaulting every connection to full write access.
- **Destructive actions need an explicit confirmation step**, regardless of which client triggers them. A delete or a schema change shouldn't succeed on the first call from any agent — the server should require the agent to see what it's about to remove and confirm.
- **An audit trail is what makes multi-agent work legible after the fact.** When three different tools have all touched the same project, "who changed this task's status, and when" is the question you'll ask sooner or later. That only works if writes are logged with which actor made them, not just what changed.
- **Don't grant one agent broader access than its actual job needs**, even if it's convenient. A test-writing agent doesn't need permission to delete pages; a spec-drafting agent doesn't need database schema changes.

## How Remnus supports a shared MCP workspace

Remnus is a shared, MCP-native workspace: pages, databases, kanban boards, and calendars that any connected MCP client can read and write, sitting behind ordinary auth (OAuth 2.1 + PKCE, or a personal access token) with read/write scope separation. It isn't a synchronization layer between AI tools and it doesn't lock rows or arbitrate concurrent edits — it's the same kind of shared project database described above, reachable identically by Claude Code, Cursor, and Codex, because MCP is the common protocol all three already speak.

What that gets you concretely, without inventing anything beyond what's documented:

- A **task/kanban database** each client can query and update with ordinary fields — status, owner, notes — so "what's the current state of this task" has one answer instead of three tool-specific guesses.
- **Durable specs and decisions** as pages any client can read before it starts work, and write to when it makes one.
- **Agent Memory** as a readable, editable database rather than a private per-tool store, so a gotcha one agent learns is visible to the next one, whatever tool it's running in.
- An **audit log** of writes, so when three different clients have touched the same workspace, you can see who changed what.
- A **Manual / Smart / Strict** context policy that governs how proactively a connected agent pulls project context before acting, and — in Strict mode — requires a fresh context read before certain writes go through. This governs how agents *retrieve context from Remnus*; it doesn't coordinate the agents with each other or replace human review of what they produce.

## Example prompts for each agent

These assume the client is already connected to Remnus over MCP — see the [Claude Code](/docs/connect-claude-code-to-remnus-mcp), [Cursor](/docs/connect-cursor-to-remnus-mcp), and [Codex](/docs/connect-openai-codex-to-remnus-mcp) setup guides for connection steps.

**Claude Code**

```
Read the "Onboarding progress bar" spec in Remnus, then draft an
implementation task with acceptance criteria and add it to the
project's task database with status "Backlog."
```

```
Before starting, search Remnus for any existing decisions about
how onboarding status is calculated, so I don't duplicate logic
that already has a reason behind it.
```

**Cursor**

```
Read the Remnus task "Implement onboarding progress bar" and its
linked spec, then implement the frontend component to match. When
you're done, update the task status to "In Review" with a short
note on what you built.
```

```
Check Remnus for any known bugs tagged "onboarding" before you
touch this component, so I know if this area has open issues.
```

**Codex**

```
Read the Remnus task "Implement onboarding progress bar," including
Cursor's implementation note, then write tests covering the new
component's edge cases.
```

```
If you find duplicated logic while writing these tests, don't just
fix it silently — record a short decision note in Remnus explaining
what you changed and why, so the next agent doesn't rediscover it.
```

## FAQ

### Can Claude, Cursor, and Codex really work on the same project at the same time?

They can all read and write the same shared workspace, but "at the same time" on the *same task* is not something any of them arbitrates for you. Give each agent a distinct, non-overlapping piece of work, and sequence overlapping work through task status and human review rather than assuming simultaneous edits are safe.

### Does connecting all three to Remnus mean they share a conversation?

No. Each tool keeps its own private session and context. What they share is the workspace — tasks, specs, decisions, memory — that each of them can read and write explicitly. Nothing is copied between one tool's chat and another's automatically.

### Do I need Remnus specifically, or does any MCP server work?

Any MCP server that exposes a shared, readable, writable project store works for this pattern — Remnus is one example, chosen here because it's built around exactly this data (tasks, specs, decisions, memory) rather than a single-purpose tool. The workflow itself — write shared facts explicitly, read them before acting, keep a human at the approval boundary — applies regardless of which MCP server backs it.

### What stops one agent from overwriting another agent's work?

Nothing automatic. Task status conventions, timestamps, and requiring a human review step before anything is treated as final are process controls you apply — not something MCP or any client enforces for you by default. Treat concurrent-write safety as a workflow design problem, not a solved one.

### Is this the same as multi-agent orchestration frameworks?

No. This article describes three separate, human-directed tools reading and writing one shared project database — not an autonomous multi-agent system that plans and dispatches work to itself. A person is still deciding what each agent works on and reviewing what comes back.

## Get your project off separate chat histories

The gap between Claude Code, Cursor, and Codex isn't a model capability problem — it's that each one only knows what's in its own conversation unless something outside that conversation records the facts explicitly. A shared task database, a spec page instead of a chat message, a decision note instead of a Slack scroll — that's the whole mechanism, and it works whether the next reader is a different AI tool or a teammate who wasn't in the room.

To try it, [open a Remnus workspace](https://remnus.com) and connect Claude Code, Cursor, or Codex from the **AI Agents** panel, or start with the [MCP documentation](https://remnus.com/wiki) for the full tool, resource, and prompt reference.
