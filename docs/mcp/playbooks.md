# Playbooks

What the agent that sets up your Remnus workspace builds for a web app, an API, a game, a data project or a library.

[Calibration](calibrate.md) is deliberately general: it gives an agent a way of thinking
that fits any project. But a game and a payments API do not need the same workspace. A
playbook adds what one kind of project actually tracks — the databases and columns, what
a well-filled row looks like, and the status screen that fits — so the agent starts from
what that field already knows, not from a blank page.

Playbooks are hints, never templates. Every one of them says the same thing first:
nothing gets built unless your project's code, docs or history shows it. A game with no
enemy data gets no Enemies database, whatever the playbook lists.

| Playbook | Picked when the project has | What it models |
| --- | --- | --- |
| [Web App / SaaS](playbooks/web-app.md) | A web framework plus product signals: auth, billing, flags, user routes | Features, experiments and flags, customer feedback, plans |
| [API / Backend Service](playbooks/api-service.md) | A server framework plus a contract or migrations, no UI of its own | Endpoints, schema changes, dependencies, incidents |
| [Game](playbooks/game.md) | An engine project file (Godot, Unity, Unreal, Bevy, Phaser…), a mod or server plugin, or game data files | Quests, enemies, zones, items, balance parameters, playtest findings |
| [Data / ML](playbooks/data-ml.md) | Notebooks, ML libraries, pipeline or experiment-tracking config | Datasets, experiments, models, data-quality issues |
| [Library / SDK](playbooks/library-sdk.md) | A package published for other code to import, with no app of its own | Public API, releases, deprecations, supported runtimes |

## How an agent picks

- **After reading the project, before modelling it** (Calibrate, end of Phase 1). Compare
  each playbook's *Pick it when* signals with the manifest, folders and files actually
  there.
- **At most two.** A monorepo or a mixed project — an API plus its SDK, a game plus its
  backend — combines the parts of each playbook that match, under one section per part.
- **None fits? Read none.** Picking the closest playbook is the wrong answer: it brings
  back exactly the template-filling calibration exists to prevent. The general guide is
  complete on its own.

## Reading a playbook

Every playbook has the same six parts: when to pick it, the concepts to model (each with
its columns and the `conceptType` to label it with), example rows with bodies, a status
screen built from the [dashboard](dashboards.md) block catalog, what not to do in that
field, and the evidence rule above.

Columns are written `Name` type — the types are the ones `create_database` accepts. A
status column lists its options as `to do` → `in progress` → `done`, the three groups a
status option can belong to.
