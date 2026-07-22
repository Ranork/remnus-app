# Current task

## Status

Done

## Active agent

Claude Code

## Branch

master

## Base commit

59bfce3

## Goal

Add the English blog article "How to Connect Cursor to Remnus with MCP" to the file-driven public Docs blog.

## Scope

Create the markdown article, register its blog metadata, update the blog source README, verify every Cursor + Remnus detail against live sources, and commit + push. No route or pipeline changes.

## Completed

- Read AI.md, current Git state, and the existing connect-editor article for voice.
- Verified Cursor MCP specifics against the current official docs (`https://cursor.com/docs/mcp`, after the docs.cursor.com -> cursor.com/docs migration): global `~/.cursor/mcp.json` vs project `.cursor/mcp.json`, remote HTTP server uses `url` + optional `headers` (no `type`), OAuth supported for remote servers, per-tool approval on by default, toggle without restart.
- Verified Remnus connection details from `docs/mcp/*` and `src/lib/mcp/deeplinks.ts` (Cursor deeplink builder, `~/.cursor/mcp.json` path), plus the endpoint, scopes, and token model from prior verification.
- Wrote the article, registered it in the manifest (icon `Plug`, date 2026-07-22), and updated `docs/blog/README.md`.

## Changed files

- `docs/blog/connect-cursor-to-remnus-mcp.md`
- `docs/blog/README.md`
- `src/lib/content/manifest.ts`
- `.ai/CURRENT_TASK.md`

## Decisions

- Kept the SEO brief out of the article body (repo convention, commit `3aa7141`); delivered it in chat and folded the meta description into the manifest entry.
- No dedicated "multi-agent workspace" article exists; linked `/docs/what-is-an-mcp-native-workspace` (which contains the Multi-agent collaboration section) as the closest live cross-link, rather than guessing a URL.
- Did not hand-fabricate the base64 Cursor deeplink; directed readers to the in-app "Add to Cursor" button that generates it.
- Flagged version-dependent UI labels (Tools & Integrations / MCP & Integrations) as a limitation rather than asserting one exact menu path.

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint -- src/lib/content/manifest.ts` passed.
- `getBlogPost('connect-cursor-to-remnus-mcp')` rendered: ~17.9k chars HTML, 12 `<h2>` + 8 `<h3>`, reading time 11 min.
- All hyperlink targets returned HTTP 200; `/api/mcp` correctly returned 401 unauthenticated.
- Article prose ~1,920 words (target 1,500-2,100).

## Remaining work

- None for this article.

## Known issues

- None.

## Next exact step

Task complete; article committed and pushed to master.
