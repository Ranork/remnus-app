# Authentication

Remnus supports two ways for an agent to authenticate to the MCP endpoint: **OAuth 2.1** (recommended) and **personal access tokens (PATs)**. Both are workspace-scoped — a single token or connection only ever accesses one workspace.

## OAuth 2.1 + PKCE (recommended)

Point your editor at the endpoint with no credentials. On the first `401`, an OAuth-ready client runs the standard flow automatically:

1. The client dynamically registers itself (RFC 7591, `POST /api/oauth/register`)
2. It opens your browser to the Remnus consent screen, where you pick the target workspace, the scope (**read** or **write** — defaults to what the client requested, upgradeable), the agent's brand icon, and a connection name
3. Approving redirects back with an authorization code (PKCE `S256`), which the client exchanges for tokens

Issued tokens are prefixed `oa_`. Access tokens expire after **1 hour**; refresh tokens rotate on every use and expire after **30 days** — so a connected client stays authenticated indefinitely without ever showing you a token. Manage or revoke any OAuth connection from the **AI Agents** panel (sidebar → **AI Agents**).

See [Connect Your Editor](connect-editors.md) for which clients support OAuth today.

## Personal access tokens (PAT)

For clients that don't run the OAuth flow, mint a static bearer token from the sidebar **AI Agents** panel → **Connect editor** → **Advanced**. Only workspace **owners** (and platform admins) can mint tokens.

All MCP requests using a PAT must include it in the `Authorization` header:

```
Authorization: Bearer rmns_xxxxxxxxxxxxxxxx
```

## Scopes

| Scope | Permitted tools |
|---|---|
| `read` | `search_workspace`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log`, `get_changes_since`, `get_related_pages` |
| `write` | All read tools + `create_page`, `update_page`, `bulk_update_pages`, `delete_page`, `move_item`, `create_database`, `update_database_schema` |

Calling a write tool with a read-scoped token returns an error and makes no changes.

## Token expiry

PATs can be created with or without an expiry date; expired tokens return `401 Unauthorized`. OAuth access tokens always expire after 1 hour and are transparently refreshed by the client — no manual renewal.

## Token revocation

Any PAT or OAuth connection can be revoked instantly from the **AI Agents** panel. Revoked tokens return `401 Unauthorized` on the next request.

## Audit log

Every tool call — from both PAT and OAuth tokens — is recorded in the workspace audit log. Query it with the [`query_audit_log`](read-tools.md#query_audit_log) tool or view recent activity in the **AI Agents** panel.

## Rate limits

- **60 requests per minute** per token
- Exceeding the limit returns `429 Too Many Requests`
- The limit resets on a rolling 60-second window

## Security recommendations

- Use **read scope** for read-only automations such as reports and summaries
- Use **write scope** only when the agent needs to create or modify content
- Set an expiry date on tokens shared with third-party services
- Revoke tokens immediately if they are compromised
