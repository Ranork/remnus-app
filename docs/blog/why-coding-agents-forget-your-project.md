# Why Coding Agents Forget Your Project Between Sessions

You explain the same architecture decision on Tuesday, again on Thursday, and once more the following Monday. The agent writes good code each time — it just doesn't remember why the last approach was rejected, which migration owns which environment, or that "the staging webhook is eventually consistent" is a fact your team already paid to learn.

That's not a bug in one product. It's a predictable result of how session boundaries, context selection, and documentation scope interact. This article covers what's actually happening when an agent "forgets," why a bigger context window doesn't fix it, and how to build a context system — instructions, documentation, task tracking, and memory — that survives past one conversation.

## What developers mean when they say an agent "forgot"

"Forgot" usually collapses four different failures into one word:

- **It never knew.** The fact lived in a conversation that ended without being written anywhere durable — there was nothing to forget.
- **It knew, but the new session didn't load it.** The record exists in a file or a memory store, but nothing in this session's startup sequence pulled it in.
- **It loaded something, but not the right thing.** Retrieval surfaced a stale or irrelevant record instead of the current one.
- **It's contradicting itself.** An old note says one thing, the code now does another, and the agent picked one without telling you it had to choose.

Each has a different fix. Confusing them is why "just give it more memory" so often disappoints — more storage doesn't help if the real problem is retrieval, and better retrieval doesn't help if the fact was never recorded.

## Five reasons project context disappears or becomes unreliable

### 1. Session boundaries

Every new coding-agent session starts from a blank slate. Anthropic is direct about this for Claude Code: "Each Claude Code session begins with a fresh context window." Instruction files and, in Claude Code's case, [auto memory](https://code.claude.com/docs/en/memory) carry knowledge forward — the raw conversation does not. Once a session ends, its transcript isn't a database anyone queries later; it's gone unless something wrote a durable record before closing.

### 2. Context selection

Even when durable records exist, something has to decide which ones enter this session — and that's where a lot of "forgetting" actually happens. Claude Code's auto memory loads only the first 200 lines (or 25KB) of a project's `MEMORY.md` index automatically; any topic file it points to is read on demand, only if the agent chooses to open it. A true fact in an unopened topic file behaves exactly like a forgotten one.

Retrieval-augmented generation (RAG) has the same failure mode from a different angle: a vector search returns whatever is closest to the query, not whatever is true or current. If a six-month-old incident report doesn't score high enough against "rate limit," it never surfaces — not because it was deleted, but because it lost a ranking contest.

### 3. Repository and machine scope

Context is scoped to a place, and agents move between places more than people assume. Claude Code's auto memory directory is shared across worktrees of the same repo, but explicitly *not* across machines: "Files are not shared across machines or cloud environments." A CI runner, a fresh clone, or a cloud sandbox each starts with zero accumulated memory, even on a project you've worked for months elsewhere.

