'use client';
import { Globe, Zap } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { AGENT_MARKS, markForId, resolveAgentMark, type AgentMarkName } from './agentMarks';

/**
 * Agent icon resolution shared by AgentsModal (PAT + OAuth rows) and ConnectFlow.
 *
 * A couple of id systems exist in the codebase (EDITORS, AIMark names) and OAuth
 * clients self-register with a free-text `client_name`. To render one consistent brand icon
 * we (1) store a canonical agent id (`AGENT_MARKS[].id`) when the user picks one, and
 * (2) best-effort *infer* the mark from any free-text hint (PAT name / OAuth client_name)
 * when no explicit id is set.
 *
 * The plain data (`AGENT_MARKS`/`markForId`/`resolveAgentMark`/`AgentMarkName`) lives in
 * `./agentMarks` (no `'use client'`) so server components can import it safely — and is
 * re-exported here so existing client imports of this module keep working.
 */

export { AGENT_MARKS, markForId, resolveAgentMark, type AgentMarkName };

// VS Code has no AIMark glyph — its own mark lives here (also reused by ConnectFlow).
export function VscodeMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
      <path d="M17.583.063L9.963 7.087 4.19 2.383 2 3.436v17.125l2.19 1.054 5.773-4.704 7.62 7.026L22 22.564V1.436L17.583.063zM20 19.437l-6-5.453v-3.97l6-5.451v14.874zM4 19.204V4.797l4 3.26v7.888L4 19.204z" />
    </svg>
  );
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
