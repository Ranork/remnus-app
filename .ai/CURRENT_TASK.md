# Current task

## Status

Done

## Active agent

Claude Code

## Branch

master

## Base commit

068a4f4

## Goal

Add the English blog article "What Is an MCP-Native Workspace? A Complete Guide" to the file-driven public Docs blog.

## Scope

Create the markdown article, register its blog metadata, update the blog source README, verify every feature claim and link against live sources/source code, and commit + push. No route or pipeline changes.

## Completed

- Read AI.md, current Git state, and the existing blog voice (`docs/blog/mcp-native-vs-integrated.md`).
- Verified the MCP primitive surface directly from source: 19 tools (9 read + 10 write), 5 resources, and 7 prompts (`summarize-page`, `weekly-status-report`, `kanban-triage`, `extract-tasks`, `search-and-create`, `save-memory`, `recall-context`). The homepage's "7 prompts" is correct; an earlier truncated grep had suggested 5.
- Verified auth/audit claims against the live security page and `docs/mcp/*` (OAuth 2.1 + PKCE, PAT `rmns_` bcrypt-hashed, read/write scopes, 1h/30d token expiry, immutable audit log, 7d/90d retention, confirm-gated destructive ops).
- Verified workspace features against the live homepage (pages, databases, kanban, calendar, table views) and the client list against `docs/mcp/connect-editors.md`.
- Wrote the article, registered it in the manifest (icon `BookOpen`, date 2026-07-21), and updated `docs/blog/README.md`.

## Changed files

- `docs/blog/what-is-an-mcp-native-workspace.md`
- `docs/blog/README.md`
- `src/lib/content/manifest.ts`
- `.ai/CURRENT_TASK.md`

## Decisions

- Kept the SEO brief out of the article body (repo convention, commit `3aa7141`); delivered it in chat and folded the meta description into the manifest entry.
- Linked only verified-live pages: `remnus.com`, `/wiki`, `/wiki/agent-memory`, `/wiki/authentication`, `/security`, `/docs/mcp-native-vs-integrated`, plus official MCP and Claude Code docs.
- Framed Remnus as "fit, not replacement" per the brief's constraint against over-claiming.

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint -- src/lib/content/manifest.ts` passed.
- `getBlogPost('what-is-an-mcp-native-workspace')` rendered: ~19.6k chars HTML, 10 `<h2>` + 12 `<h3>`.
- All 8 outbound links returned HTTP 200.
- Article prose ~2,500 words (target 2,000-2,500).

## Remaining work

- None for this article.

## Known issues

- The public homepage still advertises "5 prompts" in some copy paths historically; the current source and homepage agree on 7. `skills/remnus/SKILL.md` still says "five prompt templates" (predates `save-memory`/`recall-context`) — stale, not fixed here (out of scope).

## Next exact step

Task complete; article committed and pushed to master.
