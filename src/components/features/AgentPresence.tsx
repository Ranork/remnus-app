'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bot } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { AGENT_EVENT, agentIsActive } from '@/components/providers/ActivityTracker';
import { MarkIcon } from './agents/AgentMark';
import { resolveAgent } from './AgentEditBadge';
import {
  AGENT_ACTIVE_WINDOW_MS,
  AGENT_PRESENCE_WINDOW_MS,
  AGENT_RECENT_MS,
  type AgentPresence,
  type PresenceAgent,
  type PresenceTouch,
} from '@/lib/agentPresence';

/**
 * The agent presence layer on the client (V2 R8.8). The data comes with the server
 * render (`services/agentPresence.ts`, `services/pageProvenance.ts`); everything here
 * only AGES it — on one shared 30-second clock, so a mark goes from the live disc to
 * "12 min" to nothing without a request and without animation.
 */

// ── Clocks ───────────────────────────────────────────────────────────────────

const TICK_MS = 30_000;
const tickListeners = new Set<() => void>();
let tickNow = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(onChange: () => void) {
  tickListeners.add(onChange);
  if (!tickTimer) {
    tickNow = Date.now();
    tickTimer = setInterval(() => {
      tickNow = Date.now();
      tickListeners.forEach((listener) => listener());
    }, TICK_MS);
  }
  return () => {
    tickListeners.delete(onChange);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/**
 * "Now" on the server's clock for data read at `serverAt` (epoch ms, server). Ages grow
 * by the client time elapsed since the data arrived, so a client clock that is minutes
 * off never skews them. During SSR and hydration it is `serverAt` itself, so the server
 * and the first client render agree.
 */
export function useServerNow(serverAt: number): number {
  const tick = useSyncExternalStore(subscribeTick, () => tickNow, () => 0);
  const [arrived, setArrived] = useState<{ serverAt: number; clientAt: number } | null>(null);
  useEffect(() => {
    setArrived({ serverAt, clientAt: Date.now() });
  }, [serverAt]);
  if (!arrived || arrived.serverAt !== serverAt || !tick) return serverAt;
  return serverAt + Math.max(0, tick - arrived.clientAt);
}

function subscribeAgent(onChange: () => void) {
  window.addEventListener(AGENT_EVENT, onChange);
  return () => window.removeEventListener(AGENT_EVENT, onChange);
}

/** The heartbeat's `agent: true` (ActivityTracker): an agent called Remnus in the last 3 min. */
export function useAgentHeartbeat(): boolean {
  return useSyncExternalStore(subscribeAgent, agentIsActive, () => false);
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** "2 min. ago" / "2 dk. önce" / "yesterday", in the UI locale. */
export function formatAgo(ageMs: number, locale: string): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (seconds < 45) return rtf.format(0, 'second');
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.floor(seconds / 60)), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  return rtf.format(-Math.floor(seconds / 86_400), 'day');
}

/** A bare age for the tree: "12 min" / "12 dk." — the mark reads as "this long ago". */
function formatAge(ageMs: number, locale: string): string {
  const minutes = Math.max(1, Math.floor(ageMs / 60_000));
  return minutes < 60
    ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(minutes)
    : new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(Math.floor(minutes / 60));
}

/** The name a person knows the agent by: its brand, else the connection's own label. */
export function agentLabel(agent: Pick<PresenceAgent, 'agentName' | 'tokenName'> | undefined, fallback: string): string {
  if (!agent) return fallback;
  return resolveAgent(agent.agentName, agent.tokenName)?.label ?? agent.tokenName ?? agent.agentName ?? fallback;
}

/** The agent's brand mark on a small neutral disc (same look as `AgentEditBadge`). */
export function AgentDisc({ agent, live = false, size = 20 }: { agent?: Pick<PresenceAgent, 'agentName' | 'tokenName'>; live?: boolean; size?: 18 | 20 }) {
  const mark = agent ? resolveAgent(agent.agentName, agent.tokenName)?.mark : undefined;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        size === 18 ? 'size-[18px]' : 'size-5',
        // Live: the signal as a ring on a soft fill — steady, never breathing (Hakan, R8).
        live ? 'bg-signal-soft shadow-[0_0_0_1.5px_var(--color-signal)]' : 'bg-sheet shadow-[inset_0_0_0_1px_var(--color-line)]',
      )}
    >
      {mark ? <MarkIcon mark={mark} size={size === 18 ? 11 : 12} /> : <Bot size={size === 18 ? 11 : 12} className="text-fg-3" />}
    </span>
  );
}

// ── The agents card ──────────────────────────────────────────────────────────

/** How many connections the card lists. */
const CARD_AGENTS = 3;

