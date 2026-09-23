# Join a Connected Project

Someone on your team already connected this project to a Remnus workspace and
committed the result. You cloned it, and the Remnus tools are not there. This page
is the fix, and it takes one command.

Nothing here sets a project up — that already happened. If you are the first person
and the project has no `.remnus/config.json` at all, you want
[Project Install](project-install.md) instead.

## Hand it to your agent

From the project's root directory, give your coding agent this prompt:

```text
Remnus is already set up in this project; follow https://github.com/Ranork/remnus-app/blob/master/docs/mcp/project-join.md to connect me to its workspace.
```

Hand over the GitHub copy of this page rather than the wiki one, so the agent can
open the [`cli/`](https://github.com/Ranork/remnus-app/tree/master/cli) source that
`npx remnus join` actually runs. The prompt works in any language.

## Why `init` is the wrong command here

`.remnus/config.json` is committed — it says which workspace this project belongs to.
`.remnus/credentials.json` is **not**: it holds a token, it is git-ignored, and it
belongs to one person on one machine. That is the whole gap. You have the address and
no key.

`npx remnus init` on a project that is already connected now hands over to `join`
automatically, precisely because the alternative is so costly: reconnecting rewrites
the committed `config.json` to point at a *different* workspace, and the rest of the
team keeps writing to the old one. Nobody notices until the shared memory has already
forked. Replacing a connection on purpose is still possible — `npx remnus init
--reconnect` — but you have to ask for it.

## Run it

```bash
npx remnus join
```

Your browser opens once. You sign in, and:

- **If you already have access to that workspace**, a token is minted for you, written
  to `.remnus/credentials.json`, and you are done. Nothing the team shares is touched.
- **If you do not**, nothing is minted. You can send the workspace's owner an access
  request, with an optional note saying who you are. They approve or decline it from
  the workspace's **Members** settings; when they approve, run `npx remnus join` again
  and you are in.

The command writes exactly one file, `.remnus/credentials.json`, and adds it to
`.gitignore` if it is not already there. It does not touch `config.json` (including
its `calibrated` flag), the marked section in `AGENTS.md`/`CLAUDE.md`, or
`.claude/settings.json`. The one thing it will create is a missing `remnus` entry in
`.mcp.json` — without it, a clone cannot reach Remnus at all — and it never
overwrites one that is already there. `git status` after a successful join should show
nothing but files that were already ignored.

## Then reload the MCP servers

Agents load MCP servers when a session starts, so a session that was already running
will not see the Remnus tools yet. In Claude Code: run `/mcp` and reconnect `remnus`,
or start a new session.

## Do not calibrate again

[Calibration](calibrate.md) is a one-time step that fills the workspace in to match
the project. If `.remnus/config.json` says `"calibrated": true`, it has already been
done — by a person or an agent who read this same project, and its **Calibration Log**
page says what was built and from which commit. Joining is not a reason to run it
again; a later run exists only to bring the workspace up to date once the project has
moved on, and even then it only extends what your teammates wrote.

Read the workspace instead. `.remnus/workspace-map.md` (written when your first agent
session starts) lists what the project's shared memory already contains; that is the
point of joining it.

## If something is off

```bash
npx remnus doctor
```

It reports which of the pieces is missing and which command fixes it. Two answers are
worth knowing in advance:

- *"This project is connected, but you have no token for it on this machine"* — the
  normal state of a fresh clone. Run `npx remnus join`.
- *"Remnus rejected the token"* — each join replaces your previous token for this
  project, so connecting from a second machine retires the first one. Run
  `npx remnus join` on whichever machine stopped working.

## What the owner sees

An access request shows the owner your name, your email, the project directory name
the command read off your disk, and your note. It consumes nothing until they approve;
approving adds you to the workspace as a **member**, which uses one seat of their plan.
A declined request can be sent again after a week.

Until you are a member, Remnus tells you nothing about the workspace — not its name,
not who is in it, not whether that id exists at all. The workspace id in
`.remnus/config.json` is in your repository, so it is not a secret and it is never
treated as one.
