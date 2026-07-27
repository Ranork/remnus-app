# Current task

## Status

Done

## Active agent

Codex

## Branch

master

## Goal

Audit and improve the public landing/marketing pages in light mode so they read as a deliberate white-site design rather than a dark design with inverted tokens.

## Scope

- Public pages rendered through `LandingBridgeSwitcher` and `MarketingShell`.
- Keep the authenticated workspace Catppuccin palette unchanged.
- Preserve dark-mode visuals and existing component structure/copy.

## Completed

- Added a shared `.marketing-site` scope to the main landing composition and every `MarketingShell` page.
- Added a Catppuccin-only marketing palette—including body-portaled modal/banner chrome on marketing routes—with a true white page, ink headings, readable slate body text, white cards, light inset surfaces and refined borders.
- Added alternating near-white section bands and a restrained blue hero wash for clearer long-page rhythm.
- Restyled the sticky marketing nav as a translucent white, blurred surface with a fine shadow.
- Replaced dark-only white hover washes with token-based hover surfaces that work in both themes.
- Added light-specific preview/dropdown shadows and restored dark monochrome Cursor/Notion marks on white.
- Refined light-mode pricing: removed page-wide hero wash and per-plan gradient darkening, standardized white cards, reduced the comparison-column fill to an edge-defined near-white treatment, and made Startup the single filled CTA.
- Polished the landing download section with larger platform-specific icon surfaces, title-linked tags, consistent device stages, and more convincing phone/desktop chrome in both themes.
- Kept the authenticated workspace palette and dark marketing theme unchanged.

## Changed files

- `src/app/globals.css`
- `src/components/marketing/LandingBridgeSwitcher.tsx`
- `src/components/marketing/MarketingShell.tsx`
- `src/components/marketing/LandingNav.tsx`
- `src/components/marketing/LandingThemeToggle.tsx`
- `src/components/marketing/PwaNavButton.tsx`
- `src/components/marketing/LandingHero.tsx`
- `src/components/marketing/LandingPricing.tsx`
- `src/components/marketing/LandingDownload.tsx`
- `src/components/marketing/WhatsInsideViewer.tsx`
- `src/components/docs/WikiSidebar.tsx`
- `AGENTS.md`
- `.serena/memories/core.md`
- `.ai/CURRENT_TASK.md`

## Verification

- Targeted ESLint passed for every modified TSX component.
- Serena diagnostics are clean for the primary wrappers and hero component.
- `git diff --check` passed.
- Headless Edge visual checks passed for the landing page (desktop/mobile), `/pricing`, `/docs`, and `/contact` in Turkish light mode.
- A second 1440×1800 `/pricing` pass confirmed the cleaner card hierarchy and comparison table after the refinement.
- Desktop light/dark captures confirmed the download cards, device framing, and section spacing; targeted ESLint and `npx tsc --noEmit` passed after the polish.

## Remaining work

- None.

## Known issues

- None introduced by this change.

## Next exact step

Review the public pages in a normal browser, then commit if approved.
