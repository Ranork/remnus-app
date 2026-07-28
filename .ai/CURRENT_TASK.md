# Current task

## Status

Done locally. Article created and registered; no commit or push requested.

## Active agent

Codex

## Branch

master

## Goal

Add the English article "How to Connect OpenAI Codex to Remnus with MCP" to the file-driven public Docs blog.

## Completed

- Reviewed the current official OpenAI Codex manual and public MCP/AGENTS.md documentation.
- Verified the current local Codex CLI supports remote Streamable HTTP servers through `codex mcp add --url`, OAuth through `codex mcp login`, and bearer-token environment variables.
- Verified the current Remnus endpoint, OAuth/PAT setup, scopes, tool workflows, audit behavior, rate limit, public setup docs, security page, and MCP-native workspace article.
- Added the article, registered its metadata, and updated the blog source README.

## Changed files

- `docs/blog/connect-openai-codex-to-remnus-mcp.md`
- `docs/blog/README.md`
- `src/lib/content/manifest.ts`
- `.ai/CURRENT_TASK.md`

## Decisions

- Scoped the guide to local Codex CLI and IDE-extension clients, explicitly excluding ChatGPT web connectors, the OpenAI API, the Codex SDK, and Codex cloud.
- Used the current CLI-first OAuth setup (`codex mcp add ... --url` + `codex mcp login`) and retained project `config.toml` plus PAT environment-variable configuration as alternatives.
- Kept the requested SEO Metadata section in the article body. The route supplies the H1 from manifest metadata, so the Markdown body does not duplicate it.
- No dedicated multi-agent workspace article is published; linked the current MCP-native workspace article, which covers the shared/multi-agent model.

## Verification

- Article word count: 2,173 words including SEO metadata (target 1,600–2,200).
- `npm run lint -- src/lib/content/manifest.ts` passed.
- `npx tsc --noEmit` passed.
- `getBlogPost('connect-openai-codex-to-remnus-mcp')` rendered 18,134 HTML characters, 13 H2s, 16 H3s, and an 11-minute reading time.
- All article links were checked; Remnus pages returned 200, official OpenAI pages resolved through the live official docs fetch, and `/api/mcp` returned the expected unauthenticated 401 with OAuth resource metadata.
- `git diff --check` passed.

## Remaining work

- None for the article.

## Known issues

- The required Remnus Work Plan MCP tools were not exposed in this session, so no external task row was updated.
- The prior Tauri ACL fix below still awaits the user's build/test result.

## Next exact step

Review the local diff. Commit and push only if the user requests it.

---

# Prior task — Tauri desktop download ACL

## Status

Bumped to 0.1.15, tagged `v0.1.15`, pushed to `origin/master` — GitHub Actions `tauri-release.yml` builds and PUBLISHES a real (non-draft, non-prerelease) GitHub Release for Windows/macOS/Linux on tag push. Awaiting user to download and test the Windows build (cannot compile/test locally — no Rust toolchain on this machine).

## Active agent

Claude Code

## Branch

master

## Goal

Fix the long-standing Tauri desktop bug: after a download finishes, the toast's "Show in folder" button does nothing (no reaction at all). Three prior dedicated commits (`fc3fa28`, `fba4c62`, `f224506`) already hardened the Windows-side `explorer.exe /select,` logic in `reveal_download` without resolving it — user asked to test one more hypothesis before falling back to routing all downloads through the system browser (Notion-style).

## Root cause found (via code reading only — no Rust toolchain available to compile-verify)

The main window loads a **remote origin** (`https://remnus.com` / `http://localhost:3000` — see `WebviewWindowBuilder` in `src-tauri/src/lib.rs`), not bundled local assets. Tauri v2's ACL requires every invokable command — including the app's own `#[tauri::command]` functions, not just plugin commands — to be explicitly granted to a capability for a remote-origin webview. None of this app's 9 custom commands (`reveal_download`, `get_download_dir`, `pick_download_dir`, `reset_download_dir`, `quit_app`, `detect_installed_agents`, `write_agent_config`, `run_claude_connect`, `install_remnus_skill`) had any ACL permission entry — `src-tauri/capabilities/default.json` only listed plugin permissions (`opener:*`, `deep-link:*`, etc.), and no `src-tauri/permissions/` directory existed. So `invoke('reveal_download', ...)` was silently rejected by Tauri before the Rust handler (which is itself correct) ever ran — this is why "no reaction at all" matches exactly, and why the Windows-side fixes in prior commits never helped (they fixed a layer that was never reached).

