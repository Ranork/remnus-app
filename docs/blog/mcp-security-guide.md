# MCP Security Guide: OAuth, Tokens, Scopes, and Audit Logs

A chatbot that answers badly wastes your time. An AI agent connected to a Model Context Protocol (MCP) server that acts badly can delete a database row, leak a document to the wrong place, or take an action nobody approved — because MCP servers don't just return text, they expose real tools that read and write real systems. That difference is why MCP security is a distinct discipline from prompt-quality or hallucination concerns, and why it deserves its own model of what can go wrong and what actually limits the damage.

This guide covers the general MCP threat model, the authentication and authorization mechanisms that address it, and — as one concrete example — how Remnus applies them, verified against its current documentation.

## The MCP threat model

An MCP connection introduces risk at several distinct points, not just one. The table below is a starting map; each is a well-documented category in the [MCP specification's security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices).

| Risk | What it looks like | Primary mitigation |
| --- | --- | --- |
| Malicious or compromised MCP server | A server (especially a local one) runs with the same privileges as the client and can execute arbitrary commands, exfiltrate files, or return crafted tool results | Only connect trusted servers; sandbox local servers; review what a server can do before granting access |
| Prompt injection | Content a server returns — a document, a search result, a web page — contains text designed to redirect the agent's behavior | Treat retrieved content as data, not instructions; least-privilege scopes; human approval for high-risk actions |
| Excessive permissions | A token or connection is granted broader access than the task needs, so a single leak or bad instruction has a large blast radius | Scope tokens to the minimum required; separate read from write |
| Credential leakage | A token ends up in a log, a repository, or a downstream service it wasn't issued for | Short-lived tokens where possible; never hardcode; validate token audience server-side |
| Destructive write actions | A delete, a bulk update, or a schema change executes without a chance to review it first | Explicit confirmation steps for destructive operations, separate from normal authorization |
| Sensitive-data exposure | Workspace or tool content includes information that shouldn't reach a given agent or downstream system | Scope what an agent can read; don't assume a platform automatically classifies or redacts sensitive content |

Two of these deserve more than a table row.

**Malicious or compromised servers** matter because MCP servers, particularly ones running locally, execute with the same privileges as the client that launched them. The specification is blunt about the consequence: without proper sandboxing, a malicious startup command or a compromised package can mean arbitrary code execution, with the user having "no insight into what commands are being executed." Only connect servers you trust, and prefer ones that document their own security practices.

**Prompt injection** is OWASP's term for when content — not the user — alters an LLM's behavior. [OWASP's GenAI Security Project](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) defines it directly: "A Prompt Injection Vulnerability occurs when user prompts alter the LLM's behavior or output in unintended ways," and distinguishes *direct* injection (a user deliberately tries to override instructions) from *indirect* injection (a document, page, or tool result the model reads contains hidden instructions). An MCP server that returns workspace content, search results, or file contents is a direct channel for the indirect kind. OWASP's recommended mitigations — least-privilege access, requiring human approval for high-risk actions, and segregating external content from instructions — map closely to the authentication and confirmation mechanisms covered below.

None of these risks are eliminated by any single control, including authentication. A well-scoped, well-authenticated agent can still be misled by injected content into calling a tool it was authorized to call. Authentication limits *who* can act and *how much* they can do — it doesn't validate *why* an action was requested.

## OAuth and interactive authorization

OAuth's browser-based consent step is often experienced as friction, but it's a security feature: it puts a human decision between "a client wants access" and "the client has access," on a screen the user controls, not the client. [RFC 9700, the OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700), documents the current consensus on doing this safely — PKCE for authorization code interception resistance, exact redirect URI matching, and short-lived, audience-bound tokens are the load-bearing pieces.

Remnus implements OAuth 2.1 with PKCE (`S256`) for interactive clients: a client dynamically registers itself (RFC 7591), opens the Remnus consent screen where the person picks the target workspace and scope, and exchanges an authorization code for tokens after approval. Access tokens expire after 1 hour; refresh tokens rotate on every use and expire after 30 days, so a connected client stays authenticated without a token ever being shown to the user. Full detail is in the [Authentication documentation](https://remnus.com/wiki/authentication).

## Personal access tokens and headless agents

OAuth's consent screen assumes a person is present to see it. A cron job, a CI step, or any other unattended process can't complete that step, so it needs a credential it can present up front instead. Remnus's answer is a personal access token (PAT): a static bearer token, minted only by a workspace owner (or platform admin), presented as `Authorization: Bearer rmns_xxxxxxxxxxxxxxxx`. There's no separate "service account" object — the PAT fills that role.

Because a PAT doesn't expire on its own unless you set that, and because whoever holds it can act as its scope, treat it like any other long-lived credential: minimum scope, an expiry date where practical, and storage in a real secret manager rather than a config file. The full walkthrough — including a verified headless Claude Code example — is in [How to Run Headless AI Agents Without Login Prompts](/docs/run-headless-ai-agents-with-mcp).

## Permission scopes and least privilege

The MCP specification's own guidance on scope design is direct about the failure mode: a token carrying broad, omnibus scopes turns a single leak into a wide blast radius, and makes revocation disruptive because it has to cut off everything the token could do, not just the one workflow that mattered. The specification's stated mitigation is a minimal, least-privilege scope model, requesting only what a given operation needs.

Remnus's scope model is intentionally simple rather than a fine-grained, per-tool system: every PAT and OAuth connection is `read` or `write` for the whole workspace.

| Scope | Access |
| --- | --- |
| `read` | Search, list, and read pages, databases, members, and the audit log. Cannot change anything. |
| `write` | Everything in `read`, plus creating, updating, and deleting pages, databases, and views. |

Calling a write tool with a read-scoped token fails with no change made — the boundary is enforced server-side, not just by which tools a client chooses to offer. The practical rule: default to `read` for anything that only needs to observe, and reserve `write` for connections that genuinely need to change content.

## Read tools vs write tools

The two scopes map directly onto two risk profiles. Read tools — `prepare_context`, `search_workspace`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log`, `get_changes_since`, `get_related_pages` — can expose information but can't alter the workspace; the worst case is an over-broad read scope seeing more than it should.

Write tools — `create_page`, `update_page`, `bulk_update_pages`, `delete_page`, `move_item`, `create_database`, `update_database_schema`, and the database-view tools — can alter or remove content, so they carry the destructive-action risk covered next. `bulk_update_pages` in particular deserves attention in a review: a single call can touch many records at once, which is efficient but also means a bad instruction has more surface to act on in one shot.

## Human approval for sensitive operations

The clearest defense against a destructive action executing by accident — whether from a bad prompt, an injection, or a plain mistake — is making it a two-step process instead of one. Remnus's write tools implement this directly: `delete_page` requires `confirm: true` to actually delete anything; called without it, the tool returns a description of what *would* be deleted and changes nothing. `update_database_schema` requires the same `confirm: true` before removing a column (which destroys that column's data), and `delete_database_view` requires it before removing a view. The documented pattern is to always call once without `confirm` first, review the preview, then confirm.

This is a separate mechanism from normal authorization and from Remnus's Strict context policy, which requires a current `contextRunId` from that same actor's `prepare_context` call before a mutation is accepted. A workspace using Strict mode gets both checks on a destructive write: proof that context was prepared first, and an explicit confirmation step — neither one substitutes for the other.

## Audit logs and action provenance

An action that can't be traced back to who (or what) performed it is hard to investigate and harder to trust. The MCP specification calls out exactly this failure mode as a consequence of poorly-scoped or improperly-validated tokens: a server that accepts opaque, upstream-issued tokens "will be unable to identify or distinguish between MCP Clients," which the specification notes makes incident investigation and auditing harder.

Every tool call made through Remnus — from a PAT or an OAuth connection — is recorded in the workspace's audit log, queryable with the `query_audit_log` tool or visible in the **AI Agents** panel. That gives a workspace owner a record of which token performed which action and when, independent of whether the action turned out to be correct. Audit logging doesn't prevent a bad action; it's what makes one reviewable and attributable after the fact.

## Token storage, rotation, expiration, and revocation

Once a token exists, how it's stored matters as much as how it was scoped. OWASP's [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) is explicit that environment variables are "generally accessible to all processes and may be included in logs or system dumps" — appropriate as the last step from a secret store into a process, not as the storage location itself — and recommends credentials "regularly rotate... so that any stolen credentials will only work for a short time."

Applied to Remnus tokens specifically:

- **Storage.** Use your CI platform's encrypted secrets or a dedicated secret manager, never a literal value in a repository, config file, or Dockerfile.
- **Rotation.** There's no automatic rotation for a PAT — set a deliberate practice of replacing tokens shared with third-party services on a schedule you control.
- **Expiration.** A PAT can be created with or without an expiry date; expired tokens return `401 Unauthorized`. Set one for anything used by an automation or shared outside your immediate team.
- **Revocation.** Any PAT or OAuth connection can be revoked instantly from the **AI Agents** panel; a revoked token returns `401 Unauthorized` on its next request. Revoke first and ask questions after, if a token's exposure is even suspected.

## Security checklist for users

- [ ] Use `read` scope unless the connection genuinely needs to write.
- [ ] Set an expiry date on any PAT shared with a third-party service or automation.
- [ ] Store tokens in a secret manager or CI secret store — never in a repository.
- [ ] Review a `delete_page` or schema-removal preview before passing `confirm: true`.
- [ ] Check the audit log periodically, not only after something looks wrong.
- [ ] Revoke a token immediately if you suspect it leaked, then re-issue if needed.
- [ ] Only connect MCP servers (local or remote) that you trust and can review.

## Security checklist for MCP server developers

- [ ] Never accept a token that wasn't explicitly issued for your server — the MCP specification is direct that "MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server," to prevent the token-passthrough and confused-deputy failure modes.
- [ ] Offer at least a read/write scope split; don't ship a single omnibus token that can do everything.
- [ ] Require an explicit, separate confirmation step for destructive operations — don't let one call both describe and execute a deletion.
- [ ] Log every tool call with the acting token's identity, not just the operation, so actions are attributable.
- [ ] Support token expiration and instant revocation; don't make a leaked credential valid indefinitely.
- [ ] Treat all tool-returned content as data for the model to reason about, not as instructions it should follow.
- [ ] Document your actual security model plainly — vague claims are worse than a specific, honest boundary.

## How Remnus applies these principles

Remnus's controls line up with the categories above: OAuth 2.1 + PKCE for interactive clients, PATs with `read`/`write` scope for headless ones, mandatory `confirm: true` on destructive writes, an optional Strict context-preflight requirement, instant revocation, and a full audit log queryable by any workspace member with access. All of it is documented on the [Authentication](https://remnus.com/wiki/authentication) and [Security & Authentication](https://remnus.com/security) pages, and every claim in this article was checked against that current documentation rather than assumed.

Being transparent about limitations matters as much as listing controls. Remnus's authorization boundary stops at Remnus itself — it cannot sandbox, monitor, or restrict what a connected agent's local shell, filesystem, or Git operations do, because those never pass through Remnus's MCP endpoint at all. Its scope model is coarse (`read`/`write` per connection, not per-tool or per-page), not the fine-grained, progressively-elevated scope system the MCP specification describes as an option. And treating retrieved page content as reference data rather than instructions reduces prompt-injection risk but doesn't eliminate it — no platform-level control can fully substitute for scoping what an agent can reach and reviewing what it does with write access. None of this is a compliance certification or a guarantee; it's a documented, checkable set of boundaries.

## FAQ

### Does OAuth or a personal access token make an MCP server secure?

No single mechanism does. Authentication controls who can act and, through scope, how much — it doesn't validate the intent behind a request or prevent a well-authorized agent from being misled by injected content. Security comes from combining authentication, least-privilege scope, confirmation steps, and audit logging, not from any one of them alone.

### What's the difference between prompt injection and excessive permissions?

Prompt injection is content manipulating what an agent decides to do; excessive permissions is how much damage it can do once misled (or simply mistaken). Least-privilege scoping doesn't stop an injection attempt, but it bounds what a successful one can reach.

### Why does Remnus require a separate confirmation step for deletions instead of just checking authorization?

Authorization checks whether a token is *allowed* to delete something; confirmation checks whether *this specific action* was actually intended. A write-scoped token is authorized to call `delete_page` at any time — the `confirm: true` requirement exists so a preview is shown and reviewed before anything is actually removed.

### Can an MCP server developer build a completely secure server?

No platform can claim that, and any that does should be treated skeptically. The MCP specification's own security guidance describes ongoing, evolving mitigations for specific attack classes — confused deputy, token passthrough, SSRF, local server compromise — precisely because new ones keep surfacing. The realistic goal is a documented, narrow, auditable boundary, not an absolute guarantee.

### Is a coarse read/write scope model less secure than a fine-grained one?

It's a different tradeoff, not automatically worse. A fine-grained, per-tool scope system reduces blast radius further but adds complexity to reason about and configure correctly. A simple read/write split is easier to audit and get right, at the cost of a write-scoped token being able to touch anything write-scoped tools can reach. Match the granularity you need to how much you trust the client and the operator minting the token.

### How do I know what an agent actually did with my workspace?

Check the audit log. Every tool call made with a PAT or OAuth connection is recorded and queryable with `query_audit_log` or visible in the **AI Agents** panel — independent of whether the client's own UI showed you the action at the time.

## Build on a boundary you can verify

MCP security isn't a single switch — it's the sum of interactive versus headless authentication chosen correctly, scopes kept narrow, destructive actions requiring a real confirmation step, and every action landing in a log someone can actually read. Treat any platform's security claims, including this one, as something to check against current documentation rather than take on faith.

Read the [Security & Authentication overview](https://remnus.com/security) and [Authentication documentation](https://remnus.com/wiki/authentication) for the full current detail, then [try Remnus](https://remnus.com/) to see the scopes, confirmations, and audit log firsthand.
