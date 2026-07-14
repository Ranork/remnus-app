## SEO Metadata

- **Title tag:** How to Give Claude Code Persistent Memory and a Shared Workspace
- **Meta description:** Learn how to combine Claude Code memory, CLAUDE.md, project tasks, and an MCP workspace for reliable long-running software work.
- **Slug:** `claude-code-persistent-memory-workspace`
- **Primary keyword:** Claude Code persistent memory
- **Secondary keywords:** Claude Code memory, Claude Code MCP workspace, persistent context for Claude Code, Claude Code project memory
- **Search intent:** Informational and practical: developers want to preserve project context and coordinate Claude Code across sessions.
- **Featured image concept:** A dark software workspace showing a code repository, a persistent memory ledger, and a connected MCP graph between project tasks and an AI coding agent.
- **Alt text:** Diagram of Claude Code connected through MCP to persistent project memory, documentation, and task tracking.

# How to Give Claude Code Persistent Memory and a Shared Workspace

A coding agent can understand a project remarkably well during one session and still need to rediscover the same decisions tomorrow. The missing pieces are usually not source files. They are the reasons behind a design, the bug that already defeated three approaches, the deployment convention nobody wrote down, and the task that was almost finished when the session ended.

This is a workflow problem, not proof that Claude Code has no memory. Claude Code currently supports persistent project instructions through `CLAUDE.md` files and automatic, repository-scoped memory for learnings and preferences. Those mechanisms are useful, but they serve a different purpose from a shared project record. A durable workflow combines them with explicit documentation, an active task system, and—when a team needs a common source of truth—a workspace that Claude Code can reach through the Model Context Protocol (MCP).

The goal is to make the right context available at the right scope, with a clear human review path.

## Why coding agents lose context between sessions

Every Claude Code session starts with a fresh context window. Instructions, files, tool results, and conversation messages compete for that session’s working space. A longer context window or automatic compaction can help a session continue, but neither one turns a conversation into a permanent project record.

Conversation history is also a poor task database. It is chronological, often noisy, and tied to a particular session. A decision may be buried below compiler output; a failed experiment may be summarized too vaguely; a task may be discussed without being marked complete anywhere. When the next session begins, the agent can inspect the repository again, but the intent behind the repository is harder to recover.

