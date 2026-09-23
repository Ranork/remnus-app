# Playbook: Game

What an agent looks for and models when calibrating a game or game mod: quests, enemies, zones, items, balance parameters, playtest findings.

For [Calibrate](../calibrate.md), Phase 2b. Index: [Playbooks](../playbooks.md).

**Evidence first.** This playbook is a list of things to look for, not a template: no
database, column or row gets created unless this project's code, docs or history shows it.

## Pick it when

An engine project file: `project.godot` / `*.tscn` (Godot); `Assets/` with
`ProjectSettings/ProjectVersion.txt` and `*.unity` scenes (Unity); `*.uproject`
(Unreal); `bevy` in `Cargo.toml`; `phaser`, `pixi.js` or `kaboom` in `package.json`;
`main.lua` + `conf.lua` (LÖVE). A mod or server plugin for an existing game counts too:
`plugin.yml` / `paper-plugin.yml`, `fabric.mod.json`, `mods.toml`, a mod `manifest.json`
beside `Server/` and `Common/` asset folders. Stronger still: game data as files —
`*.tres`, ScriptableObject `*.asset`, JSON/CSV tables of enemies, items, quests or levels.

## Concepts to model

Model what a designer tunes, read from the data files and design docs. For a mod, model
the content it adds, not the base game's.

**Quests** (`conceptType: quest`) — only when quest definitions are readable. `Questline`
select · `Objective` select (the objective types the code supports) · `Reward` text ·
`Status` status (`Draft` → `Live`, `Retired`).

**Enemies** (`conceptType: enemy`) — `Zone` select · `Role` select (`Melee`, `Ranged`,
`Support`, `Boss`) · `HP` number · `Damage` number · `Status` status (`Concept` →
`In game` → `Tuned`, `Cut`).

**Zones / levels** (`zone`) — `Order` number · `Theme` select · `New mechanic` text ·
`Target minutes` number · `Status` status (`Blockout` → `Playable` → `Polished`, `Cut`).

**Items** (`item`) — `Type` select (`Weapon`, `Consumable`, `Key`, `Cosmetic`) · `Rarity`
select · `Value` number · `Found in` select (the zones).

**Balance parameters** (`tuning`) — only values that live in data or config, not magic
numbers buried in code. `System` select (`Combat`, `Economy`, `Progression`) · `Value`
number · `Unit` text · `Changed` date.

**Playtest findings** (`playtest`) — only when notes exist. `Session` date · `Area`
select · `Severity` select (`Blocker`, `Friction`, `Polish`) · `Status` status (`Open` →
`Addressed`).

## Example rows

- **Enemies** — *Bog Lurker* · Zone `Mire` · Role `Melee` · HP 40 · Damage 12 · Status
  `Tuned`. Body: "Ambushes from water tiles, so it teaches the dodge before the first
  boss. HP cut from 60 in the 0.4 playtest — players stalled here (`enemies/bog_lurker.tres`)."
- **Balance parameters** — *Stamina regen per second* · System `Combat` · Value 18 ·
  Unit `/s` · Changed 2026-05-02. Body: "Raised from 12 so ranged builds can kite; watch
  melee dominance in Zone 3."

## Status screen

`Build status`:
- `metric` Enemies, filter Status equals `In game`
- `chart` bar, Enemies grouped by Zone
- `chart` donut, Zones grouped by Status
- `list` Balance parameters, sort Changed descending, showColumns System, Value
- `list` Playtest findings, filter Status equals `Open`, showColumns Severity, Area
- `links` overview, Zones, Decisions

## Don't

- Import the asset list — every sprite, sound and prefab. Assets are files; model what
  someone tunes or decides.
- Mirror the scene or node hierarchy as pages.
- Invent lore, stats or names that no data file or design doc contains.
