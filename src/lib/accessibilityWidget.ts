/**
 * The vendored accessibility widget (`src/app/layout.tsx`) belongs to the public
 * site. Inside the app it floated over the knowledge map and dashboards, because its
 * exclude list named only some app routes (`/graph`, `/w` and `/dashboard` were
 * missing — R7).
 *
 * Two layers keep it out of the app:
 * 1. This list, as the script's `data-exclude-paths`, so the button is never drawn
 *    on first load of a listed route. Widget semantics (widget.source.js →
 *    `matchesPath`): a string matches the path itself or anything under it
 *    (`/w` ⇒ `/w`, `/w/…`, not `/wiki`); a trailing `*` is a raw prefix. The path it
 *    tests includes `?query` and `#hash`, hence the `?*` twin of every prefix
 *    (`/app?billing=success` is not under `/app`).
 * 2. `AccessibilityWidgetOff`, mounted by the `(app)` layout, disables the widget
 *    while the app shell is on screen — so a route added to `(app)` later and missed
 *    here still does not show it (at worst a flash before hydration).
 *
 * Keep the list in step with the top-level folders of `src/app/[locale]/(app)/`.
 */
export const APP_ROUTE_PREFIXES = ['/app', '/admin', '/dashboard', '/db', '/graph', '/page', '/w'] as const;

export const WIDGET_EXCLUDE_PATHS = APP_ROUTE_PREFIXES.flatMap((prefix) => [prefix, `${prefix}?*`]).join(',');
