# Current task

## Status

Done

## Active agent

Claude Code

## Branch

master

## Base commit

ba36a77

## Goal

Add the English blog article "How to Connect Claude Code to Remnus with MCP" to the file-driven public Docs blog.

## Scope

Create the markdown article, register its blog metadata, update the blog source README, verify every command/endpoint/link against live sources, and commit + push. No route or pipeline changes.

## Completed

- Read AI.md, CLAUDE.md, current Git state, and the existing blog/wiki content architecture.
- Verified the Remnus MCP surface directly from source: endpoint, OAuth routes, and the authoritative tool list (9 read + 10 write) in `src/app/api/mcp/tools/`.
- Verified the live OAuth discovery chain: `401` + `WWW-Authenticate` -> `/.well-known/oauth-protected-resource` -> authorization-server metadata (PKCE `S256`, dynamic registration, `read`/`write` scopes).
- Verified the Claude Code CLI surface against the current official docs and the locally installed v2.1.197.
- Wrote the article, registered it in the manifest, and updated `docs/blog/README.md`.

## Changed files

- `docs/blog/connect-claude-code-to-remnus-mcp.md`
- `docs/blog/README.md`
- `src/lib/content/manifest.ts`
- `.ai/CURRENT_TASK.md`

## Decisions

- Kept the SEO brief out of the article body and folded the meta description into the manifest entry, matching commit `3aa7141` ("Hide blog SEO brief from article body"). The brief was delivered in chat instead.
- Reused the existing `/docs/<slug>` pipeline and the already-imported `Plug` icon.
- Documented the write scope as 10 tools (including the three `*_database_view` tools) per source, rather than the 7 listed in `docs/mcp/authentication.md`.
- Rebased onto `ba36a77` (admin activation-funnel work by another agent). Both entries in this single-slot file were already `Done`; the prior entry is preserved in that commit.

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint -- src/lib/content/manifest.ts` passed.
- `getBlogPost('connect-claude-code-to-remnus-mcp')` rendered: 20,216 chars of HTML, 10 `<h2>` sections.
- All 12 outbound links returned HTTP 200; `/api/mcp` correctly returned 401 unauthenticated.
- Article prose is ~2,120 words (target 1,500-2,100).

## Remaining work

- None for this article.

## Known issues

- `docs/mcp/authentication.md` scope table omits `create_database_view`, `update_database_view`, and `delete_database_view` from the `write` row. Not fixed here (out of scope).
- The OAuth authorization-server metadata advertises `service_documentation: https://www.remnus.com/docs/mcp`, which returns 404. The live docs are at `/wiki`. Not fixed here (out of scope).

## Next exact step

Task complete; article committed and pushed to master.
