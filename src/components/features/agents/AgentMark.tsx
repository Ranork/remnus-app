'use client';
import { Globe, Zap } from 'lucide-react';
import AIMark, { type AIMarkName } from '@/components/marketing/AIMark';

/**
 * Agent icon resolution shared by AgentsModal (PAT + OAuth rows) and ConnectFlow.
 *
 * Three id systems exist in the codebase (EDITORS, AGENT_OPTIONS, AIMark names) and OAuth
 * clients self-register with a free-text `client_name`. To render one consistent brand icon
 * we (1) store a canonical agent id (`AGENT_MARKS[].id`) when the user picks one, and
 * (2) best-effort *infer* the mark from any free-text hint (PAT name / OAuth client_name)
 * when no explicit id is set.
 */

export type AgentMarkName = AIMarkName | 'vscode';

/** Canonical, user-selectable connectable agents. `id` is what we persist in `agent_name`. */
export const AGENT_MARKS: { id: string; label: string; mark: AgentMarkName }[] = [
  { id: 'claude',      label: 'Claude Code', mark: 'claude'      },
  { id: 'cursor',      label: 'Cursor',      mark: 'cursor'      },
  { id: 'vscode',      label: 'VS Code',     mark: 'vscode'      },
  { id: 'windsurf',    label: 'Windsurf',    mark: 'windsurf'    },
  { id: 'continue',    label: 'Continue',    mark: 'continue'    },
  { id: 'codex',       label: 'Codex',       mark: 'codex'       },
  { id: 'antigravity', label: 'Antigravity', mark: 'antigravity' },
  { id: 'gemini',      label: 'Gemini',      mark: 'gemini'      },
  { id: 'zed',         label: 'Zed',         mark: 'zed'         },
];

// VS Code has no AIMark glyph — its own mark lives here (also reused by ConnectFlow).
export function VscodeMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
      <path d="M17.583.063L9.963 7.087 4.19 2.383 2 3.436v17.125l2.19 1.054 5.773-4.704 7.62 7.026L22 22.564V1.436L17.583.063zM20 19.437l-6-5.453v-3.97l6-5.451v14.874zM4 19.204V4.797l4 3.26v7.888L4 19.204z" />
    </svg>
  );
}

/** Map an explicit canonical agent id → mark. */
export function markForId(id?: string | null): AgentMarkName | null {
  if (!id) return null;
  return AGENT_MARKS.find(a => a.id === id)?.mark ?? null;
}

/** Best-effort inference from any free-text hint (PAT name, OAuth client_name, legacy ids). */
export function resolveAgentMark(hint?: string | null): AgentMarkName | null {
  if (!hint) return null;
  const s = hint.toLowerCase();
  // Order matters: check specific brands before the bare "code" → vscode rule.
  if (s.includes('antigravity')) return 'antigravity';
  if (s.includes('windsurf'))    return 'windsurf';
  if (s.includes('continue'))    return 'continue';
  if (s.includes('cursor'))      return 'cursor';
  if (s.includes('claude'))      return 'claude';
  // The Remnus .mcpb bundle connects Claude Desktop via the `mcp-remote` proxy,
  // which dynamic-registers under a generic name ("MCP CLI Proxy"/"MCP CLI Client").
  // Map those to Claude so the bundle shows the right brand icon out of the box.
  if (s.includes('mcp cli') || s.includes('mcp-remote') || s.includes('mcp remote')) return 'claude';
  if (s.includes('codex')) return 'codex';
  if (s.includes('chatgpt') || s.includes('openai')) return 'chatgpt';
  if (s.includes('gemini'))      return 'gemini';
  if (s.includes('zed'))         return 'zed';
  if (s.includes('vscode') || s.includes('vs code') || s.includes('visual studio')) return 'vscode';
  return null;
}

export function MarkIcon({ mark, size = 14 }: { mark: AgentMarkName; size?: number }) {
  return mark === 'vscode' ? <VscodeMark size={size} /> : <AIMark name={mark} size={size} />;
}

interface AgentMarkProps {
  /** Explicit canonical agent id (user-picked override). Wins over `hint`. */
  override?: string | null;
  /** Free-text hint to infer from when no override (PAT name / OAuth client_name). */
  hint?: string | null;
  size?: number;
  /** Icon shown when nothing resolves. */
  fallback?: 'globe' | 'zap';
}

/** Renders the best agent brand icon: override id → inferred from override → inferred from hint → fallback. */
export default function AgentMark({ override, hint, size = 14, fallback = 'globe' }: AgentMarkProps) {
  const mark = markForId(override) ?? resolveAgentMark(override) ?? resolveAgentMark(hint);
  if (mark) return <MarkIcon mark={mark} size={size} />;
  return fallback === 'zap'
    ? <Zap size={Math.max(10, size - 2)} className="text-amber-400/60" />
    : <Globe size={Math.max(10, size - 2)} className="text-blue-400" />;
}
