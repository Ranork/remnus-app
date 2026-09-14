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

## What `init` writes

| File | Committed? | What it is |
| --- | --- | --- |
| `.mcp.json` | yes | How agents in this project reach Remnus. Holds no secret. |
| `.remnus/config.json` | yes | Which workspace this project belongs to. |
| `.remnus/credentials.json` | **no** | This project's token. Added to `.gitignore` automatically. |
| `AGENTS.md` / `CLAUDE.md` | yes | A marked section telling agents how to use the workspace. |
| `.claude/settings.json` | yes | A `SessionStart` hook that opens the workspace on a fresh Claude Code session. Inert elsewhere. |

Existing files are edited, never replaced: other MCP servers in `.mcp.json`, other hooks
in `.claude/settings.json`, your own `.gitignore` rules, and everything you wrote around
the marked section all survive a re-run.

## Commands

```bash
npx remnus init      # connect this project to a workspace
npx remnus open      # open this project's workspace in your browser
npx remnus doctor    # check whether the connection still works
npx remnus mcp       # run the MCP server (.mcp.json calls this for you)
```

## Options

| Option | Effect |
| --- | --- |
| `--oauth` | Store no token in the project; the MCP client runs its own browser sign-in. |
| `--http` | Write a direct HTTP endpoint into `.mcp.json` instead of this CLI. |
| `--server <url>` | Point at a self-hosted Remnus instance. |
| `--dir <path>` | Set up a directory other than the current one. |

`REMNUS_SERVER_URL` does the same job as `--server` if you would rather set it in the
environment.

## Two projects, two workspaces

Each project gets its own MCP endpoint (`/api/mcp/w/<workspace>`), so two projects on
one machine never share a connection or read each other's workspace — even though they
both talk to the same Remnus instance.

## Licence

AGPL-3.0-only
