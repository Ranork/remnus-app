import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases, pages, workspaceMembers, agentTokens, agentActivity } from '@/db/schema';

export async function createSeedWorkspace(userId: string, userName?: string | null) {
  const workspaceName = userName ? `${userName} Workspace` : 'Personal Workspace';
  // New (real) users get the sample Paint-clone workspace WITHOUT a pre-seeded
  // agent token or audit-log history — a brand-new user hasn't connected any
  // agent yet, so a planted "Claude AI Agent" token + activity feed in the AI
  // Agents panel would be misleading (and would muddy the onboarding funnel).
  await createRichWorkspaceData(userId, workspaceName, { includeAgent: false });
}

// ── Demo seed data ─────────────────────────────────────────────────────────

const START_HERE_CONTENT = `### Hey everyone!

To show you how **Remnus helps** us stay on top of a project while building with AI agents, I'm building a basic *clone of Microsoft Paint as an example project*.

Everything you see here was put together by *Claude Code* and *Remnus* working side by side!

<div data-yt-id="OVi9pjY_p84"></div>

**Watch the video to see how this workspace was created!**

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Every row with an agent badge in the Sprint Board was written by a real AI agent over MCP. Open the AI Agents panel (bottom-left) to see the live activity log."></div>

### What the AI agent actually did

Here's a trace of the real session that built this workspace, pulled straight from Remnus's agent audit log:

| When | Action | What happened |
|------|--------|---------------|
| Connected | \`list_workspace\` | Agent scanned the workspace to orient itself |
| Planning | \`create_page\` | Drafted the **Product Spec** for the Paint clone |
| Setup | \`create_database\` | Built the **Sprint Board** from the spec |
| Backlog | \`create_page\` ×16 | Generated every task with its own acceptance criteria |
| Building | \`update_page\` | Marked *scaffold*, *brush* & *eraser* tasks **Done** as it shipped them |
| Reviewing | \`query_database\` | Re-read the board to pick the next task |
| In flight | \`update_page\` | Moved *line tool* to **In Progress** |

Want the full story in writing? Open the page below 👇

{{HOW_BUILT_CB}}
`;

const HOW_THIS_WAS_BUILT_CONTENT = `This workspace wasn't filled in by hand. An AI agent (**Claude Code**) connected to Remnus over **MCP** and built the whole thing: the spec, the task board, and the progress tracking, while a human watched it all happen in real time.

This page is the written companion to the video on **Start Here**: same story, just readable at your own pace.

## The workflow

1. **Connect:** The agent authenticated to this workspace with an MCP token and called \`list_workspace\` to see what was already here.
2. **Plan:** It wrote a **Product Spec** for a browser-based Paint clone (you can open it in the sidebar).
3. **Break it down:** From that spec it created the **Sprint Board** database and generated **16 tasks**, each with its own acceptance criteria and notes.
4. **Build and track:** As it implemented features, it moved tasks across the board (\`Backlog → In Progress → Done\`) and wrote its actual output back into each task page.
5. **Stay in sync:** A human can jump in at any point, edit anything, and the agent picks up the new state on its next query. No copy-paste, no context loss.

## How to read the signals

Remnus makes the agent's work **visible and auditable**. This is the part that doesn't show up in other tools:

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="The agent badge on a row means an AI agent last edited it. Hover it to see which token made the change and when."></div>

- **The ⚡ agent badge:** Any Sprint Board row an agent touched is stamped. You always know what was human-written and what was machine-written.
- **The AI Agents panel:** Click **AI Agents** at the bottom-left of the sidebar. You'll see every token, its scope, and a live log of recent tool calls (\`create_page\`, \`update_page\`, \`query_database\`…).

## Try it yourself

You can point your own AI agent at your own workspace in under a minute:

1. Open **Workspace Settings → Tokens** and create an MCP token (read or write scope).
2. Add Remnus as an MCP server in your client (Cursor, VS Code, or Claude). The endpoint and auth header are shown right after you create the token, and there are one-click install buttons too.
3. Ask your agent to plan a project, fill a database, or summarize a page. Every action it takes shows up in the audit log, stamped and reversible.

<div data-callout-icon="🔒" data-callout-color="green" data-callout-text="You stay in control: tokens are scoped, every write is logged, and you can revoke access at any time."></div>

That's the whole idea behind Remnus. Your AI agents get a real workspace to work in, and you keep full visibility over everything they do.
`;

