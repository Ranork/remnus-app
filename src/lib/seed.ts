import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases, pages, workspaceMembers, agentTokens, agentActivity } from '@/db/schema';
import { syncPageLinks } from '@/lib/services/pageLinks';
import { getRequestLocale } from '@/i18n/requestLocale';
import type { Locale } from '@/i18n/routing';
import { getSampleText } from '@/lib/starterContent';
import type { SampleText, SprintTaskKey } from '@/lib/starterContent/types';

// The sample workspace — a Paint clone an agent planned and partly built — that every
// signup and every demo starts with. Born in the visitor's language (V2 R8.9): the
// words come from `src/lib/starterContent/sample/<locale>.ts`, the structure (which
// task is Done, which rows an agent touched, the audit trace) lives here once.

export async function createSeedWorkspace(userId: string, userName?: string | null, locale?: Locale) {
  // Called from the Auth.js `createUser` event — a route handler, so the language is
  // resolved from the request (locale cookie, then Accept-Language).
  const text = await getSampleText(locale ?? (await getRequestLocale()));
  const workspaceName = userName ? text.workspaceName(userName) : text.personalWorkspace;
  // New (real) users get the sample Paint-clone workspace WITHOUT a pre-seeded
  // agent token or audit-log history — a brand-new user hasn't connected any
  // agent yet, so a planted "Claude AI Agent" token + activity feed in the AI
  // Agents panel would be misleading (and would muddy the onboarding funnel).
  await createRichWorkspaceData(userId, workspaceName, text, { includeAgent: false });
}

// ── Sprint Board structure ─────────────────────────────────────────────────

type SprintStatus = keyof SampleText['sprintBoard']['status'];
type SprintPriority = keyof SampleText['sprintBoard']['priority'];
type SprintCategory = keyof SampleText['sprintBoard']['category'];

/** `agentHoursAgo`: when an agent last edited the row (demo only — the "agent edited" badge). */
const SPRINT_TASKS: { key: SprintTaskKey; status: SprintStatus; priority: SprintPriority; category: SprintCategory; agentHoursAgo?: number }[] = [
  { key: 'scaffold', status: 'done', priority: 'high', category: 'canvas', agentHoursAgo: 30 },
  { key: 'brush', status: 'done', priority: 'high', category: 'canvas', agentHoursAgo: 28 },
  { key: 'eraser', status: 'done', priority: 'high', category: 'canvas', agentHoursAgo: 24 },
  { key: 'brushSize', status: 'backlog', priority: 'high', category: 'canvas' },
  { key: 'fill', status: 'backlog', priority: 'medium', category: 'canvas' },
  { key: 'clear', status: 'backlog', priority: 'medium', category: 'canvas' },
  { key: 'colorPicker', status: 'backlog', priority: 'high', category: 'color' },
  { key: 'palette', status: 'backlog', priority: 'medium', category: 'color' },
  { key: 'line', status: 'inProgress', priority: 'medium', category: 'shapes', agentHoursAgo: 2 },
  { key: 'rect', status: 'backlog', priority: 'medium', category: 'shapes' },
  { key: 'ellipse', status: 'backlog', priority: 'medium', category: 'shapes' },
  { key: 'save', status: 'backlog', priority: 'high', category: 'file' },
  { key: 'open', status: 'backlog', priority: 'medium', category: 'file' },
  { key: 'undo', status: 'backlog', priority: 'high', category: 'ui' },
  { key: 'toolbar', status: 'backlog', priority: 'high', category: 'ui' },
  { key: 'shortcuts', status: 'backlog', priority: 'low', category: 'ui' },
];

