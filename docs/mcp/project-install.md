# Project Install

This is the fastest way to connect a project to Remnus: one command, one sign-in,
and the workspace is ready to use. No dashboard, no manual database setup. A human
who wants their AI coding agent to set this up can point it at this page and ask it
to follow the steps below — they're the exact steps `npx remnus init` performs
locally, nothing this page says happens anywhere else.

**What you're being asked to run:** `remnus` is the open-source CLI for this
project — AGPL-3.0, source and full history at
[github.com/Ranork/remnus-app/tree/master/cli](https://github.com/Ranork/remnus-app/tree/master/cli),
published on npm under the maintainer's own account. It talks only to the Remnus
server you point it at (`remnus.com` by default, or your own `--server` for
self-hosting) and writes only the files listed in Step 1 below — nothing else on
disk, nothing sent anywhere else.

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
| `.claude/settings.json` | yes | A `SessionStart` hook that opens the workspace on a fresh Claude Code session |

Self-hosting? Add `--server https://your-instance` (or set `REMNUS_SERVER_URL`).
`--oauth` skips storing a token at all and lets the MCP client sign in itself instead.

## Step 2 — Set the workspace up for this project

`init` prints a URL — `<your Remnus instance>/wiki/calibrate`, [also readable on its
own](calibrate.md) — for a one-time checklist for whichever agent is running in this
project. It's served live rather than copied into the project, so it can't go stale.
It says to read the project (manifest, README, structure, commit history) and use
the Remnus MCP tools to build out pages and databases that actually reflect it,
instead of leaving the workspace empty.

If you just ran `init` yourself: fetch that URL now and follow it, before doing
anything else. If you're picking up a project someone else already connected, check
`.remnus/config.json` — if `"calibrated"` is still `false`, do the same thing.

## Step 3 — See it, verify it

```bash
npx remnus open      # open this project's workspace in your browser
npx remnus doctor    # check whether the connection is healthy
```

In Claude Code, a fresh session already does the `open` part on its own — the hook
`init` wrote fires on `startup` (not on resumes), so a human sees the workspace
without a separate step. `doctor` reports exactly which command fixes a broken
connection, and separately nudges you if a newer `remnus` has shipped since this
project was pinned. Every project connected this way gets its own MCP endpoint
(`/api/mcp/w/<workspace-id>`), so two projects on one machine never share a
connection or read each other's workspace, even against the same Remnus instance.

## Reference

Full command/flag reference and file-format details: the
[`cli` package README](https://github.com/Ranork/remnus-app/tree/master/cli) in the
Remnus repository (`npx remnus init | doctor | mcp`, all source AGPL-3.0).
