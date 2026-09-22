# remnus

Set up [Remnus](https://remnus.com) in a project: one command, one sign-in, one workspace.

```bash
npx remnus init
```

Your browser opens once. You sign in, pick (or create) a workspace for this project,
and the command writes everything the project needs. No token is ever shown to you or
pasted anywhere.

Full walkthrough (also the page to hand an AI agent and ask it to run this for you):
[remnus.com/wiki/project-install](https://remnus.com/wiki/project-install).

**Joining a project someone else connected?** You cloned a repository that already has
`.remnus/config.json` in it, but not the token — that file is personal and never
committed. Run `npx remnus join` instead: it writes only your own credentials and
changes nothing the team shares. If you are not a member of that workspace yet, it
sends its owner an access request. See
[remnus.com/wiki/project-join](https://remnus.com/wiki/project-join).

## What `init` writes

| File | Committed? | What it is |
| --- | --- | --- |
| `.mcp.json` | yes | How agents in this project reach Remnus. Holds no secret. |
| `.remnus/config.json` | yes | Which workspace this project belongs to. |
| `.remnus/credentials.json` | **no** | This project's token. Added to `.gitignore` automatically. |
| `.remnus/workspace-map.md` | **no** | Cached map of the workspace, so an agent starts knowing what is where. |
| `AGENTS.md` / `CLAUDE.md` | yes | A marked section telling agents how to use the workspace. |
| `.claude/settings.json` | yes | A `SessionStart` hook that opens the workspace on a fresh Claude Code session. Inert elsewhere. |

Existing files are edited, never replaced: other MCP servers in `.mcp.json`, other hooks
in `.claude/settings.json`, your own `.gitignore` rules, and everything you wrote around
the marked section all survive a re-run.

## Commands

```bash
npx remnus init      # connect this project to a workspace
npx remnus join      # get your own access to a project someone else connected
npx remnus open      # open this project's workspace in its own signed-in window
npx remnus sync      # refresh the local workspace map
npx remnus doctor    # check whether the connection still works
npx remnus mcp       # run the MCP server (.mcp.json calls this for you)
```

`init` on a project that is **already** connected joins it rather than reconnecting it:
re-pointing a committed `.remnus/config.json` at a different workspace would silently
fork a team's shared memory, so it has to be asked for explicitly with `--reconnect`.

`join` writes exactly one file, `.remnus/credentials.json`. It leaves `config.json`
(including its `calibrated` flag), the `AGENTS.md` section and `.claude/settings.json`
alone. The one thing it will create is a missing `remnus` entry in `.mcp.json`, since
without it a clone cannot reach Remnus at all — it never overwrites one that is there.

## The local workspace map

`.remnus/workspace-map.md` is a cached copy of the workspace digest — one line per page
and database with its id, row count, body size and last-updated date. It is there so an
agent's first turn already knows where things are: it can grep the file for the lines it
needs instead of pulling the tree over MCP and waiting for a round-trip.

It keeps itself current. `remnus mcp` — the bridge every agent session runs — rewrites it
when a session starts and after each successful write, on a request of its own that never
touches the protocol stream. `remnus sync` does it on demand; `remnus doctor` does it when
the connection checks out.

Its header says when it was written and the cursor it is verified up to, and the `AGENTS.md`
section tells agents the rule that follows from that: read the map, then `get_changes_since`
with the cursor before writing or when it looks stale — never re-crawl.

Git-ignored by default: it changes on every agent write and would otherwise sit in every
diff. `npx remnus sync --track` commits it instead (recorded in `config.json`, so the whole
team's CLI agrees), `--untrack` reverts.

## Options

| Option | Effect |
| --- | --- |
| `--reconnect` | Let `init` point an already-connected project at a different workspace. (`--new` is the same thing.) |
| `--oauth` | Store no token in the project; the MCP client runs its own browser sign-in. |
| `--http` | Write a direct HTTP endpoint into `.mcp.json` instead of this CLI. |
| `--server <url>` | Point at a self-hosted Remnus instance. |
| `--dir <path>` | Set up a directory other than the current one. |
| `--track` / `--untrack` | `sync`: commit the workspace map, or go back to ignoring it. |

`REMNUS_SERVER_URL` does the same job as `--server` if you would rather set it in the
environment.

## Two projects, two workspaces

Each project gets its own MCP endpoint (`/api/mcp/w/<workspace>`), so two projects on
one machine never share a connection or read each other's workspace — even though they
both talk to the same Remnus instance.

## Licence

AGPL-3.0-only
