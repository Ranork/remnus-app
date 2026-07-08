# How Many Tokens Does Your Agent Burn Reading Your Notes?

Every time an AI agent reads your workspace, it pays for it — in tokens, latency, and context window. A naive agent that re-reads everything on every turn burns its budget on plumbing before it does any thinking. This post measures what that actually costs on a real Remnus workspace, and shows how four MCP features — field projection, outline mode, the workspace digest, and delta sync — cut the bill by 80–90%.

All numbers below were measured against a real seeded Remnus workspace with a reproducible script (`src/scripts/bench-tokens.ts`). Token counts use the common `chars ÷ 4` approximation — treat them as ratios, not exact billing. The point isn't the absolute figures; it's how much of a read is avoidable.

## The shape tax: block-JSON vs markdown

Before we get to Remnus's own tools, the biggest hidden cost is the *shape* of the data an agent gets back. Most note apps expose their content as block JSON — every paragraph wrapped in object metadata: a block id, parent id, created/edited timestamps, author ids, an annotations object, a `rich_text` array. The words you wrote are a tiny fraction of the payload.

Here is a single sentence, encoded two ways:

| Encoding | Size | ~Tokens |
|---|---|---|
| Remnus markdown | 124 chars | ~31 |
| Representative Notion-style block-JSON | 925 chars | ~231 |

That's **7.5× more tokens** to move the same sentence. (The block-JSON above is a representative encoding of one paragraph block as a blocks-style API returns it — ids, timestamps, author, annotations — not a capture of any private workspace. Reproduce it in the script.) Remnus stores and serves plain markdown, so the agent reads roughly what you wrote and nothing else. This multiplier compounds on every page, so it's the foundation everything else builds on.

## Read only the columns you need

When an agent queries a database, it usually needs two or three columns — a status, a priority — not every property on every row. `query_database` takes a `fields` projection that drops unrequested columns and row bodies, and trims the returned schema to match.

> **Update (2026-07-08):** row markdown bodies are now **excluded by default** — a plain `query_database` call no longer carries them. The "full query" figure below is what you pay only when you explicitly opt in with `fields: [..., "content"]`; the default call already costs a fraction of it. The cheap path is no longer opt-in — the expensive one is.

On a 16-row Sprint Board:

| Query | Size | ~Tokens | |
|---|---|---|---|
| Full query | 14,825 chars | ~3,706 | |
| `fields: ["Status", "Priority"]` | 2,528 chars | ~632 | **−83%** |

The agent that only needs to see what's blocked reads a fifth of the data.

## Skim before you read

Long pages are the other big spender. `get_page` has an `outline` mode that collapses a page to its headings plus the first line of each section, and reports `fullContentChars` so the agent can decide whether the full body is worth fetching.

On a ~2,600-character build log page:

| Read | Size | ~Tokens | |
|---|---|---|---|
| Full body | 2,621 chars | ~655 | |
| Outline | 530 chars | ~133 | **−80%** |

The agent skims first, then fetches the full body only for the pages the outline shows are relevant — instead of paying full price to discover a page wasn't.

## Orient in one line per item

Before an agent can do anything useful it has to know what's in the workspace. The naive move is to list everything and read each page. The `remnus://workspace/{id}/digest` resource returns a compact one-line-per-item map — titles, types, ids, row counts, last-updated — in a single read.

On a small 4-item workspace:

| Orientation | Size | ~Tokens | |
|---|---|---|---|
| Read every page body | 5,516 chars | ~1,379 | |
| Workspace digest | 543 chars | ~136 | **−90%** |

The agent gets the whole map for the price of a single small page, then spends its reads only where they matter.

## Sync only what changed

A recurring agent — a daily standup summary, a memory refresh — doesn't need to re-crawl the workspace every run. `get_changes_since` returns a compact, chronological feed of only what was created, updated, or deleted since a timestamp or cursor. The first call bootstraps; every call after that returns just the delta. For an agent that runs every hour against a workspace that changed twice, that's two entries instead of the entire tree.

## Putting it together

Consider an agent that starts a session, orients itself, checks the board, and reads one relevant page. Naively — read every body to orient, full board query, full page:

- Orient by reading bodies: ~1,379 tokens
- Full board query: ~3,706 tokens
- Full page read: ~655 tokens
- **Total: ~5,740 tokens**

The same session using the token-efficient path — digest, projected query, outline-then-skip:

- Digest: ~136 tokens
- Projected board query: ~632 tokens
- Page outline: ~133 tokens
- **Total: ~901 tokens**

Same work, **~84% fewer tokens** — and that's before delta sync removes the re-orientation cost on every subsequent turn. The savings are real because Remnus isn't running an LLM to compress anything; it's exposing structure the workspace already has (the tree, the schemas, the [link graph](/wiki/read-tools#get_related_pages)) as reads the agent can scope down.

## The honest caveats

- Figures are from one specific seeded workspace; your ratios will vary with content, but the *shape* of the savings holds.
- Token counts are `chars ÷ 4`, a standard approximation — not a billing statement.
- The Notion comparison is a representative block-JSON encoding of one paragraph, not a capture of a live Notion response. The structural cost (per-block ids, timestamps, annotations) is real; the exact multiple depends on the content.

## Try it

The token-efficient reads are all available to any connected agent — no flags to turn on beyond passing `fields`, `mode: "outline"`, or reading the digest. The full best-practice guide is in [Token-Efficient Usage](/wiki/token-efficient-usage), and the tool reference is in [Read Tools](/wiki/read-tools). Connect an agent from the **AI Agents** panel in your workspace and watch the numbers in the usage meter.
