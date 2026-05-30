export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
};

export type WorkspaceMember = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'owner' | 'member' | 'viewer';
};

export type AgentToken = {
  id: string;
  name: string;
  agentName: string | null;
  tokenPrefix: string;
  scope: 'read' | 'write';
  createdAt: Date | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export const AGENT_OPTIONS = [
  { id: 'claude-code',  label: 'Claude Code',  aiMarkName: 'claude'      as const },
  { id: 'cursor',       label: 'Cursor',        aiMarkName: 'cursor'      as const },
  { id: 'windsurf',     label: 'Windsurf',      aiMarkName: 'windsurf'    as const },
  { id: 'continue',     label: 'Continue',      aiMarkName: 'continue'    as const },
  { id: 'codex',        label: 'Codex',         aiMarkName: 'chatgpt'     as const },
  { id: 'antigravity',  label: 'Antigravity',   aiMarkName: 'antigravity' as const },
] as const;

export type AgentId = typeof AGENT_OPTIONS[number]['id'];
