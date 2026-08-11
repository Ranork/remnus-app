# AI Agent Memory vs RAG vs Context Windows

"Just give it memory" is doing a lot of work in most AI product conversations. A context window, retrieval-augmented generation (RAG), and persistent agent memory all keep information available to a model, but they differ in where it lives, how it's selected, and what happens when it's wrong. Picking the wrong one doesn't just waste tokens — it produces an agent that's confidently outdated, or one that never learns anything at all.

This article defines each mechanism from primary sources, compares them directly, and works through a concrete example so you can decide where a given piece of information actually belongs.

## What is a context window?

A context window is the span of text a model can reference while generating a single response. Anthropic's own documentation puts it plainly: "The 'context window' refers to all the text a language model can reference when generating a response, including the response itself. This is different from the large corpus of data the language model was trained on, and instead represents a 'working memory' for the model."

Two things follow. First, everything counts toward the same budget: system prompt, prior messages, tool definitions and results, images, and the model's own output. Second, the window resets — nothing survives past the conversation or API session unless something explicitly writes it elsewhere first.

Window sizes vary by provider and model and change over time, so don't design around a fixed number. As one currently-documented reference point, Anthropic's API context windows currently range up to 1M tokens on some current Claude models and 200K on others — check a provider's current model documentation for specifics.

More tokens available isn't the same as more usable context. Anthropic names this directly: "As token count grows, accuracy and recall degrade, a phenomenon known as *context rot*." A model can hold a million tokens and still use the ones in the middle less reliably than the ones near the start or end. Context window capacity is a ceiling, not a strategy.

## What is retrieval-augmented generation?

