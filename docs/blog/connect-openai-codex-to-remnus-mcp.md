Codex can inspect a repository, edit files, run commands, and verify changes. It cannot automatically know the requirements, backlog, architecture decisions, or project history that live outside that repository.

Connecting Codex to [Remnus](https://remnus.com) through the Model Context Protocol (MCP) gives it a structured external workspace. Codex can search requirements, query task databases, update work, and save decisions for the next session or agent. Your team sees the same data in the Remnus UI.

MCP is an open standard that connects AI applications to external data, tools, and workflows. The [official MCP introduction](https://modelcontextprotocol.io/docs/getting-started/intro) explains the client-server model. In this setup, Codex is the MCP client and Remnus is a remote Streamable HTTP MCP server.

This guide uses the current Codex and Remnus setup as of July 2026.

## Which Codex environment this guide covers

This guide covers **local Codex clients running on your machine**:

- Codex CLI in a local repository
- The Codex IDE extension on the same host

OpenAI documents that local Codex clients share MCP configuration through `config.toml`; the CLI and IDE extension can therefore use the same Remnus server entry. See the current [OpenAI Codex MCP documentation](https://developers.openai.com/codex/mcp).

This is not a guide for ChatGPT web plugins or connectors, the OpenAI API, the Codex SDK, or hosted Codex cloud environments. The commands below configure the local Codex host.

The instructions assume `codex mcp add --help` includes `--url` and the MCP commands include `login`. For older builds, use the manual `config.toml` method below.

## Prerequisites

You need:

- A hosted [Remnus](https://remnus.com) workspace or a self-hosted Remnus instance
- A current Codex CLI or IDE extension
- Access to the repository you want Codex to work in
- Membership in the Remnus workspace you want to connect
- Workspace-owner access only if you plan to mint a personal access token

You do not need to install a local Remnus process. The hosted MCP endpoint is:

```text
https://www.remnus.com/api/mcp
```

Use the `www` host exactly. The apex domain redirects, and an OAuth client can reject a resource-indicator mismatch after a redirect.

Before continuing, review the current [Remnus MCP setup documentation](https://www.remnus.com/wiki/getting-started).

## Connect Remnus through MCP

The recommended setup uses OAuth and the Codex CLI.

First, open your workspace in Remnus. Select **AI Agents** in the sidebar, choose **Connect editor**, and select **Codex**. Remnus shows the endpoint, the expected `config.toml` entry, and the OAuth login command.

For a global connection available to local Codex clients on this host, run:

```bash
codex mcp add remnus --url https://www.remnus.com/api/mcp
codex mcp login remnus
```

The first command registers a remote Streamable HTTP server named `remnus`. The second starts OAuth in your browser. Approve the Remnus consent screen, choose the workspace and either `read` or `write` scope, then return to Codex.

OpenAI's current CLI supports `--url` for remote Streamable HTTP servers. Do not use an STDIO `command` entry, a ChatGPT connector configuration, or an OpenAI API key for this connection.

### Project-scoped configuration

By default, Codex stores MCP configuration in `~/.codex/config.toml`. If one repository should connect to one specific Remnus workspace, create `.codex/config.toml` in that repository instead:

```toml
[mcp_servers.remnus]
url = "https://www.remnus.com/api/mcp"
```

OpenAI supports project-scoped `.codex/config.toml` only for trusted projects. Start Codex from that repository, then run:

```bash
codex mcp login remnus
```

Use global configuration across repositories and project configuration when the server belongs to one repository. Never place a raw credential in a committed file.

## Authentication options

Remnus supports two workspace-scoped authentication methods.

### OAuth 2.1 with PKCE

OAuth is the recommended option. Codex opens the browser flow with `codex mcp login remnus`; Remnus asks which workspace and scope to grant. Codex stores and refreshes the resulting credentials.

Remnus access tokens expire after one hour. Refresh tokens rotate on use and expire after 30 days. You can revoke the connection immediately from the Remnus **AI Agents** panel.

### Personal access token

A Remnus workspace owner can mint a PAT from **AI Agents → Connect editor → Advanced**. Choose `read` or `write`, set an expiry when appropriate, and copy the `rmns_` token when it is shown. Remnus displays it only once.

Keep the token outside `config.toml`. Codex supports reading a bearer token from an environment variable:

```toml
[mcp_servers.remnus]
url = "https://www.remnus.com/api/mcp"
bearer_token_env_var = "REMNUS_MCP_TOKEN"
```

Set `REMNUS_MCP_TOKEN` in the environment that launches Codex. Do not include `Bearer ` in the variable value; Codex constructs the `Authorization` header.

Use a PAT only when a static credential is preferable. Scope, expiry, revocation, audit, and rate-limit behavior is documented in [Remnus authentication](https://www.remnus.com/wiki/authentication).

## Verify the connection safely

Confirm registration before asking Codex to access workspace data:

```bash
codex mcp list
```

In the Codex terminal UI, `/mcp` shows active servers. The IDE extension exposes the same server through its MCP server settings.

Then start with a read-only prompt:

> Use the remnus MCP to list the pages and databases in my workspace. Do not create, update, move, or delete anything.

Codex should call a read tool such as `list_workspace` and return workspace items. This verifies transport, authentication, tool discovery, and workspace selection without changing data.

If the connection has `write` scope, the prompt still matters: scope defines what is permitted, while the task instruction defines what Codex should do now.

## Practical workflows

### Read a product specification

Ask Codex to find the specification before editing code. It can use `search_workspace`, inspect a long page with `get_page` in outline mode, then fetch full content only when needed.

### Review a project backlog

Codex can find the backlog, call `get_database_schema` to resolve real column IDs and options, then use `query_database` with a narrow `fields` projection. Schema-first querying prevents guessed property names from producing misleading results.

### Add implementation tasks

With `write` scope, Codex can turn an approved plan into database rows using `create_page`. Ask it to inspect the database schema first, show the proposed tasks, and create them only after the list looks correct.

### Update completed work

After repository checks pass, Codex can use `update_page` to move a task to `Done` and add a concise implementation note. For several completed items, `bulk_update_pages` reduces the number of calls and keeps the update consistent.

### Save an architecture decision

When a session settles a durable choice, ask Codex to create a page with the decision, context, alternatives, consequences, and date. Later Codex sessions and other MCP clients can find it.

### Generate a status report

For a standup or release report, Codex can query tasks, group them by status, and read only supporting pages. `read` scope is sufficient. For recurring reports, `get_changes_since` returns a compact delta.

## Example prompts

Copy any of these into Codex:

> Use the remnus MCP to find the product specification for "Team Invitations." Summarize the acceptance criteria and identify repository areas likely affected. Do not edit files yet.

> Inspect the schema of my Remnus Work Plan database, then list open tasks for the current sprint with only Status, Priority, and Assignee. Do not modify the workspace.

> Based on the approved implementation plan in this thread, propose database rows for my Remnus backlog. Show the titles and properties first, and create them only after I approve.

> The implementation and targeted checks are complete. Update the matching Remnus task to Done and append a short note with the files changed and verification results. Do not change any other row.

> Create an architecture decision page in Remnus for choosing an outbox pattern for event delivery. Include context, options considered, decision, consequences, and today's date.

## Using Remnus together with AGENTS.md

`AGENTS.md` and Remnus solve different context problems.

Codex reads `AGENTS.md` before work and applies instructions from global scope down to the current directory. Use it for coding conventions, required commands, ownership, security boundaries, and verification. OpenAI documents precedence in the official [AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md).

Use Remnus for shared project state that changes independently of Git: requirements, backlog rows, product decisions, meeting notes, status, documentation, and agent memory.

A useful boundary is:

- `AGENTS.md`: how Codex must work in this repository
- Remnus: what the team is building, why, what is pending, and what changed

Do not copy a fast-changing backlog into `AGENTS.md`, and do not bury mandatory repository safety rules in an external page that Codex may not read before acting.

## Security and write permissions

Start with the least privilege required:

- Use `read` for specifications, backlog review, reports, and context retrieval.
- Grant `write` only for workflows that create or update workspace content.
- Prefer OAuth over a static PAT.
- If a PAT is required, keep it in an environment variable, set an expiry, and never commit it.
- Revoke unused or compromised connections from the Remnus **AI Agents** panel.
- Review the Remnus audit log; every MCP tool call is recorded.
- Ask Codex to preview destructive work before approval. Remnus also requires explicit confirmation for deletion and destructive schema changes.

For Codex-side review, a current `config.toml` can prompt specifically for tools not marked read-only:

```toml
[mcp_servers.remnus]
url = "https://www.remnus.com/api/mcp"
default_tools_approval_mode = "writes"
```

Client approval is an additional guardrail, not a replacement for Remnus scope enforcement. Review the broader product controls in [Remnus security](https://www.remnus.com/security).

## Troubleshooting

**`remnus` does not appear in Codex.** Run `codex mcp list`. If it is absent, add it again with the exact `--url` command. For project configuration, confirm the repository is trusted and `.codex/config.toml` is in the repository root.

**`codex mcp login remnus` cannot find the server.** Run the command from the same configuration context where the server was registered. A server placed only in a project config is not available from an unrelated directory.

**OAuth does not open or authentication fails.** Confirm the endpoint is exactly `https://www.remnus.com/api/mcp`. Remove static headers or PAT settings if you intend to use OAuth, then run `codex mcp login remnus` again.

**The server connects but write tools fail.** The connection has `read` scope. Reconnect with `write` only if the task requires mutations.

**A PAT works in one shell but not another.** The environment variable must exist in the process that launches Codex. Confirm the variable name matches `bearer_token_env_var`; do not paste the secret into diagnostic output.

**Queries return no backlog rows.** Ask Codex to call `get_database_schema` first and use exact column IDs and option values. For efficient queries, request only the fields needed.

**Requests return `429 Too Many Requests`.** Remnus limits each token to 60 requests per rolling minute. Prefer projected queries and bulk updates over repeated one-row calls.

## FAQ

### Does Codex need a personal access token to connect to Remnus?

No. OAuth is the recommended path. Register the URL, run `codex mcp login remnus`, and approve the browser consent screen. PATs are an alternative for static-credential workflows.

### Does this configure ChatGPT connectors too?

No. These commands configure MCP on the local Codex host. ChatGPT web plugins and connectors use a different installation and administration path.

### Can the Codex IDE extension use the same connection?

Yes. OpenAI documents that the local CLI and IDE extension share MCP configuration on the same Codex host.

### Should the Remnus server be global or project-scoped?

Use `~/.codex/config.toml` when you want it available across repositories. Use `.codex/config.toml` in a trusted repository when the connection belongs to that project. Keep credentials out of committed config.

### Can Codex read Remnus without changing anything?

Yes. Choose `read` scope. Codex can search pages, read specifications, inspect schemas, query databases, review changes, and generate reports, while write calls are rejected by Remnus.

### Is Remnus a replacement for AGENTS.md?

No. `AGENTS.md` defines repository instructions. Remnus holds shared external project context and changing operational state. They work best together.

### Can multiple coding agents use the same Remnus workspace?

Yes, subject to workspace membership and plan limits. Give each agent its own connection so access can be scoped and revoked independently and audit entries remain attributable. For the broader collaboration model, read [What Is an MCP-Native Workspace?](https://www.remnus.com/docs/what-is-an-mcp-native-workspace).

## Connect Codex to a shared workspace

A repository tells Codex what the code is. A Remnus workspace tells it what the project means: requirements, priorities, decisions, documentation, and the current state of work.

[Explore Remnus](https://remnus.com), create or open a workspace, then use **AI Agents → Connect editor → Codex**. For the full product setup and tool reference, continue with the [Remnus MCP documentation](https://www.remnus.com/wiki/getting-started).
