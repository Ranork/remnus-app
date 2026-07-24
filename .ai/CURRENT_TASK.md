# Current task

## Status

Done

## Active agent

Claude

## Branch

master

## Base commit

ba36a77 (Working tree at task start; previous CURRENT_TASK.md entry was an unrelated, already-Done admin activation-funnel task)

## Goal

Add a "+" button next to the block drag handle in the page-content editor. Clicking it opens the same block-type picker the "/" slash command shows; the document is only touched once the user actually picks a type, which then inserts the new block below the hovered one as that type.

## Scope

Editor-only UI addition in `BlockDragHandle.tsx` (the hover-grip component). No new block types, no changes to the slash-command menu's own option list — reuses it as-is. Desktop/fine-pointer only (the touch "⋮" gutter has no room for a second icon, left untouched).

## Completed

- Added a `Plus` icon button in the block gutter, immediately left of the existing drag-handle grip (`!menuAnchor && !isCoarse` — same visibility guard as the grip, hidden on right-click and on coarse/touch pointers).
- First iteration inserted a block immediately and typed a literal `"/"` into it to trigger the real Suggestion popup — the user rejected this (closing without picking left a stray `"/"` character / empty block behind). Reworked per their instruction: clicking "+" now only **opens a popup**; nothing is inserted until an item is actually chosen.
  - `openAddMenu()` just sets `addMenuOpen = true` — no document change.
  - The popup renders the real `SlashCommandList` component directly (imported from `SlashCommandMenu.tsx`'s sibling module) with `SLASH_COMMANDS` + `buildChildCommands(workspaceId, parentId)` (workspaceId/parentId read live off the `slashCommand` extension's own options, same lookup the Suggestion plugin itself uses) — so the options, icons, i18n labels, and grouping are always identical to typing "/", with no duplicated list to drift out of sync.
  - `applyAddCommand(item)` runs only on pick: creates the target empty block (sibling `paragraph` via `insertContentAt` for regular top-level blocks; `splitListItem(node.type.name)` — the same command the list extension's own Enter binding uses — for `listItem`/`taskItem`, keeping the schema valid), then calls the chosen `item.command({ editor, range: {from, to: from} })` with a zero-length range at the new cursor position (its `deleteRange` is then a no-op), exactly mirroring what picking that item from a real "/" popup does.
  - Escape / outside click closes the popup via `addMenuOpen`'s own effect, leaving the document untouched.
  - Wired the popup's arrow-key/Enter navigation by forwarding `keydown` to `SlashCommandList`'s existing imperative `onKeyDown` ref (same keyboard behavior as the real "/" menu, since it's the same component).
  - Gated the mousemove/touch hover-tracking and blur-hide effects with `addMenuOpen` (in addition to the pre-existing `menuOpen` guard) so the hovered block's `handle` state — which the popup's position and target block are keyed off — doesn't get cleared out from under it while it's open.
  - Right-click context menu and the grip's own "⋮" action-menu toggle now also close `addMenuOpen`, and vice versa, so only one popup is ever open at a time.
- Added the `blockAddBelowTooltip` i18n key (button `title`) to all 8 locale files under the `Editor` namespace.

## Changed files

- `src/components/features/editor/BlockDragHandle.tsx`
- `messages/{en,tr,hi,es,fr,de,zh,ru}.json`
- `.ai/CURRENT_TASK.md`

## Decisions

- Render the actual `SlashCommandList` component (not a hand-rolled menu) inside a plain positioned `<div>` in the normal React tree — since it's already inside React (unlike the real "/" popup, which lives outside it via `ReactRenderer`/tippy), a plain ref is enough for keyboard nav; no tippy/portal machinery needed.
- Deferred ALL document mutation to the moment of picking — this was the explicit correction from the user after the first ("type / then let it sit in the doc") approach left visible artifacts when dismissed without choosing.
- Positioned both the "+" button and the popup using plain pixel offsets off `handle.left`/`handle.top` (no extra zoom division) since everything here lives inside the same zoom-transformed ancestor and scales together.
- Left the touch/coarse-pointer "⋮" menu untouched — the touch gutter doesn't have room for a second icon, and the request was specifically about the desktop hover handle.

## Verification

- `npm run lint -- src/components/features/editor/BlockDragHandle.tsx` passed.
- `npx tsc --noEmit` passed (whole project).
- All 8 `messages/*.json` files parse as valid JSON and carry the new `Editor.blockAddBelowTooltip` key.
- Manually verified in a running `npm run dev` session via the demo-mode workspace (Playwright):
  - Clicking "+" opens the popup with zero document change; pressing Escape closes it with zero document change (confirmed via accessibility-tree diff).
  - Arrow-key navigation + Enter selects an item (tested selecting Heading 3 by keyboard) and inserts exactly that block type, cursor placed inside it, no stray characters.
  - Mouse-click selection tested on both a regular block target and a `listItem` target (bullet list); both matched real "/" behavior exactly, including the pre-existing (not introduced by this change) quirk where toggling a list type on an already-list-item block unwraps it out of the list — identical to what typing "/bullet" there would do, since it's literally the same `SLASH_COMMANDS` command function.
- Test artifacts (screenshots, Playwright snapshot/console logs) and the temporary dev server used for this verification were cleaned up / stopped afterward.

## Remaining work

- None. Optional future follow-up (not requested): parity action in the touch "⋮" menu, if the user later wants it on mobile/tablet too.

## Known issues

- None.

## Next exact step

Task complete; no commit or push requested.
