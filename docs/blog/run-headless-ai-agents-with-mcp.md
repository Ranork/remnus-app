# How to Run Headless AI Agents Without Login Prompts

A headless AI agent runs a task to completion without a person watching a terminal or clicking through a browser consent screen — a cron job, a CI step, or a scheduled server process that starts, does its work against a workspace, and exits. That's a different execution model from an interactive coding session, and it needs a different authentication story: nothing in the run can pause to wait for a human to log in.

This guide covers what actually changes between interactive and headless execution, the authentication options that support each, and a concrete, verified example connecting a headless Claude Code run to a Remnus workspace over MCP.

## Interactive agents vs headless agents

An interactive agent runs in a terminal or editor with a person present to approve tool calls, complete a browser-based login, and read the output as it streams. A headless agent runs unattended: no one is present to click "allow," and nothing in the pipeline can wait on a redirect back from a browser.

Claude Code's own CLI reflects this split directly. Add `-p` (`--print`) to run non-interactively; add `--bare` alongside it to skip auto-discovery of hooks, skills, plugins, and local MCP config, so the run is reproducible on any machine rather than depending on what happens to be configured on one developer's laptop. Anthropic's docs are explicit about credentials in that mode: "In bare mode, Claude Code never reads OAuth credentials or the system keychain" — you set an API key or an equivalent non-interactive credential in the environment instead.

The same split applies to connecting an agent to a workspace. An OAuth flow that opens a browser for consent is built for a human at a keyboard. A headless run needs a credential it can present up front, with no redirect and no prompt.

## Common headless use cases

- **Nightly documentation updates** — a scheduled job that reviews recent code changes and proposes documentation edits before anyone starts work the next morning.
- **Backlog cleanup** — a recurring pass that queries stale or duplicate task records and flags or archives them.
- **CI analysis** — a pipeline step that reads recent changes and prior context to review a pull request or catch a regression before merge.
- **Release summaries** — a job that assembles what shipped since the last release into a page a team can read without reconstructing it from commit history.
- **Scheduled reports** — a periodic status digest built from current task and page state, delivered on a fixed cadence instead of on request.

Each of these is read-heavy or read-then-write, runs on a schedule or a trigger rather than a person's prompt, and needs to authenticate the same way every time it runs.

## Authentication options

Remnus supports exactly two ways for an agent to authenticate to its MCP endpoint, documented in full in [Authentication](https://remnus.com/wiki/authentication): **OAuth 2.1 + PKCE** and **personal access tokens (PATs)**. There is no separate "service account" object — a PAT, minted by a workspace owner as a static bearer credential independent of any browser session, is what fills that role.

| | OAuth 2.1 + PKCE | Personal access token (PAT) |
| --- | --- | --- |
| Requires a browser | Yes, for initial consent | No |
| Credential shown to you | Never — the client stores tokens itself | Once, at creation — copy it then |
| Expiry | Access tokens expire in 1 hour, refreshed automatically; refresh tokens rotate and expire after 30 days | Optional — set an expiry date or leave it open-ended |
| Who can create one | Any client that completes the consent screen | Workspace owners (and platform admins) only |
| Fits headless execution | No — the consent step needs a person present | Yes — present as a static bearer token, no interaction required |

For headless execution, that makes the choice straightforward: mint a PAT from the workspace's **AI Agents** panel → **Connect editor** → **Advanced**, choose the narrowest scope the job needs, and present it as a bearer token:

```
Authorization: Bearer rmns_xxxxxxxxxxxxxxxx
```

> **Never** build a headless flow that tries to complete an OAuth consent screen programmatically or that stores a person's session cookie for reuse. If a client can't run the OAuth flow, use a PAT — don't work around the browser step.

## Secure token storage

A PAT is a bearer credential: whoever holds it can act as the scope it was granted. Store it accordingly.

- **Never commit it to a repository**, including in a `.env` file checked into version control, a config JSON with a literal token, or a CI workflow file. GitHub's own guidance is direct that secrets must never be hardcoded in workflow files or application code, and that engineers should avoid passing secrets between processes on the command line, since "command-line processes may be visible to other users."
- **Use your CI or host platform's secret store** — GitHub Actions encrypted secrets, GitLab CI/CD variables, or a dedicated secret manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault). OWASP's Secrets Management Cheat Sheet notes that environment variables are "generally accessible to all processes and may be included in logs or system dumps," so treat a bare environment variable as the last mile from a secret store to the process, not the storage location itself.
- **Rotate and expire.** OWASP recommends that credentials "regularly rotate... so that any stolen credentials will only work for a short time" and, where possible, be created to expire automatically. Set an expiry date on any PAT used by a third-party service or an unattended job.
- **Revoke immediately on suspicion.** Any PAT or OAuth connection can be revoked instantly from Remnus's **AI Agents** panel; a revoked token returns `401 Unauthorized` on its next request.

## Minimum-permission design

Grant the narrowest scope the job actually needs. Remnus PATs carry one of two scopes:

| Scope | Permitted tools |
| --- | --- |
| `read` | `prepare_context`, `search_workspace`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log`, `get_changes_since`, `get_related_pages` |
| `write` | All read tools, plus `create_page`, `update_page`, `bulk_update_pages`, `delete_page`, `move_item`, `create_database`, `update_database_schema`, and the database-view tools |

A scheduled report or a CI analysis step that only reads never needs more than `read` — calling a write tool with a read-scoped token returns an error and makes no change, so over-scoping doesn't add resilience, only risk. Reserve `write` for jobs that genuinely create or modify content, like nightly documentation updates or backlog cleanup.

## Example headless workflow using Remnus

This example runs Claude Code non-interactively, connected to a Remnus workspace over MCP with a PAT, to produce a read-only summary — using only documented CLI flags and the documented Remnus MCP config format.

First, define the MCP connection in a config file, with the token read from the environment (this is Claude Code's documented `${VAR}` expansion syntax for `.mcp.json`-style configs):

```json
{
  "mcpServers": {
    "remnus": {
      "type": "http",
      "url": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${REMNUS_TOKEN}"
      }
    }
  }
}
```

Then invoke Claude Code headlessly, passing that config and a read-only prompt:

```bash
export REMNUS_TOKEN="rmns_xxxxxxxxxxxxxxxx"  # from your CI secret store, not hardcoded