/**
 * Who worked here lately, for the top of the sidebar's agents card: each connection
 * with its brand, and either "working" (a call in the last 3 minutes — the window the
 * heartbeat polls closely in) with its last call and target, or how long ago it last
 * called. Renders spans only: the card around it is one button.
 *
 * The heartbeat also knows when an agent is active that this render has not seen yet
 * (one that has only read since). With a single connection in the window that is
 * almost surely it; with several it would be a guess, so the card says "an agent".
 */
export function AgentPresenceRows({ presence, hiddenWorkspaceIds }: { presence: AgentPresence; hiddenWorkspaceIds?: Set<string> }) {
  const t = useTranslations('Workspace');
  const locale = useLocale();
  const now = useServerNow(presence.at);
  const heartbeat = useAgentHeartbeat();

  const agents = presence.agents.filter(
    (agent) => now - agent.lastAt < AGENT_PRESENCE_WINDOW_MS && !hiddenWorkspaceIds?.has(agent.workspaceId),
  );
  const isWorking = (agent: PresenceAgent) => now - agent.lastAt < AGENT_ACTIVE_WINDOW_MS;
  const anyWorking = agents.some(isWorking);
  // The heartbeat has seen a call this render has not: name the agent only when it can be no other.
  const heartbeatOnly = heartbeat && !anyWorking;
  const inferred = heartbeatOnly && agents.length === 1 ? agents[0].key : null;
  const unnamed = heartbeatOnly && !inferred;

  if (agents.length === 0 && !unnamed) return null;

  return (
    <span className="block px-1 pt-1 pb-1.5">
      {unnamed && (
        <span className="flex h-8 min-w-0 items-center gap-2 px-1.5">
          <AgentDisc live />
          <span className="min-w-0 truncate text-ui font-medium text-fg">{t('presenceSomeAgent')}</span>
          <WorkingLabel label={t('presenceWorking')} />
        </span>
      )}
      {agents.slice(0, unnamed ? CARD_AGENTS - 1 : CARD_AGENTS).map((agent) => {
        const working = isWorking(agent) || agent.key === inferred;
        const target = agent.target ?? (agent.items ? t('presenceItems', { count: agent.items }) : null);
        return (
          <span key={agent.key} className="flex min-w-0 items-start gap-2 px-1.5 py-1">
            <span className="mt-px">
              <AgentDisc agent={agent} live={working} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex h-5 min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-ui font-medium text-fg">{agentLabel(agent, t('presenceUnknownAgent'))}</span>
                {working ? (
                  <WorkingLabel label={t('presenceWorking')} />
                ) : (
                  <span className="ml-auto shrink-0 text-xs text-fg-3">{formatAgo(now - agent.lastAt, locale)}</span>
                )}
              </span>
              {/* The last call — the tool as machine text, then what it touched. */}
              {working && (
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
                  <span className="shrink-0 font-mono text-2xs text-signal-text">{agent.tool}</span>
                  {target && <span className="min-w-0 truncate">{target}</span>}
                </span>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function WorkingLabel({ label }: { label: string }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-signal-text">
      <span aria-hidden className="size-1.5 rounded-full bg-signal" />
      {label}
    </span>
  );
}

/** Whether an agent is working in `workspaceId` now, by this render plus the client clock. */
export function useWorkingWorkspaces(presence: AgentPresence): Set<string> {
  const now = useServerNow(presence.at);
  return new Set(presence.agents.filter((agent) => now - agent.lastAt < AGENT_ACTIVE_WINDOW_MS).map((agent) => agent.workspaceId));
}

// ── Tree marks ───────────────────────────────────────────────────────────────

/**
 * An agent changed this item lately. Under 10 minutes: the agent's mark on a disc
 * ringed in the signal (live). Under an hour: how long ago, quietly. Then nothing. A
 * collapsed parent carries the newest change beneath it (the sidebar passes it in).
 */
export function AgentTouchMark({ touch, presence, now }: { touch: PresenceTouch | undefined; presence: AgentPresence; now: number }) {
  const t = useTranslations('Workspace');
  const locale = useLocale();
  if (!touch) return null;
  const age = now - touch.at;
  if (age < 0 || age >= AGENT_PRESENCE_WINDOW_MS) return null;

  const agent = touch.agent ? presence.agents.find((candidate) => candidate.key === touch.agent) : undefined;
  const label = t('presenceTouched', { agent: agentLabel(agent, t('presenceUnknownAgent')), time: formatAgo(age, locale) });
  return (
    <Tooltip content={label}>
      <span role="img" aria-label={label} tabIndex={-1} className="inline-flex h-5 shrink-0 cursor-default items-center select-none">
        {age < AGENT_RECENT_MS ? (
          <AgentDisc agent={agent} live size={18} />
        ) : (
          <span className="text-2xs tabular-nums text-fg-3">{formatAge(age, locale)}</span>
        )}
      </span>
    </Tooltip>
  );
}
