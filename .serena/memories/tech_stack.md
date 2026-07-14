# Tech Stack

Last verified: 2026-07-14
Primary sources: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `src/db/schema.ts`

- **Framework:** Next.js 16.2.6 (App Router) — React 19, TypeScript 5
- **Styling:** TailwindCSS v4 (`@tailwindcss/postcss`), Lucide React v1.16
- **Fonts:** loaded in `src/app/layout.tsx` via `next/font/google`, exposed as `@theme` vars in `globals.css` — `--font-sans` = **Onest** (UI/body), `--font-mono` = **JetBrains Mono** (code), `--font-serif` = **Fraunces** (display/headings, normal+italic; used as `font-serif italic` on landing accents). Underlying CSS vars: `--font-onest`/`--font-jetbrains-mono`/`--font-fraunces`.
- **Database:** SQLite local (`file:local.db`) via `@libsql/client` v0.17; Drizzle ORM + Cloudinary (image uploads, `POST /api/upload`, env: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) v0.45
- **Auth:** Auth.js v5 beta (`next-auth@^5.0.0-beta.31`) + `@auth/drizzle-adapter`; bcryptjs v3
- **i18n:** next-intl v4 (App Router native); `localePrefix: 'never'`; 8 locales (en/tr/hi/es/fr/de/zh/ru)
- **Editor:** Tiptap v3 (StarterKit, Markdown, TaskList, Table, Suggestion, BubbleMenu, Placeholder)
- **State/Cache:** TanStack Query v5 (staleTime 60s, gcTime 5min, no window-focus refetch)
- **Analytics/telemetry:** PostHog (client + server, EU host) and `@vercel/analytics` v2
- **Migration:** `drizzle-kit generate` → `npx tsx src/db/migrate.ts` (custom runner)

## Version Pins That Matter
- `next-auth` is **beta** — API differs from stable v4
- `next-intl` is **v4** — App Router native API, not the v3 Pages Router pattern
- Tiptap is **v3** — `@tiptap/markdown` v3 API, `renderMarkdown` is a direct extension field
- TailwindCSS is **v4** — config via `@theme` in `globals.css`, not `tailwind.config.js`
- Next.js is **16.x** — may have breaking changes vs training data; check `node_modules/next/dist/docs/`
