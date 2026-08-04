# How Remnus Uses OKF to Give AI Agents Better Context

Connecting an AI coding agent to a workspace solves an access problem: the agent can finally read requirements, decisions, tasks, and project notes. It creates a second problem just as quickly. Which pages should the agent read? Which ones are current? Who reviewed them? How much of a limited context window should be spent finding out?

Remnus now uses Open Knowledge Format (OKF) ideas as the foundation of a context engine for MCP-connected agents. The goal is not to make agents read an OKF archive before every action. It is to turn workspace knowledge into something portable, attributable, rankable, and safe to retrieve within a deliberate token budget.

This article explains what is implemented, how Claude Code and Codex benefit, what is automatic, and where the boundaries still are.

## OKF is an interchange layer, not a second database

Remnus pages and database rows still live in the normal Remnus database. People continue to edit them in the same page editor, table, kanban, and calendar views. OKF v0.2 sits at the portability boundary: a workspace can be exported as a versioned Markdown knowledge pack and imported into a separate workspace after a safe preview.

That distinction matters. An interchange format should not force the application to maintain two competing sources of truth. Remnus keeps its native records canonical and stores OKF-aligned knowledge metadata alongside them:

- the kind of knowledge a page represents;
- a retrieval description and tags;
- sources and provenance;
- lifecycle state and review-after date;
- the trust state of the current revision.

Unknown imported top-level metadata is preserved instead of silently discarded. Remnus-specific database schemas and views stay under an extension namespace so the portable core remains readable without pretending every application has identical features.

## The Knowledge Context panel

A page can be perfectly readable to a person and still be difficult for an agent to retrieve correctly. A title such as “Final approach” says very little when the workspace contains three earlier approaches with similar words.

The **Knowledge context** panel lets a member add the signals retrieval needs:

- a clear description;
- concept type;
- tags;
- source references;
- active, draft, deprecated, or archived lifecycle state;
- a date after which the page should be reviewed again.

These fields do not replace the page body. They give the retrieval layer a compact explanation of what the body means and when it should be trusted.

## Human review is tied to the exact content

A permanent “verified” checkbox becomes misleading the moment somebody edits the page. Remnus therefore hashes the current title and body when a signed-in member reviews a page. The review applies only while that exact revision remains current.

If the page changes, the old review remains historical evidence but no longer qualifies the new content as human-reviewed. An agent can add machine provenance or propose metadata, but it cannot grant itself a local human review.

Imported trust claims are kept separate too. An OKF bundle that says `verified: human:alice` may contain useful provenance, but Remnus did not authenticate Alice or witness the review. It is represented as an external human assertion until a Remnus member reviews the current revision locally.

The current trust levels are:

| Trust level | Meaning |
|---|---|
| `human-reviewed` | A signed-in Remnus member reviewed the exact current title and body |
| `external-human-asserted` | An imported bundle carries a human claim that Remnus did not authenticate |
| `machine-confirmed` | The content has agent or external machine provenance without a current local review |
| `unverified` | No stronger signal exists |

## Context Pack v2: retrieve before you read everything