This exact root cause was already independently discovered and documented in a comment in `src/components/features/editor/FileBlockView.tsx` (its own download button routes around `reveal_download` entirely via a signed URL + system browser, specifically because of this ACL block) — but the generic `DownloadToast.tsx` blob:/data: fallback path was never fixed the same way.

## Completed

- Added `src-tauri/permissions/app-commands.toml` — 4 permission entries (`allow-reveal-download`, `allow-download-dir`, `allow-quit-app`, `allow-agent-connect`) covering all 9 custom commands.
- Added those 4 identifiers (bare, unprefixed — my best-confidence reading of Tauri v2's convention for app-level, non-plugin permissions) to `src-tauri/capabilities/default.json`'s `permissions` array, in the same capability entry that already has `"remote": {"urls": [...]}"` scoping (so it should apply to the remote-loaded webview like the existing `opener:*` entries do).
- Validated the edited `capabilities/default.json` is well-formed JSON.

## Changed files

- `src-tauri/permissions/app-commands.toml` (new)
- `src-tauri/capabilities/default.json`
- `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (version bump 0.1.14 → 0.1.15, matching the convention of prior release commits like `fba4c62`)

## Verification

- **Could not compile-verify** — this machine has no Rust/Cargo toolchain installed (`cargo`/`rustc` not found via bash or PowerShell, no `~/.cargo/bin`). The exact ACL identifier-namespace syntax (bare identifier vs. a crate-name-prefixed one, e.g. `remnus-app:allow-reveal-download`) is my best recollection of Tauri v2's convention, not something I could confirm against a real build here.
- Only checked: JSON validity of the edited capabilities file, and that the command names in the new permission file match the exact function names registered in `tauri::generate_handler![...]`.

## Remaining work

- User will build/run the Tauri app themselves (`npm run tauri:dev` or their normal flow) and test:
  1. Does it build at all? If Tauri's ACL validation rejects the permission identifiers, it should fail loudly at build time with a clear "unknown permission" error — if so, the likely fix is prefixing the 4 identifiers with the Cargo package name (`remnus-app:allow-reveal-download` etc., `src-tauri/Cargo.toml` package name is `remnus-app`) instead of using them bare.
  2. If it builds: trigger a blob:/data: download (something that still hits the in-app save+toast path, not an http(s) one already delegated to the system browser) and click "Show in folder" — does Explorer now open and select the file?
  3. Bonus (same root cause, same fix): "Quit & Reopen" after an update download (`UpdateBanner.tsx`), and the AI-agent auto-connect/skill-install flow — these use `quit_app`/`detect_installed_agents`/`write_agent_config`/`run_claude_connect`/`install_remnus_skill`, which had the identical missing-ACL problem and should now also start working if the theory holds.
- If this doesn't resolve it (or the user doesn't want to keep chasing the platform-specific ACL/Windows-Explorer angle), fall back to the previously-discussed plan: extend the already-proven browser-delegation pattern (signed URL + system browser, as `FileBlockView.tsx` already does) to cover the remaining blob:/data: download call sites, and remove the now-unnecessary `reveal_download`/download-dir Rust machinery.

## Known issues

- Namespace-prefix uncertainty noted above — this is the one part of the fix I'm not fully confident about without a compile check.

## Next exact step

Wait for the user's build/test result. If it's an ACL "unknown permission" build error, retry with the `remnus-app:` prefix on the 4 new identifiers instead of bare.

---

## Prior task (separate, still pending user verification)

A previous session in this same conversation fixed 4 unrelated database/editor bugs (schema live-sync, select-option-in-table-cell markdown copy, default select option). That work is done and type-checked but not yet confirmed working by the user in the browser. See git diff / conversation history for details — not re-summarized here to avoid this file growing unbounded; ask the user for status if picking this back up.
