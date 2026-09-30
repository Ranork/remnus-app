# Playbook: Library / SDK

What an agent looks for and models when calibrating a library or SDK: public API, releases, deprecations, supported runtimes.

For [Calibrate](../calibrate.md), Phase 2b. Index: [Playbooks](../playbooks.md).

**Evidence first.** This playbook is a list of things to look for, not a template: no
database, column or row gets created unless this project's code, docs or history shows it.

## Pick it when

The project is published for other code to import, and has no app of its own:
`package.json` with `exports`/`main` + `types` and a `files` list; `pyproject.toml` with a
build backend and no server; `[lib]` in `Cargo.toml`; a `*.gemspec`; a `go.mod` module
without `main`. Stronger with semver tags (`git tag`), a `CHANGELOG.md`, `examples/`,
a docs generator (TypeDoc, Sphinx, MkDocs) or a publish workflow in CI.

## Concepts to model

**Public API** (`conceptType: api`) — one row per entry point or module a user imports,
not per symbol; a module whose exports differ in stability gets one row per stability
(`backoff` stable, `backoff` experimental), so the Stability column stays true. `Entry point` text · `Stability` select (`Stable`, `Experimental`,
`Deprecated`) · `Since` text (a version) · `Docs` url.

**Releases** (`release`) — from tags and the changelog. Title is the version. `Date` date
· `Type` select (`Major`, `Minor`, `Patch`) · `Breaking` checkbox.

**Deprecations** (`deprecation`) — `Deprecated in` text · `Removed in` text ·
`Replacement` text · `Status` status (`Announced` → `Removed`).

**Supported runtimes** (`compatibility`) — only from a CI matrix or an `engines` /
`requires-python` field. `Runtime` text · `Status` select (`Supported`, `Best effort`,
`Dropped`).

## Example rows

- **Public API** — *`createClient()`* · Entry point `@acme/sdk` · Stability `Stable` ·
  Since `1.0.0`. Body: "The first call every user makes. Retries idempotent requests
  3 times with backoff; everything else fails fast. Holds one socket per instance, so
  users should create it once."
- **Releases** — *2.0.0* · Type `Major` · Breaking checked. Body: "Dropped Node 16 and the
  callback API. Migration: wrap calls in `await`; `onError` moved to the client options.
  Reason: the callback path doubled the test matrix for 4% of downloads."

## Home dashboard

The workspace's home (`home: true`), which opens on the **Pano** button:
- `project` — summary: what the library lets its users do and who they are; stack chips
  (language, supported runtimes, package registry).
- Then, only for the databases you actually built, and only blocks that show something
  today:
  - Releases: `list` sort Date descending, showColumns Type, Breaking.
  - Deprecations: `metric` filter Status equals `Announced`, unit "pending".
  - Public API: `chart` donut grouped by Stability; `list` filter Stability equals
    `Experimental`, showColumns Since.
- `links` overview, Deprecations, Decisions · `activity` · `savings`

## Don't

- Generate API reference pages from signatures — the docs generator does that; link it.
  A row says what the reference can't: when to use it, what it costs, what surprises.
- Transcribe the changelog verbatim. A release row carries the why and the migration.
- List internal modules as public API.
