# Task Completion Checklist

Last verified: 2026-07-14
Primary sources: `AI.md`, `AGENTS.md`, `package.json`

Use the narrowest checks that match the change:

1. **Lint/type shape** — run targeted lint first; add `npx tsc --noEmit` when TypeScript interfaces, imports, routes, or config shapes changed.
2. **Relevant tests** — run only an existing related test. The repository currently has no general test runner/script; `scripts/test-emails.ts` is a targeted email-template check, not a suite.
3. **Runtime/UI** — use the dev server only when runtime behavior needs proof; use Playwright or visual inspection for UI work.
4. **Build** — last resort: build behavior changed, release preparation, or explicit user request. Never use a full build for documentation-only onboarding.
5. **i18n** — new user-facing text must use next-intl and exist in all 8 `messages/*.json` files (en/tr/hi/es/fr/de/zh/ru).
6. **Database** — schema changes require the documented migration flow; confirm the latest threshold (`> 1782000000000`) and target database before any apply command.
7. **Documentation/memory** — structural changes update `AGENTS.md` plus relevant Serena memories. Shared workflow changes update `AI.md`.
8. **Handoff** — update `.ai/CURRENT_TASK.md` accurately and run `scripts/ai/update-handoff.ps1`.
9. **Work Plan** — when a matching task exists and `remnus-mcp` is available, write the file/test summary and set it to `Done`.