const PRODUCT_SPEC_CONTENT = `# Product Spec: Paint Clone

A minimal, browser-based paint application. No dependencies, no accounts, no install needed.

## MVP Features

### Canvas & Drawing

- Freehand brush / pencil tool
- Adjustable brush size
- Eraser tool
- Fill bucket (flood fill)
- Clear canvas button

### Color

- Color picker (native \`<input type="color">\`)
- Palette of preset colors
- Current color preview swatch

### Shapes

- Line tool
- Rectangle tool (outline + filled)
- Circle / ellipse tool (outline + filled)

### File

- Save canvas as PNG (download)
- Load / open an image file onto the canvas

### UI

- Toolbar with tool icons
- Keyboard shortcuts for common tools (B = brush, E = eraser, F = fill, etc.)
- Undo (single-level or multi-step via history stack)

## Out of Scope (v1)

- Layers
- Text tool
- Cloud save
- Collaboration

`;

// ── Sprint Board task content strings ─────────────────────────────────────

const TASK_SCAFFOLD = `# Set up project scaffold

Create the base HTML/CSS/JS structure for the paint clone. No frameworks or build tools, plain files only.

## Tasks
- [x] Create \`index.html\` with \`<canvas>\` element and toolbar placeholder
- [x] Create \`style.css\` (reset, layout for sidebar + canvas area, basic theming)
- [x] Create \`main.js\` (entry point, canvas context init)
- [x] Verify canvas fills available viewport space and resizes correctly

## Acceptance Criteria
- Opening \`index.html\` in a browser shows a blank canvas and an empty toolbar ✅
- No console errors on load ✅

## Output

### Files Created
- \`index.html\`: shell with \`<aside id="toolbar">\` + \`<canvas id="canvas">\` inside \`<main id="canvas-area">\`
- \`style.css\`: CSS reset, flex layout (sidebar 56px + canvas area fills remainder), white canvas with dark chrome surround
- \`main.js\`: canvas context init, \`resizeCanvas()\` that fills the available area and preserves the drawing across window resizes via \`getImageData\`/\`putImageData\`

### Notes
- Canvas is sized to the available area minus 32px padding on each axis, recomputed on every \`window.resize\`
- White background is painted on every resize so the saved PNG will never be transparent
- Toolbar is a vertical \`<aside>\` ready to receive injected tool buttons from subsequent tasks
`;

const TASK_BRUSH = `# Implement freehand brush / pencil tool

Allow the user to draw freehand strokes on the canvas using mouse or touch.

## Tasks
- [x] Track \`mousedown\`, \`mousemove\`, \`mouseup\` events on the canvas
- [x] Use \`ctx.beginPath()\` / \`ctx.lineTo()\` / \`ctx.stroke()\` to draw smooth paths
- [x] Apply current color and brush size to strokes
- [x] Prevent drawing when mouse button is not held

## Acceptance Criteria
- Clicking and dragging draws a continuous stroke ✅
- Stroke color and size reflect the currently selected values ✅
- Releasing the mouse stops drawing ✅

## Output

### Changes to \`main.js\`
- Added \`state\` object tracking \`tool\`, \`color\`, \`size\`, \`isDrawing\`, \`lastX\`, \`lastY\`
- \`getPos(e)\`: normalises mouse and touch coordinates relative to canvas bounds
- \`applyBrushStyle()\`: sets \`strokeStyle\`, \`lineWidth\`, \`lineCap\`, \`lineJoin\`, \`globalCompositeOperation\` before each stroke
- \`onPointerDown\`: records start position, draws a dot for single clicks
- \`onPointerMove\`: draws a line segment from last position to current on each frame
- \`onPointerUp\` / \`mouseleave\`: stops drawing
- Touch events wired alongside mouse events (\`touchstart\`, \`touchmove\`, \`touchend\`) with \`passive: false\` to allow \`preventDefault\`
`;

