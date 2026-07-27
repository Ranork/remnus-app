# Current task

## Status

Done

## Active agent

Codex

## Branch

master

## Goal

Redesign the admin landing-traffic trend visualization around a polished line chart, add a daily view, and add frequently used selectable date ranges for every granularity.

## Scope

- Admin landing-traffic PostHog trend data and visualization only.
- Preserve the existing Sources tab, channel/campaign selector, hover tooltip, and optional bar view.
- Add all new user-facing strings to all 8 locales.

## Completed

- Added a zero-filled, last-30-days `daily` series to `getTrafficTrend()` with matching per-channel and campaign-tag PostHog queries.
- Added a localized Daily tab beside Sources, Weekly, and Monthly.
- Changed the trend default from bar to line while retaining the bar toggle.
- Redesigned the line rendering with a taller plot, smooth bounded curves, subtle line glow, gradient area fill for single-series views, reduced point clutter, endpoint emphasis, hover points, and granularity-aware date labels.
- Added independent range selectors: Daily 30/90/365 days, Weekly 12/26/52 weeks, Monthly 12/24/36 months.
- Expanded `getTrafficTrend()` to return zero-filled maximum windows (365 days / 52 weeks / 36 months), then slice them client-side for instant switching without more PostHog requests.
- Made X-axis label density responsive to the measured chart width so the 365-day series stays readable.
- Updated the project source map and all 8 translation files.

## Changed files

- `src/lib/actions/analytics.ts`
- `src/components/features/admin/AdminTrafficSources.tsx`
- `src/components/features/admin/TrafficTrendChart.tsx`
- `messages/{en,tr,hi,es,fr,de,zh,ru}.json`
- `AGENTS.md`
- `.ai/CURRENT_TASK.md`

## Verification

- Targeted ESLint passed for the analytics action and both traffic components.
- Source TypeScript passed with a temporary config excluding `.next`; the normal command is currently blocked by concurrently corrupted `.next/dev/types` generated output from active dev processes.
- All 8 message JSON files parse successfully and contain the new daily keys.
- `git diff --check` passed.

## Remaining work

- None.

## Known issues

- Runtime visual verification of live PostHog data requires an authenticated admin session and runtime PostHog query credentials; those were not available through this coding session.

## Next exact step

Review all nine range/granularity combinations in an authenticated admin session with live PostHog data, then commit if approved.