Instruction files have scope rules too. Claude Code loads `CLAUDE.md` walking up from the launch point; nested `CLAUDE.md` files in subdirectories load only when the agent reads a file there, not at startup. [Cursor's project rules](https://cursor.com/docs/context/rules) work the same way — a rule applies once its file is opened or its description matches the task. Nothing is missing; it just hasn't come into scope yet.

### 4. Unstructured documentation

A long wiki page with no headings, tags, or review date is technically available to an agent, but expensive to use correctly. The agent has to read the whole thing and infer what's current versus historical every single time, because nothing marks it as already interpreted. Structured metadata — a type, a status, a review date — is what turns "the agent could theoretically find this" into "the agent reliably finds this without re-deriving it."

### 5. Conflicting or outdated instructions

Two sources of truth that disagree are worse than one source that's silent. Claude Code's own documentation names the failure mode plainly: "If two rules contradict each other, Claude may pick one arbitrarily." A memory that says a decision is final while the code has since moved on, or a task board reading "Done" next to a stale note reading "blocked," forces a silent coin flip — and you only learn which way it landed by reading the output.

## Why larger context windows do not fully solve the problem

A bigger window changes how much *could* fit, not what actually gets selected, and not how reliably a model uses everything it's given. Two limits remain even at generous window sizes:

- **Selection still happens before generation.** A human, a retrieval system, or the agent's own judgment still has to decide what enters the prompt. A window twice as large just moves the same selection problem to a higher ceiling.
- **Attention over very long context isn't uniform.** Models are well known to use information near the start or end of a prompt more reliably than material buried in a long middle section. Padding a prompt with everything "just in case" can bury the fact that matters as effectively as never including it.

There's a cost dimension too: every extra token in every session's startup context is spent whether or not it's relevant to the task. Claude Code's own guidance for `CLAUDE.md` — target under 200 lines, move reference material to path-scoped rules — exists because loading more doesn't reliably improve adherence; it usually worsens it at higher cost. The fix for forgetting is a better-organized context system, not a bigger bucket to dump everything into.

## The layers of a reliable context system

No single mechanism does every job. A working setup treats these as distinct layers with different owners, lifetimes, and failure modes:

| Layer | Who writes it | What it's good at | Typical lifetime / scope |
| --- | --- | --- | --- |
| Instruction files (`CLAUDE.md`, `AGENTS.md`, Cursor rules) | A person, checked into version control | Standing rules: conventions, required commands, boundaries | Loaded at session/prompt start; scoped by directory or file pattern |
| Project documentation | People (and agents, with review) | Explaining how and why something works, for humans and agents alike | Lives in the repo or a docs system; read on demand |
| Task database | People and agents, jointly | The authoritative answer to "what should happen now" | Changes constantly; one row per unit of work |
| Decision log | People, sometimes agent-proposed | Recording *why* a path was chosen or rejected, with the alternatives considered | Append-mostly; long-lived, rarely edited after the fact |
| RAG / retrieval | Nobody — it's a search mechanism over other layers | Finding candidates in a large corpus by similarity | As current as its index; doesn't judge truth or importance |
| Persistent agent memory | The agent, from what it observed | Compact, reusable learnings — preferences, gotchas, facts | Long-lived, but only as accurate as its last review |

These overlap in practice but shouldn't overlap in responsibility. RAG can help find any of the other layers inside a large corpus, but it doesn't decide whether what it found is still true — that's what review dates and status fields are for.

## What information belongs in each layer

- **Instruction files** — standing rules for every session in scope: coding standards, required verification steps, security boundaries. Concrete enough to verify ("run `npm test` before committing"), not vague ("test your changes").
- **Project documentation** — explanations read when relevant, not every session: how a subsystem works, setup steps, API contracts, runbooks.
- **Task database** — one authoritative status per unit of work: title, owner, status, next step. If a memory and a task record disagree, the task record should win, or the disagreement should stop the agent rather than get silently resolved.
- **Decision log** — a choice, its alternatives, and the reasoning, dated and scoped, so the next agent doesn't re-attempt something already tried and rejected.
- **RAG** — a way to search a large corpus of the layers above; not a source of truth on its own, and not a substitute for tagging content with type, date, and status.
- **Persistent memory** — compact, durable learnings about *how* to work in this project: a gotcha, a preference, a fact worth carrying forward without re-deriving it.

## A practical session-start and session-end workflow

**Start:** read instruction files first (already loaded), pull only the memory and documentation relevant to the actual task, then check the task database for current state before touching code.

**End:** report what changed and what's still open before proposing anything for permanent storage, so a person can catch a wrong inference while it's still fresh — not three sessions later.

```text
# Session start
Read the project's instruction files and any active task for this area.
Recall only durable decisions and gotchas related to <the task>.
Tell me which task is authoritative and what to inspect before changing anything.

# Session end
Summarize what changed, what you verified, and what's still open. Then
propose up to three durable memories — each with type, scope, evidence,
and a review date. Skip anything already documented or unlikely to recur.
Wait for my approval before saving.
```

## How Remnus can serve as a shared external workspace

Instruction files and auto memory solve the local, single-agent version of this problem well. A team also needs a place both people and multiple agents can read and write the same record — a different problem, and the one an [MCP](https://modelcontextprotocol.io/docs/learn/architecture)-connected workspace like Remnus is built for. MCP itself is explicit about its own boundary: it "focuses solely on the protocol for context exchange—it does not dictate how AI applications use LLMs or manage the provided context." MCP gives an agent a standard way to reach a server's tools, resources, and prompts; what the server stores and how it's organized is the application's decision.

Remnus's [Agent Memory](https://remnus.com/wiki/agent-memory) is a database template with `Title`, `Type` (`Decision` / `Preference` / `Gotcha` / `Fact`), `Tags`, and `Date` columns, paired with two MCP prompts: `save-memory` prepares a structured record for the agent to write, and `recall-context` returns compact outlines — not full page bodies — plus the linked neighborhood of the best match. Because it's ordinary workspace content rather than an opaque embedding store, a person can open the same database, correct or delete a wrong entry, and the next `recall-context` reflects that edit immediately.

Remnus also layers [OKF-aligned knowledge metadata](https://remnus.com/wiki/context-first) — type, tags, lifecycle state, an exact-revision human-review flag — on pages and rows, and uses it in `prepare_context` (Context Pack v2) to rank relevant, current material within an explicit token budget. None of it reaches outside Remnus, though — it can't intercept local file edits, shell commands, or Git, which is why instruction files and workspace records are complementary layers, not competitors. See [How to Give Claude Code Persistent Memory and a Shared Workspace](/docs/claude-code-persistent-memory-workspace) and [How Remnus Uses OKF to Give AI Agents Better Context](/docs/okf-context-engine-for-ai-agents) for more.

## Risks of persistent memory

Persistent memory fixes a real problem and introduces new ones — treat it as a system that needs maintenance, not a one-time upgrade:

- **Outdated memories.** A fact true during an incident, before a migration, or under an old API can look identical to a current one. Without a review date and a check against current code, an agent can confidently apply advice that stopped being true months ago.
- **Privacy.** Memory that captures customer data, credentials, or anything sensitive turns a convenience into a liability the moment it's recalled into a context the wrong person or system can read. Treat memory stores with the same access discipline as any other data store.
- **Contamination.** Retrieved content — from a memory store, a workspace page, or an imported document — is reference data, not an instruction. It should never override the user's actual request or the agent's system rules; blending "what was retrieved" with "what to do" without that boundary is exploitable.
- **Over-saving.** Not every session produces something worth keeping forever. Saving routine chatter or already-documented facts turns the memory store into noise that costs tokens to load — the opposite of what memory was supposed to fix.

Persistent memory should be reviewable, editable, and deletable by the people who rely on it, with dates attached so staleness is visible instead of assumed away.

## FAQ

### Does a bigger context window fix an agent forgetting things?

No. It raises how much *could* fit in one prompt, but something still has to select what actually goes in, and models don't use a very long context with equal reliability throughout. The fix is a better-organized context system, not a larger single bucket.

### Is an instruction file like `CLAUDE.md` or `AGENTS.md` the same as memory?

No. Instruction files are rules a person writes that shape every session in scope. Persistent memory is learnings an agent accumulates from what actually happened. Put standing behavior in the instruction file, an accumulated fact in memory.

### Is RAG the same as persistent memory?

No. RAG finds passages similar to a query inside a corpus. It doesn't decide whether what it finds is current or applicable — that judgment belongs to metadata like lifecycle state and review dates, or to a person checking the result. A memory store can be searched with RAG, but RAG by itself isn't a memory system.

### Should a shared workspace replace `CLAUDE.md` or `AGENTS.md`?

No. Instruction files load as prompt-level context for standing behavior. A shared workspace holds what changes — active tasks, decisions, and memory a team needs to browse and correct across sessions and machines. Most projects need both.

### What's the difference between a decision log and a task database?

A task database tracks *what's happening now* and changes constantly. A decision log records *why a choice was made* and rarely changes once written. Confusing the two either buries decisions in status updates or clutters the task board with history nobody needs to act on.

## Build a context system your agent can return to

Forgetting isn't a flaw to route around with a bigger model or a longer window — it's what happens by default when session boundaries, retrieval, and documentation scope aren't deliberately layered together. Start small: one project summary, one task database with an honest current state, and a short list of reviewed memories with dates on them. Add a shared workspace once more than one agent, or one person, needs to see the same record.

[Try Remnus](https://remnus.com/) to connect a shared workspace over MCP, or start with the [getting-started guide](https://remnus.com/wiki/getting-started) to run a first read-only context request against your own project.