const TASK_ERASER = `# Implement eraser tool

Allow the user to erase portions of the canvas by drawing with the background color.

## Tasks
- [x] Add eraser tool to the toolbar
- [x] When eraser is active, set \`ctx.globalCompositeOperation = 'destination-out'\`
- [x] Respect current brush size for eraser width
- [x] Restore composite operation when switching back to brush

## Acceptance Criteria
- Eraser removes drawn content on drag ✅
- Eraser size is controlled by the brush size slider ✅
- Switching tools restores normal drawing behavior ✅

## Output

### Changes to \`main.js\`
- \`applyBrushStyle()\` now branches on \`state.tool === 'eraser'\`: sets \`globalCompositeOperation = 'destination-out'\` and uses opaque black stroke (erases alpha channel pixels)
- \`onPointerDown\` dot-paint also applies \`destination-out\` when erasing, then resets composite operation after the fill
- Eraser shares \`state.size\` with the brush, no separate size needed
- Switching to any non-eraser tool automatically restores \`source-over\` on the next stroke via \`applyBrushStyle()\`
`;

const TASK_BRUSH_SIZE = `# Implement adjustable brush size

Provide a slider or input that controls the stroke/eraser width.

## Tasks
- [ ] Add \`<input type="range">\` to the toolbar (min 1, max 64)
- [ ] Display the current size value next to the slider
- [ ] Apply selected size to \`ctx.lineWidth\` before each stroke
- [ ] Default size: 4px

## Acceptance Criteria
- Moving the slider changes the brush width immediately
- Both brush and eraser tools respect the current size value
`;

const TASK_FILL = `# Implement flood fill (bucket tool)

Fill a contiguous region of the canvas with the current color on click.

## Tasks
- [ ] Read pixel data with \`ctx.getImageData()\`
- [ ] Implement iterative BFS/DFS flood fill algorithm starting from the clicked pixel
- [ ] Write filled pixels back with \`ctx.putImageData()\`
- [ ] Add tolerance threshold (e.g. ±15) to handle anti-aliased edges

## Acceptance Criteria
- Clicking inside a closed region fills it with the current color
- Fill does not bleed across hard edges
- Performance is acceptable for typical canvas sizes (≤1920×1080)
`;

const TASK_CLEAR = `# Implement clear canvas button

Wipe the entire canvas back to a blank white state.

## Tasks
- [ ] Add "Clear" button to the toolbar
- [ ] On click, call \`ctx.clearRect(0, 0, canvas.width, canvas.height)\` then fill white
- [ ] Push a history snapshot before clearing so it can be undone

## Acceptance Criteria
- Clicking Clear removes all drawn content
- The action is undoable via Undo
`;

const TASK_COLOR_PICKER = `# Implement color picker

Let the user choose any color for drawing using the native browser color input.

## Tasks
- [ ] Add \`<input type="color">\` to the toolbar
- [ ] Store the selected color in a global \`currentColor\` state variable
- [ ] Update \`ctx.strokeStyle\` and \`ctx.fillStyle\` on every color change event
- [ ] Default color: \`#000000\`

## Acceptance Criteria
- Opening the color picker shows the OS color chooser
- Selecting a color immediately affects subsequent strokes and fills
`;

const TASK_PALETTE = `# Implement preset color palette

Show a row of swatchable preset colors for quick selection.

## Tasks
- [ ] Define an array of ~16 classic paint colors (black, white, red, green, blue, yellow, etc.)
- [ ] Render each as a small clickable \`<div>\` swatch in the toolbar
- [ ] On click, set \`currentColor\` and sync the color picker input value
- [ ] Highlight the active swatch with a border/ring

## Acceptance Criteria
- Clicking a swatch immediately switches the active color
- The color picker input reflects the chosen swatch color
- Active swatch is visually indicated
`;

