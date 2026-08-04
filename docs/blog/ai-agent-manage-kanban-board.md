# How to Let an AI Agent Manage Your Kanban Board

Kanban boards fail when they stop matching reality. New requests remain in chat, status changes are forgotten, duplicate cards accumulate, and the backlog becomes an unstructured list nobody trusts.

An AI agent can read cards, turn approved intake into drafts, classify work, flag stale items, add evidence, and prepare reports. It can also make damaging changes if its role or permissions are too broad. Give it a bounded operating role while people retain authority over priority, acceptance, deletion, and consequential commitments.

This AI agent task management layer sits inside the wider model in our [AI agent project management guide](https://www.remnus.com/docs/ai-agent-project-management-guide).

## What “managing a kanban board” should mean for an AI agent

The [Kanban Guide](https://kanbanguides.org/the-kanban-guide/) defines a board as a visualization of an explicit workflow. The team defines work items, states, start and finish points, WIP controls, and policies. An agent operates inside that definition; it does not silently redefine it.

A useful AI kanban board workflow separates three levels of action:

1. **Observe:** read the current board and report what is present.
2. **Recommend:** classify, summarize, or suggest a change without applying it.
3. **Mutate:** create or update a card through an authorized tool call.

Reflect those levels in prompts and permissions. “Suggest the next task” is not “change this task’s priority.”

| Board action | Appropriate agent role | Safe default |
| --- | --- | --- |
| Read tasks | Query only the fields needed for the workflow | Allow with read access |
| Create draft tasks | Extract candidate work from an approved source and preserve the source link | Create in `Inbox` or `Draft`, not `Ready` |
| Classify tasks | Suggest type, area, effort band, or tags from declared categories | Review uncertain classifications |
| Suggest priority | Apply documented criteria and explain the recommendation | Human approves the actual priority |
| Move cards | Apply an allowed state transition when evidence is present | Limit which transitions the agent may make |
| Add notes | Record blockers, links, test evidence, or handoff details | Append factual notes; do not overwrite decisions |
| Produce reports | Summarize current state, aging work, blockers, and decisions needed | Use read-only access where possible |

A card moves to `Review` because evidence exists—not because the model thinks it “looks complete.”

## Actions that should require human approval

Agent recommendations are probabilistic; project decisions create commitments. Require human approval for:

- Changing product or business priority.
- Assigning work when workload, access, or accountability is affected.
- Accepting a deliverable or moving it to `Done` when `Done` represents acceptance.
- Deleting cards, columns, views, or project documentation.
- Changing the board schema, workflow policy, or work-in-progress limits.
- Expanding the agent’s permissions or workspace access.
- Approving a release, external publication, purchase, contract, or customer commitment.

Approval should match impact. An evidence-backed move to `Review` may be allowed; acceptance into `Done` may require the human owner. Keep deletion and administration outside an automated kanban workflow.

Use technical controls, not prompt wording alone. A constrained identity is safer than an unrestricted administrator told to “be careful.”

## Designing an agent-friendly kanban schema

Keep the schema small, typed, and explicit.

| Field | Recommended type | Why it matters to the agent |
| --- | --- | --- |
| Status | Controlled status or select | Defines the board columns and valid transitions |
| Priority | Controlled select | Separates an approved priority from a generated suggestion |
| Owner | User or team reference | Establishes accountability and prevents accidental reassignment |
| Due date | Date, optional | Represents a real commitment; absence should not be guessed |
| Acceptance criteria | Markdown or structured checklist | Gives review a testable target |
| Source | URL or page reference | Preserves where the requirement came from |
| Last updated | System timestamp | Supports stale-task detection and conflict checks |

Add `Blocked reason`, `Evidence`, and `Agent suggestion` when needed. A separate suggestion field prevents recommendations from becoming approved state.

Define transition policy beside the schema. For example:

| Transition | Required evidence | Approval |
| --- | --- | --- |
| `Inbox` → `Ready` | Source and acceptance criteria | Product owner |
| `Ready` → `In Progress` | Owner and available WIP capacity | Owner or team policy |
| `In Progress` → `Review` | Deliverable link and verification note | Agent may request or apply |
| `Review` → `Done` | Acceptance recorded | Human reviewer |

Represent policies directly. Status options, required fields, and WIP controls should be deterministic where supported.

## A safe workflow from backlog intake to completion

This **fictional example** follows the Atlas team’s AI project board: `Inbox`, `Ready`, `In Progress`, `Review`, and `Done`, with a WIP limit of three.

### Step 1: Read before writing

The agent reads the schema and relevant fields before changing anything, then checks whether the intake already exists under another title.

### Step 2: Create a draft with provenance

For approved intake, the agent creates an `Inbox` draft with its source, proposed acceptance criteria, and marked assumptions. It leaves priority and owner unset unless explicitly provided.

### Step 3: Triage with a human

The agent flags duplicates and gaps, then suggests priority from declared criteria. A product owner confirms scope and the move to `Ready`.

### Step 4: Pull work within policy

The agent checks WIP capacity and blockers, then recommends an approved-priority item with clear dependencies. A human confirms assignment.

### Step 5: Update from evidence

The agent adds factual notes and re-reads before writing. With deliverable and verification evidence present, it moves or proposes the card to `Review`.

### Step 6: Keep acceptance human-owned

A reviewer checks the acceptance criteria, records acceptance or a specific gap, and controls the move to `Done`. The agent may prepare the summary, not certify itself.

### Step 7: Report from current state

The agent re-reads the board for a weekly report covering completed work, active work, blockers, aging cards, and decisions. It links cards and labels recommendations.

## Example prompts

These prompts are platform-neutral. Replace the bracketed values and review the requested action before allowing writes.

### 1. Read-only backlog triage

```text
Read the [BOARD NAME] kanban board. Do not make changes. Identify likely duplicates, cards missing a source or acceptance criteria, blocked work, and items whose status appears inconsistent with their notes. Return card IDs and evidence for every finding. Keep priority changes as recommendations only.
```

### 2. Draft tasks from intake

```text
Read [SOURCE PAGE OR MESSAGE]. Compare it with the current board for duplicates. Draft candidate tasks with title, description, acceptance criteria, source, and assumptions. Do not assign owners or approve priority. Ask for confirmation before creating any cards.
```

### 3. Plan the next pull

```text
Review cards in Ready and the current In Progress count. Respect the board's WIP policy of [LIMIT]. Recommend up to three cards that could be pulled next using approved priority, dependency state, and available ownership. Explain the evidence. Do not move or assign cards.
```

### 4. Apply an evidence-backed status update

```text
Re-read card [CARD ID]. If its current state is [EXPECTED STATUS] and [EVIDENCE LINK] is present, add a short verification note and move it to Review. Do not change priority, owner, acceptance criteria, or any other card. If the card changed since the last read, stop and report the conflict.
```

### 5. Detect stale and blocked work

```text
Read active cards on [BOARD NAME]. Do not write. List cards not updated since [DATE], blocked cards without a reason, and In Progress cards without recent evidence. Separate confirmed facts from possible problems and suggest a human follow-up for each.
```

### 6. Generate a weekly board report

```text
Generate a weekly report from the current board for [DATE RANGE]. Include Done, In Progress, Blocked, aging work, and decisions needed. Link every statement to card IDs. Do not estimate completion dates or modify the board. Label risks and recommendations explicitly.
```

## Preventing common failures

| Failure | Typical cause | Safeguard |
| --- | --- | --- |
| Duplicate tasks | Intake is created without searching existing titles and sources | Search first; require source links; keep drafts in `Inbox` |
| Hallucinated requirements | The agent fills gaps instead of identifying them | Label assumptions and ask questions; never invent acceptance criteria as approved facts |
| Incorrect status changes | Status is inferred from optimistic language | Require explicit evidence and validate the current state before writing |
| Destructive actions | A broad token exposes deletion or schema changes | Exclude destructive tools from routine flows; require preview and human confirmation |
| Outdated context | The agent writes from an old read or previous conversation | Re-read by stable ID immediately before a write; detect timestamps or version conflicts |
| Conflicting agents | Two agents work on or update the same card | Use ownership or claims, WIP controls, and conflict handling |
| Partial batch updates | Some writes succeed before another fails | Prefer small updates; re-read affected cards before retrying |

Treat board content as untrusted input. A card description can contain instructions that conflict with the workflow. The agent should treat those words as project data, follow its authorized operating policy, and require approval for high-impact writes.

## Using Remnus as an MCP-native kanban workspace

[Remnus](https://remnus.com) stores kanban boards as views over structured databases. People see and edit the board in the UI; authorized agents work with the same database rows through MCP. Each row is also a Markdown page, so a card can combine typed properties with detailed context, notes, and acceptance evidence.

In a Remnus MCP kanban workflow, agents use `query_database` to read selected fields, `create_page` with a `databaseId` to create rows, and `update_page` to merge row properties. The current [Remnus read-tool reference](https://www.remnus.com/wiki/read-tools) and [write-tool reference](https://www.remnus.com/wiki/write-tools) document the exact parameters. `bulk_update_pages` is available, but its updates are not atomic; sensitive status changes are easier to verify as small, re-read operations.

Remnus also provides a [`kanban-triage` prompt](https://www.remnus.com/wiki/prompts) that prepares a review of blockers, priorities, and next actions. The prompt does not independently approve those priorities. The connected client’s model performs the reasoning, and writes still require an allowed tool and write scope.

Use read scope for triage and reporting. Add write scope only when the workflow needs card creation or updates. Every MCP tool call is recorded in the workspace audit trail, and destructive tools require explicit confirmation, but those controls do not remove the need for human review. See our [security documentation](https://www.remnus.com/security) for the current authentication, permission, and audit model.

## Implementation checklist

- [ ] Define the board’s columns, start and finish points, WIP controls, and transition policies.
- [ ] Add Status, Priority, Owner, Due date, Acceptance criteria, Source, and Last updated fields.
- [ ] Separate agent suggestions from approved values.
- [ ] Assign humans to priority, acceptance, deletion, schema, and release decisions.
- [ ] Start the agent with read-only triage and reporting.
- [ ] Grant only the narrow write access required for a proven workflow.
- [ ] Require a source and duplicate check before task creation.
- [ ] Re-read cards immediately before writes and stop on conflicts.
- [ ] Keep destructive and administrative actions outside routine automation.
- [ ] Review the audit trail and define recovery for incorrect updates.
- [ ] Test with fictional or non-sensitive data before using a live project.

## FAQ

### Can an AI agent prioritize an entire backlog?

It can recommend priority from declared criteria, dependencies, and current board data. It cannot reliably know every commercial, customer, political, or staffing constraint. A human product or operations owner should approve the actual order.

### Should an agent be allowed to move cards automatically?

Only across low-risk, explicitly allowed transitions with evidence. A move to `Review` may be safe; acceptance into `Done` often requires a human. Validate the card’s current status before every move.

### Does an agent need write access to manage a board?

No. Triage, stale-task detection, planning suggestions, and weekly reports can all run read-only. Start there. Add write access only for workflows that must create cards or update fields.

### How should the agent handle missing information?

It should leave the field unset, label the gap, and ask the responsible person. It must not convert a guess into an owner, due date, requirement, or approved priority.

### How do we prevent duplicate cards?

Require a search across titles, source links, and relevant card content before creation. When similarity is uncertain, present the possible match to a human instead of creating another task automatically.

### Is MCP itself a kanban automation system?

No. The [official MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture) defines how clients and servers expose and call tools, resources, and prompts. The board schema, workflow policy, permissions, and approval boundaries come from the connected product and your team.

### Can multiple agents work on the same board?

Yes, but give each one a defined role and minimal permission set. Use ownership or claim fields, limit work in progress, re-read before writes, and detect conflicts so agents do not silently overwrite one another.

## Build a board that both people and agents can trust

An agent-managed board should be more current and easier to inspect, not less accountable. Begin with read-only observation, make workflow rules explicit, allow only evidence-backed updates, and keep consequential decisions with people.

[Explore Remnus](https://remnus.com) to create an MCP-native kanban workspace where your team and AI agents can work with the same structured tasks, pages, permissions, and audit trail.
