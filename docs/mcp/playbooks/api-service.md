# Playbook: API / Backend Service

What an agent looks for and models when calibrating an API or backend service: endpoints, schema changes, dependencies, incidents.

For [Calibrate](../calibrate.md), Phase 2b. Index: [Playbooks](../playbooks.md).

**Evidence first.** This playbook is a list of things to look for, not a template: no
database, column or row gets created unless this project's code, docs or history shows it.

## Pick it when

A server framework and no UI layer of its own: `express`, `fastify`, `@nestjs/core`,
`hono`, `koa`; `fastapi`, `flask`, `djangorestframework`; `gin`, `echo`, `chi` in `go.mod`;
`axum`, `actix-web` in `Cargo.toml`; `spring-boot` in `pom.xml`/`build.gradle` — **plus** a
contract or data layer: `openapi.yaml`/`swagger.json`, `*.proto`, `schema.graphql`, a
migrations folder (`migrations/`, `prisma/migrations/`, `alembic/`).

## Concepts to model

**Endpoints** (`conceptType: endpoint`) — one row per operation, or per resource once
there are more than ~40 operations. `Method` multi_select (`GET`, `POST`, `PUT`, `PATCH`,
`DELETE`) · `Path` text · `Auth` select (`Public`, `API key`, `User token`, `Internal`) ·
`Status` status (`Planned` → `Live` → `Deprecated`, `Removed`) · `Version` select (`v1`,
`v2`…) · `Consumers` text.

**Schema changes** (`migration`) — from the migrations folder and its history.
`Applied` date · `Kind` select (`Additive`, `Breaking`, `Backfill`) · `Status` select
(`Planned`, `Applied`, `Rolled back`) · `Tables` multi_select.

**Dependencies** (`dependency`) — what the service cannot run without. `Kind` select
(`Database`, `Queue`, `Cache`, `Third-party API`, `Internal service`) · `Criticality` select
(`Hard`, `Soft`) · `Env vars` text (names only) · `Docs` url.

**Incidents & data-quality issues** (`incident`) — only with a postmortem, an incident
label or a fix commit that names one. `Severity` select (`SEV1`, `SEV2`, `SEV3`) ·
`Status` status (`Open` → `Mitigated` → `Resolved`) · `Detected` date · `Area` select.

## Example rows

- **Endpoints** — *Create payout* · Method `POST` · Path `/v1/payouts` · Auth `API key` ·
  Status `Live`. Body: "Idempotent on the `Idempotency-Key` header (24 h window). 409 when
  the balance is locked by a running settlement. Consumed by the dashboard and the
  partner SDK."
- **Schema changes** — *Split `amount` into minor units* · Kind `Breaking` · Status
  `Applied`. Body: "Floats lost cents on currency conversion. Added `amount_minor`,
  backfilled, dropped `amount` two releases later; readers had to deploy first."

## Status screen

`Service status`:
- `metric` Endpoints, filter Status equals `Live`, unit "live"
- `chart` donut, Endpoints grouped by Status
- `list` Endpoints, filter Status equals `Deprecated`, showColumns Version, Consumers
- `metric` Incidents, filter Status not_equals `Resolved`, unit "open"
- `list` Incidents, sort Detected descending, showColumns Severity, Status
- `links` overview, Dependencies, Decisions

## Don't

- Paste the OpenAPI, proto or GraphQL schema into a page. Link the file in `sources` and
  write what the contract can't say: who calls it, why it behaves that way.
- Make one row per route for a large generated API — group by resource.
- Write a secret or a real environment value. Env var names only.