const TASK_LINE = `# Implement line tool

Allow the user to draw a straight line between two points.

## Tasks
- [ ] On \`mousedown\`, record the start point and save a canvas snapshot
- [ ] On \`mousemove\`, restore the snapshot then draw a preview line to the cursor
- [ ] On \`mouseup\`, commit the final line to the canvas
- [ ] Hold Shift to constrain to 45° increments

## Acceptance Criteria
- Dragging draws a live-preview straight line
- Releasing the mouse commits the line permanently
- Shift constrains the angle
`;

const TASK_RECT = `# Implement rectangle tool

Draw outline or filled rectangles by click-and-drag.

## Tasks
- [ ] On \`mousedown\`, record origin and snapshot canvas
- [ ] On \`mousemove\`, restore snapshot and draw preview rectangle
- [ ] On \`mouseup\`, commit the rectangle
- [ ] Toggle between outline (\`ctx.strokeRect\`) and filled (\`ctx.fillRect\`) via a toolbar option
- [ ] Hold Shift to constrain to a square

## Acceptance Criteria
- Dragging draws a live rectangle preview
- Outline / filled mode toggle works
- Shift constrains to square
`;

const TASK_ELLIPSE = `# Implement circle / ellipse tool

Draw outline or filled ellipses by click-and-drag.

## Tasks
- [ ] On \`mousedown\`, record origin and snapshot canvas
- [ ] On \`mousemove\`, restore snapshot and draw preview ellipse using \`ctx.ellipse()\`
- [ ] On \`mouseup\`, commit the ellipse
- [ ] Reuse the outline/filled toggle from the rectangle tool
- [ ] Hold Shift to constrain to a perfect circle

## Acceptance Criteria
- Dragging draws a live ellipse preview
- Outline / filled mode toggle works
- Shift constrains to circle
`;

const TASK_SAVE = `# Implement save as PNG

Let the user download the current canvas as a PNG file.

## Tasks
- [ ] Add a "Save" button to the toolbar
- [ ] On click, call \`canvas.toDataURL('image/png')\`
- [ ] Programmatically trigger a download via a temporary \`<a download>\` element
- [ ] Default filename: \`painting.png\`

## Acceptance Criteria
- Clicking Save downloads a PNG that matches what is on the canvas
- White background is preserved (canvas is not transparent)
`;

const TASK_OPEN = `# Implement open / load image

Allow the user to open a local image file and draw it onto the canvas.

## Tasks
- [ ] Add an "Open" button that triggers a hidden \`<input type="file" accept="image/*">\`
- [ ] Read the selected file with \`FileReader.readAsDataURL()\`
- [ ] Draw the loaded image onto the canvas with \`ctx.drawImage()\`, scaled to fit
- [ ] Push a history snapshot before drawing so it can be undone

## Acceptance Criteria
- Opening an image renders it on the canvas
- Image is scaled proportionally to fit the canvas dimensions
- Action is undoable
`;

const TASK_UNDO = `# Implement undo history

Allow the user to step back through canvas states.

## Tasks
- [ ] Maintain a \`history\` array of \`ImageData\` snapshots (cap at 50 entries)
- [ ] Push a snapshot before every committed draw operation
- [ ] On Undo (\`Ctrl+Z\`), pop the last snapshot and restore it with \`ctx.putImageData()\`
- [ ] Add an Undo button to the toolbar as a fallback for non-keyboard users
- [ ] Disable the Undo button when history is empty

## Acceptance Criteria
- \`Ctrl+Z\` steps back one operation at a time
- Up to 50 steps of history are available
- Undo button is visually disabled when there is nothing to undo
`;

