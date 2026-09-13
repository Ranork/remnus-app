# Project Install

> **If you are an AI coding agent reading this page:** the human who gave you this
> link wants Remnus connected to the project you are working in right now. Follow
> the steps below directly — run the commands, don't just describe them.

This is the fastest way to connect a project to Remnus: one command, one sign-in,
and the workspace is ready to use. No dashboard, no manual database setup.

It's a different starting point than [Getting Started](getting-started.md), which
assumes a workspace already exists and walks a human through connecting an editor to
it by hand. Project Install instead creates (or picks) the workspace *for* this
project and wires up your editor automatically — use whichever matches what you
already have; see [Two ways to connect](README.md#two-ways-to-connect) for the
difference.

## Step 1 — Run the CLI

In the project's root directory:

```bash
npx remnus init
```

This opens a browser once for sign-in and a workspace picker (create a new one, or
connect an existing one), then writes, without overwriting anything already there:

| File | Committed? | What it is |
| --- | --- | --- |
| `.mcp.json` | yes | How agents in this project reach Remnus |
| `.remnus/config.json` | yes | Which workspace this project belongs to |
| `.remnus/credentials.json` | no | This project's token — auto-added to `.gitignore` |
| `AGENTS.md` / `CLAUDE.md` | yes | Tells any agent how to use the workspace |

Self-hosting? Add `--server https://your-instance` (or set `REMNUS_SERVER_URL`).
`--oauth` skips storing a token at all and lets the MCP client sign in itself instead.

## Step 2 — Set the workspace up for this project

`init` also writes `.remnus/calibrate.md` — a one-time checklist for whichever agent
is running in this project. It says to read the project (manifest, README, structure,
commit history) and use the Remnus MCP tools to build out pages and databases that
actually reflect it, instead of leaving the workspace empty.

If you just ran `init` yourself: stop here and follow `.remnus/calibrate.md` now,
before doing anything else. If you're picking up a project someone else already
connected, check `.remnus/config.json` — if `"calibrated"` is still `false`, do the
same thing.

## Step 3 — Verify

```bash
npx remnus doctor
```

Reports whether the connection is healthy and, if not, exactly which command fixes
it. Every project connected this way gets its own MCP endpoint
(`/api/mcp/w/<workspace-id>`), so two projects on one machine never share a
connection or read each other's workspace, even against the same Remnus instance.

## Reference

Full command/flag reference and file-format details: the
[`cli` package README](https://github.com/Ranork/remnus-app/tree/master/cli) in the
Remnus repository (`npx remnus init | doctor | mcp`, all source AGPL-3.0).