The MCP tool [`prepare_context`](/wiki/read-tools#prepare_context) accepts a concrete task and an explicit token budget. Context Pack v2 searches the whole accessible corpus, but it does not return the whole corpus.

It combines:

1. BM25 relevance across titles, descriptions, tags, and bodies.
2. Knowledge type, lifecycle, and source metadata.
3. Exact-revision trust signals.
4. Freshness penalties for stale or deprecated material.
5. A compact neighborhood from page links and backlinks.

The response contains ranked excerpts, selection reasons, related page references, approximate token usage, truncation status, and warnings. When one excerpt is not enough, the agent can fetch that one page in full instead of opening ten candidates first.

A typical request looks like this:

```text
Use Remnus prepare_context directly for this task:
"Add viewer-role support to workspace invitations."

maxTokens: 2000
maxConcepts: 6
trustPolicy: prefer-human-reviewed
includeRelated: true

Show profile, estimatedTokens, truncated, concepts, related and warnings.
Do not change anything yet.
```

The returned content is explicitly treated as untrusted reference data. A sentence inside a workspace page cannot override the user's request, the agent's system instructions, or repository rules.

## Manual, Smart, and Strict

Workspace owners choose a policy under **Workspace Settings → Portability**.

| Mode | What happens | Best fit |
|---|---|---|
| Manual | `prepare_context` runs only when the user or workflow asks | Experiments and highly controlled manual flows |
| Smart | MCP instructions tell compatible clients to prepare context for meaningful multi-page work and skip trivial requests | Recommended default |
| Strict | The same context-first flow, plus Remnus mutations require a current preflight | Governed write workflows |

Smart mode is automatic guidance. A compatible client receives the policy in the MCP server instructions, so users should not need to repeat “prepare context first” in every prompt. Guidance is not a universal enforcement mechanism; client implementations can behave differently.

Strict mode is enforced by the Remnus server for Remnus writes. `prepare_context` returns a short-lived `contextRunId` bound to the workspace and the PAT or OAuth actor. An actual mutation without that current ID is rejected. Normal write scope, workspace authorization, and destructive confirmations still apply independently.

## Does this save tokens?

It can, when one compact pack replaces repeated listing, searching, and full-page reads. It can also waste tokens if forced before a greeting, formatting-only request, or a task involving one already-known page.

That is why Smart is the efficiency default and Strict is positioned primarily as governance. The open-source repository includes a deterministic synthetic benchmark for ranking and budget regressions, but its percentage is not a production or customer claim. Real savings should be measured across representative, consented workspaces before they appear in marketing copy.

Context Pack v2 also complements the rest of Remnus's token contract:

- projected database queries omit unused columns and bodies;
- outline mode lets an agent skim a long page first;
- workspace digests provide cheap orientation;
- delta sync returns only what changed;
- compact MCP JSON avoids paying for decorative whitespace.

## What becomes automatic for Claude Code and Codex?

After the MCP server is connected, the workspace policy is announced automatically. Smart-aware agents can follow it without a special phrase in every task. Strict ensures that related Remnus writes cannot skip the preflight.

An MCP server cannot intercept local filesystem edits, shell commands, Git operations, or tools belonging to another server. If a team wants “read Remnus context before changing repository code” to be a repository rule, it should also add the supplied context-first snippet to `AGENTS.md` or `CLAUDE.md`. Remnus ships templates for both in the open-source repository.

The separation is intentional:

- Remnus controls access to and mutations inside Remnus.
- The coding client controls local code tools.
- Repository instructions connect the two workflows when a team wants that policy.

## An end-to-end product workflow

Consider a Codex agent asked to change workspace invitations.

1. Codex calls `prepare_context` with the concrete engineering task.
2. Remnus returns the reviewed invitation decision, current schema notes, a stale warning for an older plan, and related Work Plan IDs inside the selected budget.
3. Codex inspects the repository and proposes a plan without changing anything.
4. After approval, it implements and tests the code.
5. Codex updates the matching Remnus task with the same `contextRunId` when Strict mode is enabled.
6. The MCP audit log records the operation and agent identity.
7. A person can review the resulting durable specification revision in Remnus.

The benefit is not “AI has more context.” It is that the agent starts with a smaller, explainable set of context that the team can inspect and correct.

## What is implemented today

| Capability | State |
|---|---|
| Safe-preview OKF v0.2 import and export | Implemented; experimental adapter |
| Native descriptions, types, tags, sources, lifecycle, and freshness | Implemented |
| Exact-revision human review | Implemented |
| External-human vs local-human trust separation | Implemented |
| BM25 + metadata + link-graph Context Pack v2 | Implemented |
| Manual, Smart, and Strict workspace policies | Implemented |
| Actor-bound 30-minute context runs | Implemented |
| Strict enforcement for Remnus MCP mutations | Implemented |
| Enforcement over local code, shell, and Git from MCP alone | Not possible; repository/client policy required |
| Broad production savings benchmark | Not yet established |

## Why this matters for Remnus

Most workspace integrations stop at connectivity: the agent can read and write. Remnus now adds a knowledge contract around that access. Teams can see what the agent was given, distinguish reviewed knowledge from machine output, move the same material through an open Markdown bundle, and decide whether context preparation is advisory or mandatory for writes.

That is the product direction: not a larger hidden memory store, but a human-readable workspace where people and agents share knowledge with explicit context, trust, and provenance.

Read the complete [Context-First MCP guide](/wiki/context-first), then connect an agent from **AI Agents → Connect editor** and run the read-only example above.