const TASK_TOOLBAR = `# Implement toolbar UI and tool icons

Build the sidebar toolbar that houses all tool buttons and controls.

## Tasks
- [ ] Design a vertical left-side toolbar in CSS
- [ ] Add icon buttons for: Brush, Eraser, Fill, Line, Rectangle, Ellipse, Open, Save, Undo, Clear
- [ ] Use Unicode symbols or simple SVG icons (no external icon library)
- [ ] Highlight the active tool button with a selected state style
- [ ] Add tooltips (\`title\` attribute) to each button

## Acceptance Criteria
- All tools are accessible from the toolbar
- Active tool is clearly highlighted
- Toolbar is readable at 1080p and doesn't overflow on smaller viewports
`;

const TASK_SHORTCUTS = `# Implement keyboard shortcuts

Wire up keyboard shortcuts for fast tool switching and common actions.

## Shortcut Map
| Key | Action |
|-----|--------|
| B | Brush |
| E | Eraser |
| F | Fill (bucket) |
| L | Line |
| R | Rectangle |
| C | Circle / ellipse |
| Ctrl+Z | Undo |
| Ctrl+S | Save as PNG |
| Delete | Clear canvas |

## Tasks
- [ ] Add a \`keydown\` listener on \`document\`
- [ ] Dispatch to the correct tool or action based on \`event.key\`
- [ ] Guard \`Ctrl+\` combos with \`event.ctrlKey\` / \`event.metaKey\`
- [ ] Do not fire shortcuts when focus is inside an input element

## Acceptance Criteria
- Each shortcut activates the correct tool or action
- Shortcuts do not interfere with browser defaults (except Ctrl+S, which should be intentionally overridden)
`;

