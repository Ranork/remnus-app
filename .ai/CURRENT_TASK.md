# Current task

## Status

Done

## Active agent

Codex

## Branch

master

## Goal

Refocus the landing-page hero on trying the product: replace the old action/stat rows with a large demo CTA, a lower-emphasis free-start CTA, and a quiet integrations discovery link in the established Remnus visual language.

## Scope

- Landing hero CTA hierarchy only.
- Preserve the existing heading, subhead, desktop workspace showcase, trust badges, and hover demo interaction.
- Keep all user-facing strings localized across 8 locales.

## Completed

- Removed the inline “Start your workspace” / “See the integrations” actions.
- Removed the 19-tools / 5-resources / 5-prompts stat strip and MCP-details link.
- Added a persistent, full-width `HeroDemoButton` as the dominant left-column CTA; it calls the existing `loginAsDemo` action and has loading feedback.
- Added a lower-emphasis `/login` button underneath with localized “Start for free” copy.
- Added a tertiary localized “Explore integrations” text link below the buttons; it smooth-scrolls to the existing `#integrations` section.
- Reused the same demo interaction module for the existing desktop screenshot hover overlay.
- Removed obsolete CTA/stat translation keys and added `bridgeHeroCtaFree` plus `bridgeHeroExploreIntegrations` in all 8 locales; strengthened demo wording from “explore” to “try” where applicable.
- Updated `AGENTS.md` and Serena core memory to reflect the new CTA hierarchy and removal of the hero count-sync obligation.

## Changed files

- `src/components/marketing/LandingHero.tsx`
- `src/components/marketing/HeroDemoOverlay.tsx`
- `messages/{en,tr,hi,es,fr,de,zh,ru}.json`
- `AGENTS.md`
- `.serena/memories/core.md`
- `.ai/CURRENT_TASK.md`

## Verification

- Targeted ESLint passed for both hero components.
- Source TypeScript passed with `.next` excluded (active dev processes had left malformed generated `.next/dev/types` output).
- All 8 locale JSON files parse and contain `Landing.bridgeHeroCtaFree` and `Landing.bridgeHeroExploreIntegrations`; removed keys have no remaining source/message references.
- `git diff --check` passed.
- Headless Edge visual checks passed at 1440×1000 and responsive 500×900 widths in the Turkish light theme; hierarchy, alignment, wrapping, and button widths were visually confirmed.

## Remaining work

- None.

## Known issues

- None introduced by this change.

## Next exact step

Review the landing hero in the preferred production theme, then commit if approved.
