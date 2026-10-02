# Suggested Commands

Last verified: 2026-07-14
Primary sources: `package.json`, `AGENTS.md`, `src/db/`

## Install, dev, and validation
```powershell
npm ci                   # Install exactly from package-lock.json
npm run dev              # Start Next.js development server
npm run lint             # ESLint
npx tsc --noEmit         # Strict TypeScript check when TS shapes change
npm run start            # Start an existing production build
npm run test:okf         # Targeted OKF/context-pack check (pure, no DB)
npm run test:recurrence  # Recurrence rule engine — 26 pure-function assertions, no DB
npm run test:access      # Workspace access requests (npx remnus join) — writes+cleans up rows, LOCAL DB ONLY:
#                           DATABASE_URL="file:local.db" npm run test:access
npm run test:agent-access  # Removed member / viewer → their PAT + OAuth tokens refused/read-only (request time + stored rows), LOCAL DB ONLY:
#                           DATABASE_URL="file:local.db" npm run test:agent-access
npm run bench:context    # Synthetic Context Pack ranking/token regression + (P13) docs/ graph-expansion report (related refs vs controls)
npm run test:code-paths  # P13: knowledge sources read as repo paths + file matching (pure, no DB)
npm run test:workspace-deletion  # deleteWorkspaceData leaves nothing behind (DATABASE_URL="file:local.db"; refuses remote)
npm run test:trash-links  # delete + restore keeps links, restore re-syncs page_links, map orphan≠hub (DATABASE_URL="file:local.db"; refuses remote)
# Real type check while .next/dev/types/routes.d.ts is half-written: a syntax error there makes tsc skip ALL semantic
# checks ("only .next errors" ≠ clean). Restart dev to regenerate it, or tsc -p a temp config that excludes .next/dev
# and next-env.d.ts (next-env imports that file) and includes .next/types instead.
npx tsx src/db/cleanup-orphaned-workspace-data.ts [--apply]  # leftovers of deleted workspaces; dry run by default; plain run = PROD (.env)
npm run bench:graph      # Knowledge map: mention thresholds on docs/ + synthetic 5k workspace (DATABASE_URL="file:local.db" — refuses remote; --keep/--member/--cleanup)
npm run bench:tokens     # Read-shaping savings (digest vs crawl, fields, outline) — needs a DB:
#                           DATABASE_URL="file:local.db" npm run bench:tokens
npm run bench:mcp-budget # Per-session MCP context cost: tools/list per tool + per scope,
#                           model-visible (description+inputSchema) vs wire-only, prompts,
#                           resources, instructions, AGENTS.md block, and a modelled session.
#                           DATABASE_URL="file:local.db" npm run bench:mcp-budget [-- <workspaceId>] [--dump=tools.json]
#                           Locally it dies on `Cannot find module 'server-only'` (analytics/server.ts imports it; the
#                           package is not installed — Next bundles its own). Don't install it: point NODE_PATH at a
#                           scratch dir holding server-only/{package.json,index.js (empty)} for the run (P13, 2026-09-24).
npm run bench:mcp-request   # Server cost of the session-opening MCP requests (initialize, lists, digest) through the
#                           real handler with a minted local PAT (deleted after): median ms + DB round trips per
#                           method, per scope. BENCH_DB_RTT_MS=80 models a far DB. Local only. Redirects
#                           `server-only` to Next's stub itself. DATABASE_URL="file:local.db" npm run bench:mcp-request
#                           BENCH_TOOLS=1 (V2 R9) adds tool calls: reads + writes to scratch items it deletes again.
npm run bench:web -- setup|run|ids|cleanup   # (V2 R9) web routes on a local `next start`: fixture account, per-route
#                           time / HTML+RSC size / DB round trips. Server: BENCH_DB_TRACE=1 BENCH_DB_RTT_MS=10
#                           AUTH_SECRET=<throwaway>; bench: BENCH_AUTH_SECRET=<same> ... run --base <url> --log <server log>.
#                           Local file DB only. Build with `npx next build` (never `npm run build`: migrates prod).
npm run test:i18n-client     # (V2 R9.1) client message scopes match the code; `-- --write` regenerates src/i18n/clientNamespaces.ts
npm run bench:change-signal # (V2 R9/R9.8) Turso rows read per live-refresh poll, before/after migrations 0055 + 0056, on the
#                           Turso DEV db (.env.turso-dev). Run from PowerShell (Turso DNS fails in Git Bash).
npm run bench:mcp-handshake -- --project <dir> [--runs 5] [--bridge mcpjson|local]
#                           Spawns the project's .mcp.json server like Claude Code and times initialize + lists.
#                           Read-only; the bridge reads the token, the script never does. Rate limit: 60 req/min
#                           per token, one run = 6 requests (incl. the bridge's map refresh) → ≤ 9 runs a minute.
```

There is still no general unit/integration/e2e test runner or `test` script — do not invent one. The three commands above are targeted, self-contained checks, not a suite. Run `npm run build` only when build behavior changed, before release, or when explicitly requested.

## Database
```powershell
npx drizzle-kit generate          # Generate migration SQL from schema changes
npm run db:migrate                # Custom migration runner
npm run db:drift                  # READ-ONLY: schema.ts vs target DB (tables/columns/indexes); plain = Turso (.env), DATABASE_URL="file:local.db" = local. Run before every deploy.
npm run db:setup                  # Explicit database setup task
```

## Migration notes
- New migration `when` values must exceed the current ceiling documented at the end of `AGENTS.md`'s Migration Notes; current verified threshold: `> 1782000000000`.
- Manual migrations currently extend through `0043`; many are outside `_journal.json`. Read each matching `src/db/apply-00xx-*.ts` note before execution.
- `0043_recurrence` (recurring calendar cards) is the newest: `src/db/apply-0043-recurrence.ts`, idempotent, additive only.
- A plain apply/backfill command can target production Turso because of env precedence. Set and verify the intended `DATABASE_URL` explicitly; never run a production migration as onboarding verification.
- Never use `drizzle-kit push` interactively; use the custom runner or the documented idempotent apply script.

## Platform/package commands
```powershell
npm run tauri:dev
npm run tauri:build
npm run cap:sync
npm run cap:open:android
npm run mcpb:build
npm run release:patch -- --dry-run  # verify next desktop version without writes
npm run release:patch               # bumps npm/Cargo lockstep, commits, tags, pushes, starts updater release CI
npx tsx scripts/test-emails.ts
```

## Windows-specific
- Target Windows PowerShell 5.1 unless the task explicitly chooses PowerShell 7.
- Prefer separate commands or `;`; do not assume `&&` exists.
- Use `-LiteralPath` for Turkish/spaced paths and `$env:VAR` for environment variables.
