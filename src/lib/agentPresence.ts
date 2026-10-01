/**
 * The agent presence layer (V2 R8.8): the windows and the wire shapes shared by the
 * server (`services/agentPresence.ts`, `services/pageProvenance.ts`, the heartbeat)
 * and the client (the sidebar's agents card and tree marks, the page provenance line).
 * No server imports here — client components read these constants too.
 *
 * Three windows, one meaning each:
 *  - working  an agent called Remnus in the last 3 minutes. The same window the
 *             heartbeat's `agent: true` uses to put a tab on the fast change poll, so
 *             "working" in the sidebar and "polling closely" are one fact.
 *  - recent   an edit in the last 10 minutes still counts as activity: a steady
 *             signal dot (never a pulse). After that it is a fact, shown as an age.
 *  - presence how far back the layer looks at all: agents listed in the card and
 *             items marked in the tree. Past it the mark is gone — it fades by steps
 *             (dot → "12 min" → nothing), with no animation.
 */

/** An agent call this recent means the agent is working now (heartbeat `agent: true`). */
export const AGENT_ACTIVE_WINDOW_MS = 3 * 60 * 1000;

/** An agent edit this recent is live: the one place a mark spends the signal colour. */
export const AGENT_RECENT_MS = 10 * 60 * 1000;

/** How far back agents are listed and sidebar items marked. */
export const AGENT_PRESENCE_WINDOW_MS = 60 * 60 * 1000;

/** One agent connection (a PAT or an OAuth grant) seen in the presence window. */
export type PresenceAgent = {
  /** The token id (PAT or OAuth) — stable for the connection, never shown. */
  key: string;
  /** Canonical agent id (`AGENT_MARKS`) or a free-text hint, for the brand mark. */
  agentName: string | null;
  /** The token's or OAuth client's own label. */
  tokenName: string | null;
  workspaceId: string;
  /** Its newest call, epoch ms (server clock). */
  lastAt: number;
  /** That call's tool name. */
  tool: string;
  /** The title of what that call touched, when it named a page, row or database. */
  target: string | null;
  /** Pages/rows a bulk call created or updated. */
  items: number | null;
};

/** The newest agent write to a sidebar item (a row's write counts for its database). */
export type PresenceTouch = {
  at: number;
  /** `PresenceAgent.key` of the writer, when known. */
  agent: string | null;
};

export type AgentPresence = {
  /** Server clock (epoch ms) the presence was read at — ages are measured from it. */
  at: number;
  /** Newest first. Every connection seen in the window; the card shows the first few. */
  agents: PresenceAgent[];
  /** Sidebar item id → newest agent write. */
  touched: Record<string, PresenceTouch>;
};

export const EMPTY_PRESENCE: AgentPresence = { at: 0, agents: [], touched: {} };

/**
 * Who shaped a page, for the line under its title. Only built for a page an agent has
 * written (a human-only page shows no line). Ages are measured against `at`.
 */
export type PageProvenance = {
  /** Server clock (epoch ms) when this was read. */
  at: number;
  agent: { agentName: string | null; tokenName: string | null; at: number };
  /** The newest human edit we know of (the version history), if any. */
  human: { name: string; you: boolean; at: number } | null;
  /** A human review of exactly the current title + body, if one exists. */
  reviewed: { at: number; you: boolean } | null;
};
