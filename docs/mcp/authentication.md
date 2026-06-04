# Authentication

## Bearer tokens

All MCP requests must include a valid token in the `Authorization` header:

```
Authorization: Bearer rmns_xxxxxxxxxxxxxxxx
```

Tokens are workspace-scoped — one token can only access a single workspace. Create tokens in **Settings → Tokens**.

## Scopes

| Scope | Permitted tools |
|---|---|
| `read` | `search`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log` |
| `write` | All read tools + `create_page`, `update_page`, `bulk_update`, `delete_page`, `move_item`, `create_database`, `update_database_schema` |

Calling a write tool with a read-scoped token returns an error and makes no changes.

## Token expiry

Tokens can be created with or without an expiry date. Expired tokens return `401 Unauthorized`. Set expiry in the **Tokens** tab when creating the token.

## Token revocation

Any token can be revoked instantly from the **Tokens** tab. Revoked tokens return `401 Unauthorized` on the next request.

## Audit log

Every tool call is recorded in the workspace audit log. Query it with the [`query_audit_log`](read-tools.md#query_audit_log) tool or view it in the **Tokens** tab under **Recent Activity**.

## Rate limits

- **60 requests per minute** per token
- Exceeding the limit returns `429 Too Many Requests`
- The limit resets on a rolling 60-second window

## Security recommendations

- Use **read scope** for read-only automations such as reports and summaries
- Use **write scope** only when the agent needs to create or modify content
- Set an expiry date on tokens shared with third-party services
- Revoke tokens immediately if they are compromised
