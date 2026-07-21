# Current task

## Status

Done

## Active agent

Claude Code

## Branch

master

## Base commit

c89d045

## Goal

Fix two verified inconsistencies surfaced while writing the MCP-native workspace article.

## Scope

Two small corrections, no behavior change beyond the metadata value:
1. OAuth authorization-server metadata pointed `service_documentation` at `/docs/mcp`, which 404s. The live MCP docs root is `/wiki`.
2. `skills/remnus/SKILL.md` still described "five prompt templates"; the server actually ships seven (`save-memory` and `recall-context` were added later).

## Completed

- Repointed `service_documentation` to `${base}/wiki` in `src/app/.well-known/oauth-authorization-server/route.ts`.
- Updated the SKILL.md Prompts section to "seven prompt templates" and added accurate `save-memory` and `recall-context` entries (params taken from `src/app/api/mcp/prompts.ts`).
- Swept the repo for other stale "five prompts" copy. The only other hit — `src/lib/email/templates.ts` preheader "Five prompts…" — correctly counts the five example prompts in that email body, not the MCP prompt-template count, so it was left unchanged.

## Changed files

- `src/app/.well-known/oauth-authorization-server/route.ts`
- `skills/remnus/SKILL.md`
- `.ai/CURRENT_TASK.md`

## Decisions

- Chose `/wiki` (the in-app MCP docs overview, verified HTTP 200) as the `service_documentation` target rather than `/docs/mcp` (404) or a deep page.

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint -- src/app/.well-known/oauth-authorization-server/route.ts` passed.
- `/wiki` confirmed HTTP 200 (live); `/docs/mcp` confirmed 404.
- Prompt names/params in SKILL.md cross-checked against `prompts.ts` (7 prompts total).

## Remaining work

- None.

## Known issues

- None.

## Next exact step

Task complete; changes committed and pushed to master.