claude --bare -p "Use Remnus prepare_context for: summarize what changed in the \
product and technical context this week. Return profile, estimatedTokens, \
concepts, and warnings. Change nothing." \
  --mcp-config remnus.mcp.json \
  --allowedTools "mcp__remnus__prepare_context" \
  --output-format json
```

`--bare` skips loading any local hooks, skills, or `CLAUDE.md`, so the run behaves identically on every machine or CI runner regardless of what's configured locally. `--allowedTools` scoped to the single tool the job needs means nothing else runs without an explicit rule, even if the token itself carries `write` scope. Pipe the JSON output's `result` field wherever the summary needs to go — a page, a channel, a report store.

## Auditability and failure handling

Every tool call made with a PAT or an OAuth connection is recorded in Remnus's workspace audit log, queryable with the `query_audit_log` tool or visible in the **AI Agents** panel — so a headless job's activity is inspectable after the fact, not just trusted blindly.

Design the job to handle these failures explicitly rather than let them fail silently:

- **`401 Unauthorized`** — the token is missing, expired, or revoked. Don't retry with the same credential; alert and rotate.
- **`429 Too Many Requests`** — the workspace's rate limit (60 requests per minute per token) was exceeded. Back off and retry rather than hammering the endpoint.
- **A write tool called with a read-scoped token** — returns an error and makes no change. This is a configuration bug, not a transient failure; catch it in testing, not production.
- **Claude Code's own exit code** — `claude -p` exits `0` on success and non-zero on failure, so a CI step or cron wrapper can branch on it without parsing output.

## Common mistakes

- **Hardcoding a token in a repository or Dockerfile.** A token committed to version control is compromised the moment it's pushed, even if the commit is later reverted. Use your platform's secret store instead.
- **Never setting an expiry.** An open-ended PAT that's forgotten about is a standing liability. Set an expiry date, especially for anything shared with a third-party service.
- **Granting `write` scope to a job that only reads.** It doesn't make the job more capable of doing its actual work — it only widens what a leaked token could do.
- **Trying to script past the OAuth consent screen.** OAuth is interactive by design; a PAT exists specifically so headless jobs don't need to fight that flow.
- **Ignoring rate limits in a tight loop.** A scheduled job that fires many requests in a burst will hit `429`; space requests out or batch them.

## Deployment checklist

- [ ] Mint a PAT with the narrowest scope the job needs (`read` unless it must write).
- [ ] Set an expiry date, especially for jobs run by external services.
- [ ] Store the token in your CI/host platform's secret manager — never in a repository or Dockerfile.
- [ ] Reference the token only via environment variable expansion in configs, never as a literal value.
- [ ] Scope `--allowedTools` (or your client's equivalent) to only the tools the job needs.
- [ ] Add failure handling for `401` and `429` responses, including alerting on unexpected `401`s.
- [ ] Confirm the job's activity appears in the workspace audit log after a test run.
- [ ] Document who owns the token and the revocation path if it's ever compromised.

## FAQ

### Can a headless agent use OAuth?

Not for the initial connection — OAuth 2.1 requires a browser-based consent step. A client can store and auto-refresh OAuth tokens after that initial login, but the login itself needs a person present. For a fully unattended job, use a PAT instead.

### Does Remnus have a distinct "service account" credential?

No. Remnus's two authentication methods are OAuth and personal access tokens; there's no third service-account object. A PAT, since it's a static bearer token independent of a browser session, is what serves that purpose.

### Where should the PAT live in a CI pipeline?

In your CI platform's encrypted secret store (for example, GitHub Actions secrets or GitLab CI/CD variables), injected as an environment variable at runtime — never as a literal value in a workflow file or a config committed to the repository.

### What happens if a headless job's token expires mid-run?

The next request returns `401 Unauthorized`. Handle it as a hard failure — alert and rotate the token — rather than retrying with the same credential.

### Can I audit what a headless agent actually did?

Yes. Every MCP tool call, from either a PAT or an OAuth connection, is recorded in the workspace audit log, queryable with `query_audit_log` or visible in the **AI Agents** panel.

### Should a nightly job use read or write scope?

Match it to what the job does, not what it might do later. A job that only produces a summary or report needs `read`. A job that creates or edits pages — like documentation updates or backlog cleanup — needs `write`. Mint separate tokens for separate jobs rather than sharing one broad-scoped token across all of them.

## Run it unattended, safely

A headless agent is only as trustworthy as the credential behind it: scoped narrowly, stored in a real secret manager, given an expiry, and revocable the moment something looks wrong. Get that right and the rest — what the job actually does — is the easy part.

Read the full [Authentication documentation](https://remnus.com/wiki/authentication) and [Security & Authentication overview](https://remnus.com/security) for scopes, expiry, and revocation details, then [try Remnus](https://remnus.com/) to connect your first headless job.
