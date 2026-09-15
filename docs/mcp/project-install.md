# Project Install

This is the fastest way to connect a project to Remnus: one command, one sign-in,
and the workspace is ready to use. No dashboard, no manual database setup. To have
your AI coding agent do it for you, see [Hand it to your agent](#hand-it-to-your-agent).

`remnus` is the open-source CLI for this project. The next section is the complete
account of what it talks to and writes.

It's a different starting point than [Getting Started](getting-started.md), which
assumes a workspace already exists and walks a human through connecting an editor to
it by hand. Project Install instead creates (or picks) the workspace *for* this
project and wires up your editor automatically — use whichever matches what you
already have; see [Two ways to connect](README.md#two-ways-to-connect) for the
difference.

## Hand it to your agent

From the project's root directory, give your coding agent this prompt:

```text
Set up Remnus in this project by following https://github.com/Ranork/remnus-app/blob/master/docs/mcp/project-install.md, then calibrate the workspace to this project.
```

Hand over the GitHub copy of this page rather than the wiki one. From there the agent
can open the [`cli/`](https://github.com/Ranork/remnus-app/tree/master/cli) source
that `npx remnus init` runs and the [calibration guide](calibrate.md) in the same
repository, so it reads the steps and the code they run together. The prompt works
in any language.

## What this does, in full

- **Network:** the Remnus server you point it at (`remnus.com` by default, or your
  own `--server` for self-hosting) for signing in, connecting the workspace, and
  every MCP tool call; `registry.npmjs.org`, read-only, from `npx remnus doctor`
  only, to compare the installed version against the latest one. That's the
  complete list of hosts involved.
- **Disk:** exactly the files in the table below, in this project directory,
  editing existing files in place rather than overwriting them — other MCP servers
  in `.mcp.json`, other hooks in `.claude/settings.json`, and your own
  `AGENTS.md`/`CLAUDE.md` content around a marked section all survive a re-run.
- **Logging:** every write an MCP agent makes — calibration included — is recorded
  with the tool name, timestamp, and outcome, visible immediately in the
  workspace's own UI and readable in full from the **AI Agents** panel or via
  `query_audit_log`.
- **Source:** `remnus` and the server it talks to are the same AGPL-3.0 repository,
  [github.com/Ranork/remnus-app](https://github.com/Ranork/remnus-app) — every line
  either one runs is in that history, under
  [`cli/`](https://github.com/Ranork/remnus-app/tree/master/cli) for this command.
- **Package:** [npmjs.com/package/remnus](https://www.npmjs.com/package/remnus) —
  every published version with its publish date, and the file list of what's in the
  tarball (no install scripts, no bundled binaries, no dependencies).

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

It's optional — the workspace works empty too. If you'd like it done: whoever just
ran `init` (or is picking up a project someone else connected, with
`.remnus/config.json` still saying `"calibrated": false`) can fetch that URL and
follow it. See [Calibrate](calibrate.md) for exactly what that step reads, writes,
and where it's logged.

## Step 3 — See it, verify it

```bash
npx remnus open      # open this project's workspace in its own signed-in window
npx remnus doctor    # check whether the connection is healthy
```

In Claude Code, a fresh session already does the `open` part on its own — the hook
`init` wrote fires on `startup` (not on resumes), so a human sees the workspace
without a separate step. The window opens already signed in, to this project's
workspace only — account settings, billing and your other workspaces stay behind a
normal login. `doctor` reports exactly which command fixes a broken
connection, and separately nudges you if a newer `remnus` has shipped since this
project was pinned. Every project connected this way gets its own MCP endpoint
(`/api/mcp/w/<workspace-id>`), so two projects on one machine never share a
connection or read each other's workspace, even against the same Remnus instance.

## Reference

Full command/flag reference and file-format details: the
[`cli` package README](https://github.com/Ranork/remnus-app/tree/master/cli) in the
Remnus repository (`npx remnus init | doctor | mcp`, all source AGPL-3.0).