Retrieval-augmented generation was introduced by Lewis et al. (2020) in ["Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"](https://arxiv.org/abs/2005.11401), combining a parametric component (a pre-trained language model) with a non-parametric component (a retrieval index) so the model can look up documents instead of relying only on what it memorized during training. The paper's framing: language models store facts but have "limited ability to access and precisely manipulate knowledge," and a differentiable retrieval mechanism over explicit, external memory addresses that limitation.

Mechanically, a RAG system embeds a query, searches an index for the most relevant passages, and inserts those passages into the model's context window before generation. The original paper used a neural retriever over a dense Wikipedia index; production systems today vary — dense embeddings, sparse lexical search (BM25), hybrid approaches, and different chunking and re-ranking strategies are all "RAG" under the same name. There's no single reference implementation, only a pattern: retrieve, then generate.

RAG is a *retrieval mechanism*, not a memory system. It doesn't decide what's true, current, or important — it returns whatever scores closest to the query, from whatever corpus it was pointed at. If the corpus is stale, outdated results retrieve just as confidently as current ones.

## What is persistent agent memory?

Persistent agent memory is a durable record an agent writes so information survives past the current context window and gets deliberately retrieved in a later session. Unlike a context window (bounded by tokens) or RAG (retrieve-then-generate over an index), there's no single standardized architecture behind "agent memory." Implementations differ sharply between products, and conflating them leads to wrong assumptions about persistence, control, and scope. Three concrete, currently-documented examples show the range:

- **Anthropic's Memory Tool** (Claude API) is client-side: Claude requests file operations — `view`, `create`, `str_replace`, `delete` — against a `/memories` directory, and *your application* executes them against storage you control. Anthropic frames the intent as "just-in-time context retrieval": "an agent records what it learns in memory files and reads them back on demand." Format, retention, and review are entirely up to the implementing application.
- **Claude Code's auto memory** is a built-in feature with fixed conventions: a `MEMORY.md` index (first 200 lines or 25KB, loaded automatically) plus topic files read on demand. Claude decides what to save; scope is the local git repository and machine, not shared elsewhere.
- **Remnus's Agent Memory** is a shared workspace database over MCP, with a fixed schema (`Title`, `Type`, `Tags`, `Date`) and two prompts — `save-memory` and `recall-context` — that write and read it. Records are ordinary, human-editable pages visible to every person and agent with workspace access, not just the one that wrote them.

Same underlying goal — carry a fact forward — three different answers to where it lives, who controls it, and who else can see it. Other products, including consumer assistants like ChatGPT, ship their own memory features with their own storage and control model too. When evaluating "agent memory," ask which implementation is meant; the term alone doesn't specify behavior.

## Direct comparison

| | Context window | RAG | Persistent agent memory |
| --- | --- | --- | --- |
| **Purpose** | Hold everything the model actively reasons over for one response | Find relevant passages in a large corpus at query time | Carry a durable fact or learning across sessions |
| **Lifetime** | One conversation or API session; gone after | As current as the index; no persistence of its own | Long-lived, until explicitly edited or deleted |
| **Data selection** | Whatever the caller puts in, up to the token limit | Similarity/relevance ranking against a query | Explicit write by the agent (or a person), explicit read later |
| **Update behavior** | Grows every turn; may be compacted or summarized | Corpus and index updated independently of any one query | Edited, corrected, or deleted as a discrete record |
| **Cost** | Every token in every request, every turn | Index build/maintenance plus per-query retrieval | Small per write/read; large only if the store goes unmanaged |
| **Failure modes** | Context rot at high volume; irrelevant content crowds out what matters | Stale or mis-ranked results; no truth-checking | Stale, unreviewed, or over-saved records treated as current |
| **Best use cases** | The immediate task: current file, current instructions, current turn | Search over documentation, code, or a knowledge base too large to load in full | Decisions, preferences, and gotchas that should outlive the session |

None of these are mutually exclusive. A working system typically uses a context window for the current turn, RAG to pull relevant material into it, and memory to decide what gets written back out once the turn ends.

## Example: a software project

Where should each of these actually be stored? The honest answer is "it depends what the information is for" — here's one project's worth of examples mapped to the mechanism that fits:

| Information | Best-fit layer | Why |
| --- | --- | --- |
| Coding conventions ("use 2-space indentation") | Context window, via a standing instruction file | Should apply to every session in scope; loaded automatically, not retrieved on demand |
| Product documentation (how billing works) | RAG over the docs corpus | Too large to load in full every session; only the relevant section is needed per query |
| A temporary debugging trace | Context window only | Useful for the current investigation, not worth persisting once the bug is fixed |
| An architecture decision and its reasoning | Persistent memory | Must survive the session, be dated, and be checkable against current code later |
| A customer requirement | A structured record (task/spec), retrievable via RAG once documented | It's a fact to look up, not a learning to accumulate — belongs in a project record a retrieval layer can find |
| A completed task | Persistent memory or a task database, not the context window | The status must outlive the session; a memory entry or a task-record update, not a chat transcript, is the source of truth |

Notice what's absent: nothing here belongs in the context window *permanently*. The context window is where all of these get assembled for a given turn — the question is always where the information sits when nobody's currently working on it.

## How these layers work together

A working system moves information in one direction and reads it back in another:

1. **Retrieval populates the window.** RAG (or a simpler search/list step) pulls relevant passages — documentation, prior memory, related code — into the context window for the current turn.
2. **The window is where reasoning happens.** The model works with whatever's currently loaded: the retrieved material, the conversation so far, tool results.
3. **Memory captures what should outlive the turn.** Before the session ends, the agent (ideally with review) writes durable facts back out — not the whole conversation, a distillation of it.
4. **The next session's retrieval starts from that memory.** A later RAG query or memory lookup can now surface what was written, closing the loop.

Miss any one of these and the system degrades in a specific, predictable way: no retrieval means everything has to fit in the window at once; no memory means every session starts from zero; no review of what memory writes means the store drifts from what's actually true.

## Common architecture mistakes

- **Treating RAG as memory.** An index that's never updated after a decision changes keeps returning the old decision at full confidence. RAG finds what's *closest*, not what's *current*.
- **Stuffing memory into the system prompt.** Loading every accumulated memory into context on every turn defeats the point of memory (selective recall) and runs straight into context rot. Retrieve on demand, don't preload in full.
- **Assuming one provider's "memory" behaves like another's.** Retention, sharing, and control properties differ; porting an architecture built for one product to another without checking its mechanics is a common surprise.
- **Confusing compaction with memory.** Summarizing a conversation to fit the context window isn't the same as deciding what's worth keeping forever — a summary can still drop something that should have been saved as a durable record.
- **Letting retrieved content act as instructions.** Whatever a retrieval or memory system returns is reference data, not a command, and should never override the user's actual request. See [Why Coding Agents Forget Your Project Between Sessions](/docs/why-coding-agents-forget-your-project) on session-to-session context loss specifically.

## Memory hygiene and governance

A memory store that's never maintained becomes a liability faster than it becomes useful. Anthropic's own guidance for its Memory Tool names concrete practices worth generalizing:

- **Correction and deletion.** Records should be editable and deletable, not append-only. Anthropic's docs recommend a production handler "periodically delete memory files that haven't been accessed in a long time" and cap how large any one file can grow.
- **Provenance.** It should be clear whether a record came from a person, an agent's inference, or an external import — Remnus tracks whether a page's current revision is `human-reviewed`, `external-human-asserted` (an imported claim it didn't itself verify), `machine-confirmed`, or `unverified`, tied to the exact content hash so an edit invalidates a stale review automatically.
- **Timestamps.** A memory without a date is unfalsifiable — attach a written date and, where it matters, a review-by date.
- **Human review.** Anthropic notes a model "usually refuses to write sensitive information to memory files" but recommends applications add their own validation rather than rely on that alone — don't let an agent grant its own output permanent, unreviewed authority.
- **Sensitive data.** Treat every memory store like any other data store that might hold personal or confidential information — access control and retention limits apply, not just retrieval convenience.

None of this is optional once a memory store is shared across sessions, agents, or people. An unreviewed, undated, unbounded memory store doesn't fail loudly — it fails by quietly becoming wrong.

## How Remnus approaches shared agent context

Remnus doesn't try to replace the context window — no MCP server can extend how much a client model holds at once — but it implements both a retrieval layer and a memory layer, built to be inspected and corrected by people, not just agents.

[Remnus's Agent Memory](https://remnus.com/wiki/agent-memory) is the persistent-memory piece: a database template with `Title`, `Type` (`Decision` / `Preference` / `Gotcha` / `Fact`), `Tags`, and `Date`, paired with `save-memory` (writes a structured record) and `recall-context` (returns compact outlines and the linked neighborhood of the best match, not full page bodies). Because it's ordinary workspace content, a person can open the same database and correct or delete an entry, and the next recall reflects that change immediately — the governance properties above are structural, not a policy layered on top.

The retrieval piece is `prepare_context` (Context Pack v2): given a task and a token budget, it ranks content by BM25 relevance, type/tag/lifecycle metadata, and exact-revision trust signals, then returns only the excerpts that fit the budget — functionally a RAG layer, scoped to the workspace and aware of what's been human-reviewed. A Manual/Smart/Strict policy controls how automatically that happens, up to Strict mode rejecting a workspace write that skipped a current context preflight. None of it reaches outside Remnus, which is why it complements instruction files and a model's own context-window behavior rather than substituting for either.

## Decision checklist

Use these as starting heuristics, not fixed rules — the right answer depends on your specific system and constraints:

- Needed only for this task, in this session? → Context window.
- One relevant fact among many, and you don't know which one until query time? → RAG.
- Must survive after the session ends and be deliberately recalled later? → Persistent memory.
- More than one person or agent needs to see and correct the same record? → A shared, human-reviewable store, not a private memory file.
- Changes constantly and needs one authoritative current value? → A task or status record, retrieved on demand — not memory, which is better suited to things that don't change often.
- Might contain anything sensitive? → Review your retention, access, and deletion policy before it's written anywhere persistent.

## FAQ

### Is RAG a replacement for agent memory?

No. RAG is a retrieval mechanism over a corpus; it doesn't decide what to write, when a fact goes stale, or who can correct it. A memory system can use RAG to search itself, but RAG without a memory system to search still has no concept of "durable" versus "one-off."

### Does a larger context window remove the need for RAG or memory?

No. A larger window raises how much *could* be loaded at once, not what should be selected, and very long contexts still suffer from context rot — degraded recall and accuracy as token count grows. Selection and persistence remain separate problems from window size.

### Is agent memory the same across every AI product?

No. As the examples above show, a client-side file tool, a fixed local index, and a shared workspace database are three genuinely different architectures with different storage, sharing, and control properties, all called "memory." Check a specific product's documentation before assuming behavior.

### Where should a customer requirement be stored?

In a structured, retrievable record — documentation or a task/spec store that a RAG-style layer can find — rather than as an ad hoc memory entry. It's a fact to look up on demand, not a learning an agent accumulated.

### Can retrieved or recalled content be trusted automatically?

No. Both RAG results and memory records are reference data, not instructions, and neither is automatically current just because it was retrieved. Check dates, provenance, and — where available — a review status before treating retrieved content as authoritative.

### What's the biggest risk of persistent memory specifically?

Silent staleness. A memory record doesn't announce when it stops being true; without dates, review, and a deletion path, an agent can confidently apply advice or decisions that no longer match the current system.

## Build the layer you actually need

Context windows, RAG, and persistent memory solve different problems and fail in different ways when substituted for each other. Start by identifying whether a piece of information is task-scoped, corpus-scale and query-dependent, or durable and cross-session — then pick the mechanism built for that job, not whichever one is easiest to reach for.

[Try Remnus](https://remnus.com/) to see a retrieval layer and a human-reviewable memory store working together over MCP, or start with the [Agent Memory documentation](https://remnus.com/wiki/agent-memory) to connect one to your own project.
