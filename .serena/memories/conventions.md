# Conventions

## i18n (CRITICAL)
- All user-facing strings via next-intl — NO hardcoded strings, not even `|| 'Untitled'`
- Client components: `useTranslations('Namespace')`
- Server components/layouts: `await getTranslations('Namespace')`
- Server actions: `getTranslations('Errors')` for error messages
- Add keys to ALL 8 files (en/tr/hi/es/fr/de/zh/ru) — missing keys fall back to English via the deep-merge in request.ts, then to the key name
- 30 namespaces: Layout, Home, Auth, Workspace, WorkspaceSettings, Templates, Database, Editor, Page, IconPicker, Admin, Errors, LanguageSwitcher, MobileNav, Landing, Billing, Pricing, Contact, Download, Privacy, Updater, Sharing, UserSettings, OAuthAuthorize, Security, Consent, Onboarding, DemoFeedback (demo in-app feedback prompt), Brand (public /brand brand-kit page), Mailing (admin /admin/mailing UI + public /unsubscribe page)
- EMAIL COPY IS NOT i18n: the SES email templates (src/lib/email/templates.ts) are English-only by design (recipient locale isn't stored) — do NOT move email strings into messages/*.json
- `Layout` namespace also has browser-tab strings (Tauri-only TabBar): `tabNewTooltip`, `tabClose`, `tabCloseOthers`, `tabCloseAll`, `tabUntitled` (besides demoMode/demoChangesNote/createFreeAccount)
- `Consent` namespace: drives `CookieConsentBanner` (geo-aware cookie consent) — title/descriptionRequired/descriptionInformational/learnMore/accept/reject/gotIt keys
- `Billing` namespace: drives BillingModal + WorkspaceSettings Billing tab + MembersTab seat meter (tier_*/status_*/seats/agents/storage/unlimited/upgradeTo/manageBilling/seatsUsage/seatLimitHint etc). Billing limit error keys live in `Errors` (seatLimitReached/agentLimitReached/storageLimitReached/workspaceLimitReached/billingUnavailable/billingInvalidTier/billingNoCustomer)
- `Sharing` namespace keys include: tabSharing, shareButton, shareModalTitle/Hint, permissionLabel/Read/Write, slugLabel/Placeholder/Hint/Taken/Invalid, createShare, copyLink/linkCopied, revokeShare/Confirm, sharedAt, deleteWorkspaceSharedWarning, notFound, readOnlyBadge/writeBadge, saving/saveError, includeChildren/Hint, childrenShared, widthLabel/Narrow/Wide/Full, editShare, saveChanges, addToSitemap
- `Workspace` namespace includes `deleteConfirm` (interpolated with `{title}`) and `deleteCancel` keys for item-deletion confirmation modal
- `MobileNav` namespace keys: `menu`, `home`, `new`, `close`, `workspace`, `user`, `signOut` — used by `MobileNavWrapper`
- `Landing` namespace: drives `MarketingHeader`, `MarketingFooter`, `HeroSection`, `FeaturesSection` (navHome/navPricing/navContact/navSignIn/navGetStarted/hero*/feature*Title/Desc/footer* keys)
- `Pricing` namespace: drives `PricingSection` (free/pro tier content)
- `Contact` namespace: drives `ContactSection` (github/email/community channel cards)
- `Download` namespace: drives `DownloadView` (/download page) — title/subtitle/detecting/downloadFor/os*/file* keys for the desktop installer download grid + `pwa*` keys for the PWA surfaces: /download mobile section (pwaHeading/pwaIntro/pwaInstallCta/pwaInstalledBadge/pwaIos*/pwaAndroid*), PwaInstallModal (pwaShortLabel/pwaModalTagline/pwaBenefit1-3/pwaHowTitle/pwaTab{Ios,Android,Desktop}/pwa{Ios,Android}Step1-3/pwaDesktopHint/pwaModalDesktopLink), PwaInstallNudge (pwaNudgeText/pwaNudgeLater). Landing ns also has bridgeFooterCompanyMobileApp (footer "Mobile app" link)

## Auth
- NEVER call `auth()` directly in server actions/components — use `getCurrentUser()` from `src/lib/auth/session.ts` (React.cache wrapped)
- All workspace actions → `assertWorkspaceAccess(workspaceId)`
- All database/page actions → `assertDatabaseAccess(databaseId)`
- Unauthenticated → `redirect('/login')`; unauthorized → throws

## Server Actions
- `useActionState`-compatible signature: `(_prevState, formData)` for form actions
- Revalidate with `revalidatePath('/')` ONLY for structural sidebar mutations (create/delete items); NOT for content edits

## UI / Design
- Flat, shadowless, `rounded-none` everywhere in workspace (no cards, no shadows)
- 3-tier bg: `bg-neutral-950` (outermost body), `bg-neutral-900` (sidebars/panels), `bg-neutral-850` (content/canvas)
- Borders: `border-neutral-800` single lines; no chunky cards
- Auth pages exception: `rounded-xl` card, `rounded-lg` inputs (deliberate contrast)
- All colors via `@theme` tokens in `globals.css` — use Tailwind tokens, not hex

## Data Patterns
- JSON column pattern for dynamic properties (no EAV, no extra tables)
- `SelectOption`: `{ value: string; color?: SelectOptionColor }` — `normalizeOption` for backward compat with plain strings
- Date formatting: `formatDateValue()` from `properties.ts`; never hardcode `'en-US'`

## Component Patterns
- Optimistic mutations: apply locally first, revalidate in background
- Editor: `key={page.id}` to remount `BlockEditor` on page switch
- `ChildBlock` markdown serialization: `<div data-cb-id="...">` (NOT custom elements — `marked` only parses standard HTML block elements)
- TanStack Query: installed via `QueryProvider` — use for client mutation hooks

## MCP / Agent Token Conventions
- Token format: `<MCP_TOKEN_PREFIX>_<prefix8>_<secret>` (env var `MCP_TOKEN_PREFIX=rmns`)
- Verification: look up by `tokenPrefix`, then `bcrypt.compare(secret, tokenHash)` — never iterate all tokens
- `/api/mcp` is whitelisted in `auth.config.ts` (`isMcpRoute`) so middleware never redirects MCP requests
- `export const runtime = 'nodejs'` required on MCP route (bcryptjs not Edge-compatible)
- Write tools must check `ctx.scope !== 'write'` and return an error — never execute the mutation
- Audit logs in `agent_activity` are best-effort (`.catch(() => {})` — tool response must not depend on audit success)
- New migrations: `when` value must be greater than all existing — next migration `when > 1781900000000` (0031_signup_attribution = user signup_* cols; 0032_demo_feedback = demo_feedback table; 0033_mailing = email_campaigns + email_log + user email_unsubscribed_at/email_suppressed; 0034_agent_usage = agent_activity REBUILD: token_id nullable + oauth_token_id + owner_user_id + response_bytes — fixes silent OAuth audit drop, powers usage meters; 0035_deleted_items = deleted_items tombstone table, powers get_changes_since; 0036_page_links = page_links content-derived link graph, powers get_related_pages — apply script + backfill-page-links.ts, both run on local + Turso)
- **createdAt/updatedAt gotcha is NOT DrizzleAdapter-specific — it's plain SQLite:** a column `DEFAULT CURRENT_TIMESTAMP` evaluates to TEXT (`'YYYY-MM-DD HH:MM:SS'`), not a Unix integer, no matter which driver inserts the row; any `integer(...,{mode:'timestamp'})` column left to that default reads back as `Invalid Date`. Found (2026-07) silently affecting every workspace_items/standalone_pages/databases/pages insert that omitted createdAt/updatedAt — fixed by stamping both explicitly with `new Date()` in services/workspace.ts, actions/workspace.ts, actions/page.ts, seed.ts. When reading these columns for anything time-sensitive (delta sync, sort-by-recency), guard with an `isValidDate()`-style check — older pre-fix rows still carry the bad TEXT value and should be treated as unknown/epoch, not thrown on.
- Many recent migrations (0017–0036) are NOT in `_journal.json` — applied manually via `src/db/apply-00xx-*.ts` scripts (libsql `batch()` silently no-ops DDL). Apply each to BOTH local (`DATABASE_URL="file:local.db" npx tsx ...`) and Turso (plain `npx tsx ...` reads `.env`). **`.env`'s Turso (`remna-db-ranork`) IS production remnus.com** — plain runs are prod operations.
- **tsx/ESM import-hoisting gotcha:** in tsx scripts that `import { db } from '@/db'`, a `dotenv.config()` CALL runs too late (imports hoist above it) → '@/db' initializes with DATABASE_URL unset and silently falls back to file:local.db. Fix: `import 'dotenv/config';` as the FIRST import (see backfill-page-links.ts). Raw createClient apply scripts are immune; command-line `DATABASE_URL=...` prefix always safe. This misdirected a "Turso" backfill (2026-07-07) and probably Faz 0's 0034 "Turso" apply (prod audit-log inserts silently failed from the cd5faa2 deploy until 0034 was actually applied to prod on 2026-07-07).

## Performance
- `Promise.all` for independent fetches (no waterfalls in layouts)
- Loading skeletons in `loading.tsx` files for each route