async function createRichWorkspaceData(
  userId: string,
  workspaceName: string,
  opts: { includeAgent?: boolean } = {},
) {
  // The demo workspace ships with a planted agent token + audit-log history (and
  // per-row "agent edited" badges) so the demo tells the full AI-agent story out
  // of the box. Real signups get the same sample content WITHOUT those records.
  const includeAgent = opts.includeAgent ?? true;

  const h = (n: number) => {
    const dt = new Date();
    dt.setHours(dt.getHours() + n);
    return dt;
  };
  // Seed rows must stamp createdAt/updatedAt explicitly — relying on the column's
  // SQL-level CURRENT_TIMESTAMP default stores a TEXT value that Drizzle's
  // {mode:'timestamp'} can't parse back into a Date (see the createdAt gotcha
  // in AGENTS.md), which made every freshly-seeded item invisible to the MCP
  // get_changes_since delta-sync tool.
  const now = new Date();

  // ── Ids — declared up front so the single batched write at the end can reference them ──

  const ws1 = crypto.randomUUID();
  const demoTokenId = crypto.randomUUID();            // stamps selected rows with an "agent edited" badge
  const startHereItem = crypto.randomUUID();
  const howBuiltItem = crypto.randomUUID();           // child page of Start Here; id needed for the inline link below
  const productSpecItem = crypto.randomUUID();
  const howBuiltCb = `<div data-cb-id="${howBuiltItem}" data-cb-dbid="" data-cb-type="page" data-cb-title="How This Was Built" data-cb-icon="🛠️" data-cb-iconcolor="" data-cb-link=""></div>`;

  // ── Sprint Board database ───────────────────────────────────────────────────

  const sprintSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    {
      id: 'status', name: 'Status', type: 'select' as const, options: [
        { value: 'Backlog', color: 'default' as const },
        { value: 'In Progress', color: 'orange' as const },
        { value: 'Done', color: 'green' as const },
      ],
    },
    {
      id: 'priority', name: 'Priority', type: 'select' as const, options: [
        { value: 'High', color: 'red' as const },
        { value: 'Medium', color: 'yellow' as const },
        { value: 'Low', color: 'green' as const },
      ],
    },
    {
      id: 'category', name: 'Category', type: 'select' as const, options: [
        { value: 'Canvas', color: 'red' as const },
        { value: 'Color', color: 'orange' as const },
        { value: 'Shapes', color: 'yellow' as const },
        { value: 'File', color: 'green' as const },
        { value: 'UI', color: 'teal' as const },
      ],
    },
  ];

  const sprintViews = [
    {
      id: 'v-sprint-1',
      name: 'Board',
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: ['Backlog', 'In Progress', 'Done'],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        cardProperties: ['priority', 'category'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'category',
        groupColBg: true,
      },
    },
    {
      id: 'v-sprint-2',
      name: 'Table',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'status', 'priority', 'category'],
        hiddenColumns: [],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        rowColorCol: 'status',
      },
    },
  ];

  const sprintDbItem = crypto.randomUUID();
  const sprintDb = crypto.randomUUID();

  const sprintTasks = [
    { title: 'Set up project scaffold', status: 'Done', priority: 'High', category: 'Canvas', content: TASK_SCAFFOLD, agentAt: h(-30) },
    { title: 'Implement freehand brush / pencil tool', status: 'Done', priority: 'High', category: 'Canvas', content: TASK_BRUSH, agentAt: h(-28) },
    { title: 'Implement eraser tool', status: 'Done', priority: 'High', category: 'Canvas', content: TASK_ERASER, agentAt: h(-24) },
    { title: 'Implement adjustable brush size', status: 'Backlog', priority: 'High', category: 'Canvas', content: TASK_BRUSH_SIZE },
    { title: 'Implement flood fill (bucket tool)', status: 'Backlog', priority: 'Medium', category: 'Canvas', content: TASK_FILL },
    { title: 'Implement clear canvas button', status: 'Backlog', priority: 'Medium', category: 'Canvas', content: TASK_CLEAR },
    { title: 'Implement color picker', status: 'Backlog', priority: 'High', category: 'Color', content: TASK_COLOR_PICKER },
    { title: 'Implement preset color palette', status: 'Backlog', priority: 'Medium', category: 'Color', content: TASK_PALETTE },
    { title: 'Implement line tool', status: 'In Progress', priority: 'Medium', category: 'Shapes', content: TASK_LINE, agentAt: h(-2) },
    { title: 'Implement rectangle tool', status: 'Backlog', priority: 'Medium', category: 'Shapes', content: TASK_RECT },
    { title: 'Implement circle / ellipse tool', status: 'Backlog', priority: 'Medium', category: 'Shapes', content: TASK_ELLIPSE },
    { title: 'Implement save as PNG', status: 'Backlog', priority: 'High', category: 'File', content: TASK_SAVE },
    { title: 'Implement open / load image', status: 'Backlog', priority: 'Medium', category: 'File', content: TASK_OPEN },
    { title: 'Implement undo history', status: 'Backlog', priority: 'High', category: 'UI', content: TASK_UNDO },
    { title: 'Implement toolbar UI and tool icons', status: 'Backlog', priority: 'High', category: 'UI', content: TASK_TOOLBAR },
    { title: 'Implement keyboard shortcuts', status: 'Backlog', priority: 'Low', category: 'UI', content: TASK_SHORTCUTS },
  ];

  const taskRowIds = sprintTasks.map(() => crypto.randomUUID());
  const taskRows = sprintTasks.map((task, i) => {
    const t = task as typeof sprintTasks[0] & { agentAt?: Date };
    return {
      id: taskRowIds[i],
      databaseId: sprintDb,
      title: t.title,
      content: t.content,
      properties: { title: t.title, status: t.status, priority: t.priority, category: t.category },
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
      ...(includeAgent && t.agentAt ? { agentEditedAt: t.agentAt, agentTokenId: demoTokenId } : {}),
    };
  });

  // ── Agent audit log ─────────────────────────────────────────────────────────
  // Mirrors the real Claude Code session that built this workspace (from Remnus's
  // own MCP audit log). Powers the live activity feed in the "AI Agents" panel.

  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000);
  const activityRows = ([
    { tool: 'list_workspace', targetType: null, targetId: null, at: at(32) },
    { tool: 'create_page', targetType: 'page', targetId: productSpecItem, at: at(31.7) },
    { tool: 'create_database', targetType: 'database', targetId: sprintDb, at: at(31.5) },
    // 16 task rows generated one after another
    ...taskRowIds.map((id, i) => ({
      tool: 'create_page', targetType: 'db-row' as const, targetId: id, at: at(31.3 - i * 0.07),
    })),
    { tool: 'update_page', targetType: 'db-row', targetId: taskRowIds[0], at: at(30) },  // scaffold → Done
    { tool: 'update_page', targetType: 'db-row', targetId: taskRowIds[1], at: at(28) },  // brush → Done
    { tool: 'update_page', targetType: 'db-row', targetId: taskRowIds[2], at: at(24) },  // eraser → Done
    { tool: 'query_database', targetType: 'database', targetId: sprintDb, at: at(6) },
    { tool: 'update_page', targetType: 'db-row', targetId: taskRowIds[8], at: at(2) },   // line tool → In Progress
    { tool: 'get_page', targetType: 'page', targetId: productSpecItem, at: at(1) },
  ] as { tool: string; targetType: string | null; targetId: string | null; at: Date }[]).map((a) => ({
    id: crypto.randomUUID(),
    tokenId: demoTokenId,
    workspaceId: ws1,
    tool: a.tool,
    targetType: a.targetType,
    targetId: a.targetId,
    status: 'success' as const,
    createdAt: a.at,
  }));

  // ── Single batched write ────────────────────────────────────────────────────
  // Production DB is remote (Turso) — every INSERT is a network round-trip, so the
  // old seed (~55 sequential inserts) made "Try the demo" feel slow. Sending every
  // row in ONE batch (with multi-row inserts for the 16 tasks + the audit log)
  // collapses it to a single round-trip. Order is FK-safe: parents precede children.

  const writes = [
    db.insert(workspaces).values({ id: ws1, name: workspaceName, sortOrder: 0, billingOwnerId: userId, createdAt: new Date() }),
    db.insert(workspaceMembers).values({ id: crypto.randomUUID(), workspaceId: ws1, userId, role: 'owner', createdAt: new Date() }),
    ...(includeAgent
      ? [db.insert(agentTokens).values({ id: demoTokenId, workspaceId: ws1, name: 'Claude AI Agent', agentName: 'claude-code', tokenPrefix: 'rmns-demo', tokenHash: 'demo-seed-not-valid', scope: 'write', createdBy: userId, createdAt: h(-48), lastUsedAt: h(-1) })]
      : []),
    db.insert(workspaceItems).values({ id: startHereItem, workspaceId: ws1, type: 'page', title: 'Start Here', sortOrder: 0, icon: '⭐', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: startHereItem, content: START_HERE_CONTENT.replace('{{HOW_BUILT_CB}}', howBuiltCb), createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: productSpecItem, workspaceId: ws1, type: 'page', title: 'Product Spec', sortOrder: 1, icon: '🎨', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: productSpecItem, content: PRODUCT_SPEC_CONTENT, createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: howBuiltItem, workspaceId: ws1, type: 'page', title: 'How This Was Built', parentId: startHereItem, sortOrder: 0, icon: '🛠️', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: howBuiltItem, content: HOW_THIS_WAS_BUILT_CONTENT, createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: sprintDbItem, workspaceId: ws1, type: 'database', title: 'Sprint Board', sortOrder: 2, icon: '📋', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(databases).values({ id: sprintDb, name: 'Sprint Board', itemId: sprintDbItem, schema: sprintSchema, views: sprintViews, createdAt: now, updatedAt: now }),
    db.insert(pages).values(taskRows),
    ...(includeAgent ? [db.insert(agentActivity).values(activityRows)] : []),
  ];

  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}

export async function createDemoSeedData(userId: string, userName?: string | null) {
  const workspaceName = userName ? `${userName} Workspace` : 'Demo Workspace';
  await createRichWorkspaceData(userId, workspaceName);
}