async function createRichWorkspaceData(
  userId: string,
  workspaceName: string,
  text: SampleText,
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
  const howBuiltTitle = text.howBuilt.title.replace(/"/g, '&quot;');
  const howBuiltCb = `<div data-cb-id="${howBuiltItem}" data-cb-dbid="" data-cb-type="page" data-cb-title="${howBuiltTitle}" data-cb-icon="🛠️" data-cb-iconcolor="" data-cb-link=""></div>`;
  const startHereContent = text.startHere.content.replace('{{HOW_BUILT_CB}}', howBuiltCb);

  // ── Sprint Board database ───────────────────────────────────────────────────

  const board = text.sprintBoard;
  // The status options carry their group although the column is a `select`: the
  // home dashboard reads "finished" from it in any language.
  const sprintSchema = [
    { id: 'title', name: board.columns.title, type: 'text' as const },
    {
      id: 'status', name: board.columns.status, type: 'select' as const, options: [
        { value: board.status.backlog, color: 'default' as const, group: 'todo' as const },
        { value: board.status.inProgress, color: 'orange' as const, group: 'in_progress' as const },
        { value: board.status.done, color: 'green' as const, group: 'complete' as const },
      ],
    },
    {
      id: 'priority', name: board.columns.priority, type: 'select' as const, options: [
        { value: board.priority.high, color: 'red' as const },
        { value: board.priority.medium, color: 'yellow' as const },
        { value: board.priority.low, color: 'green' as const },
      ],
    },
    {
      id: 'category', name: board.columns.category, type: 'select' as const, options: [
        { value: board.category.canvas, color: 'red' as const },
        { value: board.category.color, color: 'orange' as const },
        { value: board.category.shapes, color: 'yellow' as const },
        { value: board.category.file, color: 'green' as const },
        { value: board.category.ui, color: 'teal' as const },
      ],
    },
  ];

  const sprintViews = [
    {
      id: 'v-sprint-1',
      name: board.views.board,
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: [board.status.backlog, board.status.inProgress, board.status.done],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        cardProperties: ['priority', 'category'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'category',
      },
    },
    {
      id: 'v-sprint-2',
      name: board.views.table,
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

  const taskRowIds = SPRINT_TASKS.map(() => crypto.randomUUID());
  const taskRows = SPRINT_TASKS.map((task, i) => {
    const { title, content } = text.tasks[task.key];
    return {
      id: taskRowIds[i],
      databaseId: sprintDb,
      title,
      content,
      properties: {
        title,
        status: board.status[task.status],
        priority: board.priority[task.priority],
        category: board.category[task.category],
      },
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
      ...(includeAgent && task.agentHoursAgo !== undefined
        ? { agentEditedAt: h(-task.agentHoursAgo), agentTokenId: demoTokenId }
        : {}),
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
      ? [db.insert(agentTokens).values({ id: demoTokenId, workspaceId: ws1, name: text.agentTokenName, agentName: 'claude-code', tokenPrefix: 'rmns-demo', tokenHash: 'demo-seed-not-valid', scope: 'write', createdBy: userId, createdAt: h(-48), lastUsedAt: h(-1) })]
      : []),
    db.insert(workspaceItems).values({ id: startHereItem, workspaceId: ws1, type: 'page', title: text.startHere.title, sortOrder: 0, icon: '⭐', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: startHereItem, content: startHereContent, createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: productSpecItem, workspaceId: ws1, type: 'page', title: text.productSpec.title, sortOrder: 1, icon: '🎨', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: productSpecItem, content: text.productSpec.content, createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: howBuiltItem, workspaceId: ws1, type: 'page', title: text.howBuilt.title, parentId: startHereItem, sortOrder: 0, icon: '🛠️', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: howBuiltItem, content: text.howBuilt.content, createdAt: now, updatedAt: now }),
    db.insert(workspaceItems).values({ id: sprintDbItem, workspaceId: ws1, type: 'database', title: board.name, sortOrder: 2, icon: '📋', iconColor: 'default', createdAt: now, updatedAt: now }),
    db.insert(databases).values({ id: sprintDb, name: board.name, itemId: sprintDbItem, schema: sprintSchema, views: sprintViews, createdAt: now, updatedAt: now }),
    db.insert(pages).values(taskRows),
    ...(includeAgent ? [db.insert(agentActivity).values(activityRows)] : []),
  ];

  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

  // Seed content is inserted directly (not through the action-layer write paths),
  // so it bypasses their syncPageLinks() call — without this, the "Start Here" ->
  // "How This Was Built" child-block link never enters the page_links graph and
  // get_related_pages/the backlinks panel stay empty on every freshly seeded workspace.
  await syncPageLinks(ws1, startHereItem, 'page', startHereContent);
}

/** The demo's workspace, in the words the caller already loaded (it names the demo user with them too). */
export async function createDemoSeedData(userId: string, text: SampleText) {
  await createRichWorkspaceData(userId, text.demoWorkspace, text);
}
