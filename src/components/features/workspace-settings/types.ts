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