Claude Code’s own [memory documentation](https://code.claude.com/docs/en/memory) describes two complementary mechanisms:

| Layer | What it is good at | Typical lifetime and scope |
| --- | --- | --- |
| Current conversation context | The immediate investigation, edits, tool output, and decisions in progress | One session, bounded by the context window |
| `CLAUDE.md` and `.claude/rules/` | Stable instructions, architecture, conventions, and repeatable workflows | Loaded according to project, user, organization, or path scope |
| Project documentation | Detailed explanations that humans and agents can read when relevant | Shared through the repository or documentation system |
| RAG | Retrieving relevant passages from a larger corpus, often by search or embeddings | Depends on the connected retrieval system and its index |
| Persistent agent memory | Compact learnings, preferences, decisions, and gotchas saved for later recall | Usually long-lived, but only as accurate as its records and retrieval |

These categories overlap, but they are not interchangeable. “Run lint before committing” belongs in project instructions; a billing explanation belongs in documentation; “we rejected approach X because it breaks offline imports” is a memory candidate; a current sprint card belongs in the task system. RAG can find these records, but retrieval itself does not decide whether a result is still true or important.

For a deeper view of what Claude Code loads and how compaction affects it, see the official [context window guide](https://code.claude.com/docs/en/context-window). Keeping a memory file concise matters because startup material consumes the same working context as the task.

## What information should be stored permanently

Permanent memory should answer a future question that is likely to recur. It should be concise, specific, and written so a person can verify it without reconstructing the original conversation.

Good candidates include:

- **Architecture decisions:** “Database properties use a JSON column because user-defined columns change at runtime; do not introduce an EAV table without revisiting the decision.” Include the date, alternatives considered, and the boundary of the decision.
- **User preferences:** “Use PowerShell-compatible commands in Windows setup examples” or “Prefer concise release notes with a verification section.” Keep personal preferences separate from team rules.
- **Known bugs and gotchas:** “The staging webhook is eventually consistent; verify the subscription after the callback before showing success.” A gotcha is valuable when it includes the symptom and the safe workaround.
- **Failed approaches:** Record why a tempting solution was abandoned. “A client-side polling loop caused duplicate refreshes when browser tabs resumed; use the server-side change cursor instead.” This prevents the next agent from repeating the same experiment.
- **Deployment conventions:** Document which environment owns a migration, how preview data is seeded, what must be checked before release, and which operations require a human approval.
- **Current priorities:** Keep a short, dated summary of the active goal, its blocker, and the next meaningful step. Do not treat it as a replacement for the task database; use it as a bridge between sessions.

A useful memory has a shape like this:

```text
Decision: Use OAuth for remote MCP connections by default.
Context: Static tokens are still available for clients without OAuth support.
Reason: OAuth avoids copying a long-lived credential into editor configuration.
Scope: Remote Remnus connections; local stdio servers are separate.
Last verified: 2026-07-14
```

The date and scope are not decoration. They tell the next agent when to verify the statement instead of blindly applying it to every environment.

## What should not be stored as permanent memory

Do not turn the memory store into a transcript, cache, or secret locker. Avoid raw conversation dumps, one-off commands, temporary test values, credentials, access tokens, private customer data, and speculation. “The API is broken” is harmful without an endpoint, reproduction, date, and current status.

Do not store fast-changing task status in several competing places. If the kanban board says “In Progress” and a memory note says “Done,” the agent must spend its next session resolving the contradiction. Keep authoritative state in one task database and save only a stable summary when it helps future work.

Also avoid putting large reference material into an always-loaded instruction file. Claude Code’s documentation recommends keeping `CLAUDE.md` focused and using path-scoped rules or on-demand project documentation for material that does not apply to every task. Persistent does not mean permanently loaded.

## A practical shared-workspace architecture for Claude Code

For a long-running project, use four deliberately different layers:

1. **Repository instructions:** `CLAUDE.md` (and, where appropriate, `.claude/rules/`) contains rules that should shape every relevant coding session. If a repository uses `AGENTS.md`, Claude Code’s current documentation recommends importing it from `CLAUDE.md` rather than assuming Claude Code reads it automatically.
2. **Project documentation:** Keep the source map, API decisions, setup notes, and operational runbooks in version control or a documentation workspace. These are explanations, not hidden instructions.
3. **Shared work plan:** Use a database for task title, status, priority, owner, and next step. This is where “what should we do now?” is answered.
4. **Agent memory:** Store small, durable records—decisions, preferences, gotchas, facts, and failed approaches. Give each record a type, tags, date, and a link to the relevant project page or task when possible.

The resulting workflow looks like this:

```text
Start session
    ↓
Read project summary and repository instructions
    ↓
Recall only decisions and gotchas relevant to the task
    ↓
Read active tasks and confirm the authoritative status
    ↓
Inspect code, implement, and verify
    ↓
Update the task with status, files, and test results
    ↓
Save only durable new context after human-reviewable work
```

A critical detail is ordering. Start with a project summary, query the active task list, recall a narrow topic, and fetch full pages only when outlines show they are relevant. At the end, report what changed and what remains before writing a memory so a person can correct it while the evidence is fresh.

## Connecting Claude Code to Remnus through MCP

MCP is a protocol for exchanging context and capabilities between an AI host, clients, and servers. The official [MCP architecture overview](https://modelcontextprotocol.io/docs/learn/architecture) distinguishes tools, resources, and prompts; it does not prescribe a memory policy. That policy belongs to the application and the people using it.

Remnus provides a workspace-scoped MCP server for pages, databases, task records, and Agent Memory. Its [Agent Memory documentation](https://www.remnus.com/wiki/agent-memory) describes a human-readable database template with `Title`, `Type`, `Tags`, and `Date` fields. The workspace can therefore hold both the project’s active work and the records that should survive an individual Claude Code session. The records are ordinary pages: people can browse, correct, organize, or delete them.

The current [Remnus Getting Started guide](https://www.remnus.com/wiki/getting-started) recommends OAuth for clients that support it and publishes this Claude Code command for the remote Streamable HTTP endpoint:

```bash
claude mcp add --transport http --scope user remnus https://www.remnus.com/api/mcp
```

Use the live guide and Claude Code’s [MCP documentation](https://code.claude.com/docs/en/mcp) for the current command syntax, scopes, and platform details. The command’s `user` scope makes the connection available across projects for that local user; a project-scoped connection is a different choice and can be shared through version control. Do not paste a real token into a committed file. If OAuth is unavailable in a particular client, follow Remnus’s advanced PAT instructions, use the narrowest scope needed, and set an expiry when possible.

Once connected, ask Claude Code to read the project summary, recall a topic, query the work-plan database with only the needed fields, and open one task’s body when necessary. Remnus’s `recall-context` returns compact outlines and a relevant link neighborhood; `save-memory` prepares a structured record, while the agent still performs the write. A prompt can guide a write, but it does not save information that was never sent to the workspace.

For authorization, scopes, revocation, and audit behavior, read the [Remnus security documentation](https://www.remnus.com/security) and the [MCP authorization guide](https://modelcontextprotocol.io/docs/tutorials/security/authorization). Prefer read access while designing the workflow. Add write access only when the agent must update tasks or create memory records, and keep a human approval step for destructive or high-impact changes.

## Preventing noisy or harmful memory

Treat memory maintenance as part of engineering hygiene.

- **Review:** At the end of a task, ask whether the proposed memory would help a future session. Review the title, scope, evidence, and last-verified date before saving it.
- **Expire:** Add review dates to operational facts, temporary workarounds, and priorities. A memory that was correct during an incident may be wrong after the next deployment.
- **Correct:** When a decision changes, update the old record or mark it superseded. Do not leave two contradictory “current” decisions with similar titles.
- **Delete:** Remove secrets, personal data, duplicate notes, and records that no longer provide value. Persistent memory should be editable and deletable by its owners.
- **Keep humans in the loop:** Let the agent propose a memory, but let a person approve important architecture, security, compliance, and deployment facts. Use audit logs and version history where available.

The same rule applies to retrieval. A relevant-looking result is not automatically authoritative. Claude Code should check the date, scope, source page, and current code before applying a recalled memory. When evidence conflicts, it should stop and ask rather than silently merging the records.

## Example prompts developers can use with Claude Code

These prompts are intentionally explicit about scope and verification:

1. **Start a session:** “Read the project summary and repository instructions. Recall only durable decisions and known gotchas related to the authentication task, then query the active task list. Tell me which task is authoritative and what you need to inspect before editing.”
2. **Avoid repeating a failure:** “Before implementing this approach, search the workspace for failed attempts related to database migrations. Summarize the relevant failure, check whether it is still applicable to the current code, and propose the smallest safe experiment.”
3. **Update work correctly:** “Implement the requested change, run the narrowest relevant checks, and update the matching task with status, changed files, verification results, and any blocker. Do not mark it Done if a required check failed.”
4. **Save reviewed context:** “Propose up to three durable memories learned during this task. For each, include type, scope, evidence, and review date. Do not save secrets, transient logs, or information already documented elsewhere. Wait for my approval before writing.”
5. **Resolve a conflict:** “The task database and a recalled memory disagree. Show both sources, their dates, and the code evidence. Do not change either record until I confirm which source is current.”

## FAQ

### Does Claude Code already have memory?

Yes. Current Claude Code provides project and user instruction files plus auto memory for repository-scoped learnings. Those features are useful for local continuity. A shared workspace adds a human-readable, team-accessible record and a task system; it does not replace or invalidate Claude Code’s built-in memory.

### Is a `CLAUDE.md` file the same as persistent agent memory?

No. `CLAUDE.md` is best for instructions and rules that should shape behavior. Persistent memory is better for accumulated learnings, decisions, preferences, and gotchas that may be recalled selectively. Put a fact in the narrowest layer that can own it.

### Is RAG the same as memory?

No. RAG retrieves relevant content from a corpus. Memory is a maintained record of what should be carried forward. A RAG index can help find a memory, but it cannot by itself guarantee that the result is current, approved, or applicable to the task.

### Can Remnus remember anything Claude Code says?

Only information the agent explicitly saves to the connected workspace, using the available MCP tools or prompts, becomes a Remnus record. The agent should propose and verify durable context; unsaved conversation history is not silently persisted.

### Should every task update the memory database?

No. Most tasks should update the task record and perhaps the project documentation. Save memory only when the work produced a reusable decision, preference, gotcha, fact, or failed approach that is not already recorded elsewhere.

### What happens when a team uses different operating systems or Claude Code versions?

The memory concepts remain similar, but file paths, shell commands, CLI flags, feature availability, and OAuth behavior can vary by platform and version. Check the current Claude Code and Remnus setup documentation before copying a command. Keep OS-specific instructions in scoped documentation instead of presenting one command as universal.

## Build a workspace your agent can return to

Reliable long-running agent work comes from separating session context, instructions, documentation, retrieval, task state, and durable memory. Claude Code supplies local pieces; MCP supplies a standard connection for external data. A shared Remnus workspace adds pages, databases, task status, and inspectable Agent Memory in one place.

If your next Claude Code session will need to know more than the repository can express, [try Remnus](https://www.remnus.com/), connect the workspace through the [MCP setup guide](https://www.remnus.com/wiki/getting-started), and start with one small project summary, one active task database, and a short list of reviewed memories.
