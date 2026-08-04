# Context-First MCP and OKF Knowledge

Remnus uses Open Knowledge Format (OKF) ideas to make workspace knowledge portable, attributable, reviewable, and easier for AI agents to retrieve. OKF is the versioned interchange layer; Remnus's native database remains the canonical source that people and agents edit together.

The practical result is a context-first MCP workflow. Instead of asking an agent to list the workspace, search repeatedly, and open many full pages, [`prepare_context`](read-tools.md#prepare_context) builds one compact Context Pack v2 for the concrete task. The MCP server advertises the active workspace policy in its session instructions, and every pack includes a 30-minute `contextRunId` that can be reused on related writes.

## What OKF means inside Remnus

OKF is not a second editor, a hidden vector database, or the canonical application store. It gives Remnus a shared vocabulary for knowledge:

- **Identity and type** — decision, specification, guide, definition, memory, or another durable concept.
- **Retrieval metadata** — description, tags, sources, status, and lifecycle dates help an agent find the right material.
- **Trust and provenance** — Remnus distinguishes a local exact-revision review, an external human assertion, machine provenance, and unverified content.
- **Links** — page links and backlinks contribute a small graph neighborhood without forcing the agent to read every linked body.
- **Portability** — Workspace Settings → Portability exports and imports an experimental OKF v0.2 Markdown bundle while preserving Remnus-specific fields under extensions.

Each page and database row has an optional **Knowledge context** panel. A person can describe what the page represents, tag it, record sources, mark its lifecycle, choose when it should be reviewed again, and review the exact current revision.

## From a task to a context pack

Context Pack v2 combines five signals:

1. BM25 relevance across titles, descriptions, tags, and bodies.
2. Native OKF-aligned metadata.
3. Exact-revision trust signals.
4. Freshness and lifecycle penalties for stale or deprecated knowledge.
5. Compact parents, children, links, and backlinks from the page graph.

The selector then fits the strongest concepts into the caller's explicit token budget. Every concept explains why it was selected, and the response reports estimated tokens, truncation, related references, and warnings. Retrieved page content is reference data, not an instruction channel: it cannot override the user's request or the client's system and repository rules.

## Modes

| Mode | Agent behavior | Server enforcement |
|---|---|---|
| Manual | Call `prepare_context` only when the user or workflow asks | None |
| Smart (default) | Prepare context for meaningful multi-page product/coding tasks; skip trivial or single-known-page work | Guidance in MCP server instructions |
| Strict | Same context-first flow | Remnus MCP mutations require the current agent's unexpired `contextRunId` |

Configure the mode under **Workspace Settings → Portability → Agent context policy**. Start with Smart. Enable Strict after the workspace has useful descriptions, tags, and reviewed decisions; otherwise a very narrow trust policy can correctly return an empty pack.

## Recommended agent flow

```text
1. prepare_context({ task, maxTokens: 2000, trustPolicy: "prefer-human-reviewed" })
2. Inspect profile, estimatedTokens, truncated, concepts, related and warnings.
3. Fetch a full page only if a selected excerpt is insufficient.
4. Reuse contextRunId on related Remnus mutation tools.
5. Add optional knowledge metadata when creating a durable decision or specification.
```

The server stores task and selection hashes plus operational metrics in the context-run record, not the raw task text. The run belongs to the current workspace and PAT/OAuth actor, so another connection cannot borrow it.

## Response fields

| Field | Why it matters |
|---|---|
| `profile` | Identifies the response contract as `remnus-context-pack-v2` |
| `estimatedTokens` / `budgetTokens` | Shows the approximate pack size and caller-supplied ceiling |
| `truncated` | Signals that lower-priority content was shortened or omitted |
| `concepts` | Ranked excerpts with knowledge metadata and `selectionReason` |
| `related` | IDs and titles from the strongest concept's graph neighborhood |
| `warnings` | Empty trust filters, stale material, truncation, or other retrieval caveats |
| `contextRunId` / `expiresAt` | Actor-bound preflight proof for related Strict-mode writes |

## Trust model

- `human-reviewed`: a signed-in Remnus member reviewed the exact current title/body hash.
- `external-human-asserted`: an imported OKF bundle claims a `human:*` verifier. Useful provenance, but not authenticated by Remnus.
- `machine-confirmed`: agent-generated or externally attested knowledge without a local exact-revision review.
- `unverified`: no stronger signal exists.

Editing a reviewed page automatically makes the previous review historical because its content hash no longer matches. Agents can propose metadata and create drafts, but cannot grant themselves local human-reviewed status.

This model avoids a common portability trap. An imported file may honestly carry `verified: human:alice`, but Remnus did not authenticate Alice or witness that review. It therefore preserves the claim as `external-human-asserted` until a signed-in Remnus member reviews the current revision locally.

## What is and is not automatic

MCP session instructions reach compatible clients automatically, so Smart mode does not require a sentence in every prompt when the client follows server guidance. Because this is guidance, a client can ignore or incompletely apply it. Strict mode closes that gap for **Remnus MCP writes**: the server rejects the mutation unless the same actor prepared current context first.

MCP cannot intercept an editor's local filesystem, shell, Git, or another MCP server. If you also want to require Remnus context before local code changes, add the context-first rule to that repository's `AGENTS.md`/`CLAUDE.md` or install the Remnus skill. Client hooks can add another local gate, but they are client-specific and should not be marketed as universal MCP enforcement.

Repository-ready instruction snippets are included in the open-source project under `integrations/context-first/`.

## Context and rate-limit impact

Smart context can reduce total usage when one 1,000–2,000-token pack replaces repeated search/list/full-page calls. Calling it before every tiny message would do the opposite. Measure on representative tasks with:

```bash
npm run bench:context
```

That command uses a deterministic synthetic regression fixture. Its percentage is not a customer or production claim; publish savings claims only after measuring real, representative, consented workspaces.

Strict mode is primarily a governance feature, not a token-saving switch. It adds a preflight call when one is missing. Smart is the normal efficiency mode because it uses the pack for substantive multi-page work and skips greetings, formatting-only requests, and a single already-known page.

## Example for Claude Code or Codex

```text
Use Remnus prepare_context directly for this task:
"Analyze the product and technical context for adding viewer-role invitations."

maxTokens: 2000
maxConcepts: 6
trustPolicy: prefer-human-reviewed
includeRelated: true

Show profile, estimatedTokens, truncated, concepts, related and warnings.
Do not change code or workspace content yet.
```

After approval, the agent can carry the returned `contextRunId` into `create_page`, `update_page`, or another related Remnus mutation. In Smart mode this is recommended; in Strict mode it is required.

## Current status and boundaries

| Capability | Status |
|---|---|
| Native knowledge metadata and exact-revision reviews | Implemented |
| OKF v0.2 import/export with preserved extensions | Implemented, experimental adapter |
| BM25 + metadata + link-graph Context Pack v2 | Implemented |
| Manual, Smart, and Strict workspace policies | Implemented |
| Server-enforced preflight for Remnus MCP mutations | Implemented in Strict mode |
| Universal enforcement over local files, shell, or Git | Not possible from an MCP server; use repository instructions/client hooks |
| Production token-savings claim across customers | Not established; requires representative telemetry |

## Related guides

- [Getting Started](getting-started.md) — connect a client and run a safe first context request.
- [Read Tools](read-tools.md#prepare_context) — complete `prepare_context` input/output reference.
- [Write Tools](write-tools.md) — `contextRunId` and optional knowledge metadata on mutations.
- [Token-Efficient Usage](token-efficient-usage.md) — combine context packs with projection, outlines, digests, and delta sync.
- [Agent Memory](agent-memory.md) — save durable decisions and preferences as human-readable workspace content.
