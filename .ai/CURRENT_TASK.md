# Current task

## Status

Done

## Active agent

Claude

## Branch

master

## Base commit

3aa7141 (Working tree at task start)

## Goal

Make the admin panel's Agent Activation Funnel filterable by signup date, so post-onboarding-change conversion can be viewed separately from the all-time funnel (with all-time remaining the default view).

## Scope

Add an optional `sinceMs` cutoff to the `getActivationFunnel` server action and a client-side date filter UI on the admin dashboard. No new DB migration; no change to the underlying funnel definition (signup → connected → activated).

## Completed

- Read AI.md, current Git state; no prior `.ai/CURRENT_TASK.md` context existed for this request (previous entry was an unrelated, already-Done blog task).
- Located the funnel in `src/lib/actions/analytics.ts` (`getActivationFunnel`) and its render in `src/app/[locale]/(app)/admin/page.tsx`.
- Added `sinceMs?: number` param to `getActivationFunnel`; filters the real-user cohort by `users.createdAt >= sinceMs` (normalized via the existing `toEpochMs` helper to handle legacy `CURRENT_TIMESTAMP` text rows) before deriving connected/activated subsets.
- Extracted the funnel list UI into a new client component, `AdminActivationFunnel.tsx`, which renders the server-computed all-time funnel by default and re-fetches via the server action when the admin picks a "since" date; an "All time" pill resets it.
- Added `funnelFilterAllTime` / `funnelFilterSince` keys to all 8 locale files (`en`, `tr`, `hi`, `es`, `fr`, `de`, `zh`, `ru`).

## Changed files

- `src/lib/actions/analytics.ts`
- `src/app/[locale]/(app)/admin/page.tsx`
- `src/components/features/admin/AdminActivationFunnel.tsx` (new)
- `messages/{en,tr,hi,es,fr,de,zh,ru}.json`
- `.ai/CURRENT_TASK.md`

## Decisions

- No specific "onboarding update" date was hardcoded as a default filter — the exact cutoff the admin has in mind wasn't specified in this session, so the filter is a free date picker (defaulting to all time) rather than a guessed preset. The admin can point it at whichever date they consider the onboarding change.
- Filtering is done in JS against `toEpochMs(users.createdAt)`, matching the file's existing convention for handling the createdAt gotcha, rather than a raw SQL `>=` comparison.
- Connected/activated stages stay defined as "ever did X", scoped to the (now date-filtered) signup cohort — not further time-boxed by when the connect/activate event happened.

## Verification

- `npm run lint -- src/lib/actions/analytics.ts "src/app/[locale]/(app)/admin/page.tsx" src/components/features/admin/AdminActivationFunnel.tsx` passed.
- `npx tsc --noEmit` passed (whole project).
- All 8 `messages/*.json` files parse as valid JSON and have equal key counts (153) under `Admin`.
- Not yet visually verified in a browser (admin panel requires an authenticated admin session).

## Remaining work

- Optional: manually click through the new date filter in the running admin panel to confirm the refetch/loading state looks right.

## Known issues

- None.

## Next exact step

Task complete; no commit or push requested. If desired, visually verify the new filter in `npm run dev` under `/admin` while logged in as an admin.
