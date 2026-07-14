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
```

There is currently no general unit/integration/e2e test runner or `test` script. Do not invent one. Run `npm run build` only when build behavior changed, before release, or when explicitly requested.

## Database
```powershell
npx drizzle-kit generate          # Generate migration SQL from schema changes
npm run db:migrate                # Custom migration runner
npm run db:setup                  # Explicit database setup task
```

## Migration notes
- New migration `when` values must exceed the current ceiling documented at the end of `AGENTS.md`'s Migration Notes; current verified threshold: `> 1782000000000`.
- Manual migrations currently extend through `0038`; many are outside `_journal.json`. Read each matching `src/db/apply-00xx-*.ts` note before execution.
- A plain apply/backfill command can target production Turso because of env precedence. Set and verify the intended `DATABASE_URL` explicitly; never run a production migration as onboarding verification.
- Never use `drizzle-kit push` interactively; use the custom runner or the documented idempotent apply script.

## Platform/package commands
```powershell
npm run tauri:dev
npm run tauri:build
npm run cap:sync
npm run cap:open:android
npm run mcpb:build
npx tsx scripts/test-emails.ts
```

## Windows-specific
- Target Windows PowerShell 5.1 unless the task explicitly chooses PowerShell 7.
- Prefer separate commands or `;`; do not assume `&&` exists.
- Use `-LiteralPath` for Turkish/spaced paths and `$env:VAR` for environment variables.
