# MCP Tools vs Resources vs Prompts: A Practical Guide

Every Model Context Protocol (MCP) server is built from three kinds of building blocks: tools, resources, and prompts. They look similar on paper — all three move data between a server and an AI application — but they exist because a single mechanism can't serve three different jobs: taking an action, supplying background context, and packaging a repeatable workflow. Mixing them up is the most common source of confusion when building or using an MCP server.

This guide defines each primitive from the official MCP specification, shows what each looks like using Remnus's actual, documented tools, resources, and prompts, and walks through one complete workflow where all three work together.

## The three concepts in one minute

The clearest way to tell them apart isn't what data they carry — it's **who decides to use them**. The [official MCP server-concepts documentation](https://modelcontextprotocol.io/docs/learn/server-concepts) frames it this way:

| | Tools | Resources | Prompts |
| --- | --- | --- | --- |
| **What it is** | Functions the model can call to take an action | Read-only data supplied for context | Reusable templates for a task |
| **Who controls it** | The model — it decides when to call one | The application — it decides what to attach | The user — they explicitly invoke one |
| **Discovery** | `tools/list`, invoked with `tools/call` | `resources/list` / `resources/templates/list`, read with `resources/read` | `prompts/list`, retrieved with `prompts/get` |
| **Example (generic)** | Book a flight, send a message | A calendar, a document, a database schema | "Plan a vacation," "summarize my meetings" |
| **Example (Remnus)** | `create_page`, `update_page` | `remnus://workspace/{id}/digest` | `weekly-status-report` |

Keep that "who decides" column in mind — it resolves most of the confusion below.

## What is an MCP tool?

A tool is a function the model can invoke, with a name, a description, and a JSON Schema defining its inputs and outputs. The model — not the application, not the user — decides when to call one, based on what the conversation needs. That's why tools are the primitive for taking action: creating something, changing something, or triggering a side effect.

Remnus exposes 11 read tools (available to every token) and 10 write tools (requiring write scope), documented in full in [Read Tools](https://remnus.com/wiki/read-tools) and [Write Tools](https://remnus.com/wiki/write-tools). A concrete example — creating a task:

```json
{
  "name": "create_page",
  "input": {
    "title": "Fix login redirect bug",
    "databaseId": "db_sprintboard",
    "properties": { "Status": "Backlog", "Priority": "High" }
  }
}
```

The model decided a task was needed and called `create_page` with the right database and properties — no person clicked "create task" in a UI. Some tools carry extra safeguards for exactly this reason: `delete_page` requires a second call with `confirm: true` before it deletes anything, returning a preview of what *would* be removed on the first call. That's a tool-level control, not a resource or prompt concern — because only tools take action in the first place.

## What is an MCP resource?

A resource is read-only, addressable data — a fixed or templated URI the application can fetch and decide how to use, whether that's attaching it whole, running a search over it, or letting a person browse it. Resources are **application-controlled**: the host decides what to retrieve and when, not the model mid-conversation and not the user typing a command.

Remnus exposes six resource templates, documented in [Resources](https://remnus.com/wiki/resources). Two examples that map directly to the common "get oriented" use case:

- **`remnus://workspace/{id}/digest`** — a compact, one-line-per-item map of the whole workspace: titles, IDs, row counts, last-updated dates. A whole workspace fits in a few hundred tokens here, which is why it's the recommended first read before anything else.
- **`remnus://workspace/{id}/schema`** — the full JSON schema of every database in the workspace: column names, types, and select options, without any row data.

```json
// remnus://workspace/abc123/digest → application attaches this as context
{
  "mimeType": "text/markdown",
  "text": "# Workspace digest\n\n- [database] Sprint Board (rows: 16, updated: 2026-07-01)\n..."
}
```

A resource never changes anything — reading `remnus://workspace/{id}/digest` a thousand times has zero effect on the workspace. That read-only guarantee is what makes resources safe to attach automatically or fetch speculatively, in a way a tool call never is.

## What is an MCP prompt?

A prompt is a reusable, parameterized template that packages a specific task — the server author's opinion on how to do something well, exposed so a user doesn't have to reconstruct it from scratch every time. Prompts are **user-controlled**: they require explicit invocation, not automatic triggering by the model or the application.

Remnus documents seven prompts in [Prompts](https://remnus.com/wiki/prompts), including exactly the reusable-workflow case: **`weekly-status-report`**, which takes a `database_id` and an optional `period` (defaulting to `"last week"`), and returns a filled instruction that groups items by status, highlights blockers, and surfaces key wins — ready for the model to complete.

```
/mcp__remnus__weekly-status-report db_sprintboard "this sprint"
```

A prompt doesn't do the work itself — the specification is precise about this: prompts only prepare the input; the LLM call and any resulting tool calls happen after, driven by the client. Two other Remnus prompts worth knowing: `recall-context`, which loads what the workspace already knows about a topic in one compact package, and `save-memory`, which prepares a structured record for a durable decision or gotcha. Both are covered in [Agent Memory](https://remnus.com/wiki/agent-memory).

## How tools, resources, and prompts work together

Here's one complete flow, using only verified Remnus primitives, from orientation to a finished action:

1. **Resource** — the client reads `remnus://workspace/{id}/digest` to see what exists before doing anything else. Cheap, read-only, application-initiated.
2. **Prompt** — the user invokes `weekly-status-report` on the sprint board database, supplying `period: "this sprint"`.
3. **Tool** — the model calls `query_database` (a read tool) to pull the actual rows the prompt needs, filtered and projected to just the fields that matter.
4. **Tool** — having drafted the report, the model calls `create_page` (a write tool) to publish it as a new page in the workspace.

Each primitive did the job only it can do: the resource supplied passive context, the prompt packaged a repeatable workflow a person chose to run, and the tools did the actual reading and writing. No step could substitute for another — a resource can't create a page, and a tool call isn't something a user browses through a picker the way a resource is.

## Common misconceptions

- **"A tool is basically a REST endpoint."** Not quite. A REST endpoint is a fixed URL a client calls because it already knows the API. A tool is self-describing (its JSON Schema is discoverable via `tools/list`) and is invoked by the *model's own decision* inside a conversation — the calling client usually doesn't hardcode which tool gets called when.
- **"A resource is just a GET request."** A resource is addressed by URI and read on demand like a GET, but the protocol also defines templated URIs with parameter completion and a subscription mechanism for change notifications — closer to a self-describing, watchable data source than a static endpoint.
- **"A prompt is just prompt engineering text."** A prompt is a structured, schema-defined template with typed arguments the client validates and can offer autocompletion for — not a block of freeform instructions pasted into a system prompt.
- **"Every client shows these the same way."** They don't. Client support and interfaces vary: Claude Code exposes MCP prompts as slash commands in the form `/mcp__servername__promptname`; another client might use a command palette or a dedicated button. Resources might auto-attach in one client and require manual selection in another. Check your specific client's documentation before assuming behavior.

## How these concepts appear in Remnus

Remnus's tool/resource/prompt split follows the specification's intent directly, not just its vocabulary. Tools are where scope and confirmation live — `read` versus `write` tokens, and `confirm: true` for destructive calls — because tools are the only primitive that changes anything. Resources are the cheap-orientation layer: the digest and schema resources exist specifically so a client doesn't have to page through `list_workspace` and probe pages one by one just to get its bearings. Prompts are where Remnus's opinionated workflows live — `weekly-status-report`, `kanban-triage`, `save-memory` — each one a documented, reusable answer to "how should an agent do this well," rather than something every user has to prompt-engineer from scratch.

## How MCP server developers should choose between them

- **Does it change anything?** If yes, it's a tool — and if the change is destructive or hard to reverse, add an explicit confirmation step, the way `delete_page` does.
- **Is it read-only context an application might want automatically?** If yes, consider a resource, especially if it's cheap to compute and useful to fetch speculatively (a summary, a schema, a digest).
- **Is it a task a user would want to run the same way repeatedly, with different inputs?** If yes, that's a prompt — package it once instead of asking every user to reconstruct the instructions.
- **Don't force a single primitive to do two jobs.** A "tool" that both fetches data and silently decides whether to act on it blurs the model/application/user control boundary the whole design depends on.

## FAQ

### Can a resource ever change data?

No — by definition, a resource is read-only. If an operation changes anything, even something as small as marking a notification as read, it belongs in a tool, not a resource.

### Do I need to use prompts, or can I just call tools directly?

You can call tools directly, and many workflows do. Prompts exist for the cases where a workflow is common enough that packaging it saves a user from re-explaining it every time — they're a convenience layer, not a requirement.

### Are MCP resources the same as file attachments?

They're related but not identical. A resource is any addressable, read-only data source with a URI and a MIME type — files are one example, but a database schema or a workspace digest that has no underlying file is also a valid resource.

### Why does Remnus limit destructive tools with a confirm flag instead of just relying on scope?

Because scope answers "is this token allowed to delete things at all," while confirmation answers "was this specific deletion actually intended." A write-scoped token can call `delete_page` at any time — the two-step confirm pattern exists so a preview is shown before anything is actually removed.

### Does every MCP client support resources and prompts the same way tools are supported?

No. Tool support is close to universal since it's central to what makes an MCP server useful, but resource and prompt support varies more by client — some surface resources as an attachable list, others don't expose them in the UI at all, and prompt UI (slash commands, palettes, buttons) differs client to client. Check what your specific client supports.

### Where can I see the exact, current list of Remnus's tools, resources, and prompts?

In the Remnus wiki: [Read Tools](https://remnus.com/wiki/read-tools), [Write Tools](https://remnus.com/wiki/write-tools), [Resources](https://remnus.com/wiki/resources), and [Prompts](https://remnus.com/wiki/prompts) — all kept current with the deployed server, rather than restated here as a point-in-time snapshot.

## Start building with the right primitive

Tools, resources, and prompts aren't interchangeable ways to move data — they're three different answers to three different questions: what should the model be able to do, what should the application know without being asked, and what should a user be able to run again without re-explaining it. Get that split right and an MCP server (or an agent using one) becomes much easier to reason about.

For the architecture this all sits inside, see [What Is an MCP-Native Workspace?](/docs/what-is-an-mcp-native-workspace); for how tool and resource design affects what an agent actually pays in tokens, see [How Many Tokens Does Your Agent Burn Reading Your Notes?](/docs/agent-token-efficiency). Then [try Remnus](https://remnus.com/) and inspect the tools, resources, and prompts on a live connection.
