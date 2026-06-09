// ── MCP client connection builders ──────────────────────────────────────────
//
// Each builder produces the deeplink / command / config snippet a given editor
// needs to connect to the Remnus MCP server. Every builder takes an optional
// `token`:
//   • token provided  → PAT mode: the Authorization header is embedded directly
//   • token omitted    → OAuth mode: only the URL is given, so the client runs
//                         its own OAuth 2.1 discovery + browser flow on first 401
//
// Used by ConnectFlow (AgentsModal), TokensTab, and McpOnboarding.

export type EditorId = 'claude' | 'cursor' | 'vscode' | 'windsurf' | 'continue' | 'antigravity';
export type OS = 'mac' | 'linux' | 'windows';

export interface EditorMeta {
  id: EditorId;
  label: string;
  /** AIMark icon name, or null when the editor needs a custom inline SVG */
  aiMark: 'claude' | 'cursor' | 'windsurf' | 'continue' | 'antigravity' | null;
  /** How the user connects: a shell command, a one-click deeplink, or a JSON file edit */
  kind: 'command' | 'deeplink' | 'json';
}

export const EDITORS: EditorMeta[] = [
  { id: 'claude',      label: 'Claude Code', aiMark: 'claude',      kind: 'command'  },
  { id: 'cursor',      label: 'Cursor',      aiMark: 'cursor',      kind: 'deeplink' },
  { id: 'vscode',      label: 'VS Code',     aiMark: null,          kind: 'deeplink' },
  { id: 'windsurf',    label: 'Windsurf',    aiMark: 'windsurf',    kind: 'json'     },
  { id: 'continue',    label: 'Continue',    aiMark: 'continue',    kind: 'json'     },
  { id: 'antigravity', label: 'Antigravity', aiMark: 'antigravity', kind: 'json'     },
];

/** Editors that genuinely support a token-less OAuth flow on first connect. */
export const OAUTH_READY: Record<EditorId, boolean> = {
  claude:      true,
  vscode:      true,
  cursor:      true,  // works, but may prompt for manual approval — see ConnectFlow warning
  windsurf:    false,
  continue:    false,
  antigravity: false,
};

export const CONFIG_PATHS: Record<Exclude<EditorId, 'claude' | 'vscode'>, Record<OS, string>> = {
  cursor:      { mac: '~/.cursor/mcp.json',                  linux: '~/.cursor/mcp.json',                  windows: '%USERPROFILE%\\.cursor\\mcp.json' },
  windsurf:    { mac: '~/.codeium/windsurf/mcp_config.json', linux: '~/.codeium/windsurf/mcp_config.json', windows: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json' },
  continue:    { mac: '~/.continue/config.json',             linux: '~/.continue/config.json',             windows: '%USERPROFILE%\\.continue\\config.json' },
  antigravity: { mac: '~/.gemini/config/mcp_config.json',    linux: '~/.gemini/config/mcp_config.json',    windows: '%USERPROFILE%\\.gemini\\config\\mcp_config.json' },
};

function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

// ── Cursor — cursor:// deeplink ──────────────────────────────────────────────
export function buildCursorUrl(mcpUrl: string, token?: string): string {
  const config = token
    ? { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } }
    : { url: mcpUrl };
  // btoa is browser-only; these builders are called from client components
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=remnus&config=${btoa(JSON.stringify(config))}`;
}

// ── VS Code — vscode:mcp/install deeplink ────────────────────────────────────
export function buildVscodeUrl(mcpUrl: string, token?: string): string {
  const config = token
    ? { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${token}` } }
    : { type: 'http', url: mcpUrl };
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'remnus', config }))}`;
}

// ── Claude Code — CLI command ────────────────────────────────────────────────
export function buildClaudeCmd(mcpUrl: string, token?: string): string {
  const base = `claude mcp add --transport http --scope user remnus ${mcpUrl}`;
  return token ? `${base} --header "Authorization: Bearer ${token}"` : base;
}

// ── JSON config snippet (Cursor file edit, Windsurf, Continue, Antigravity) ──
export function buildJsonConfig(editor: EditorId, mcpUrl: string, token?: string): string {
  const headers = authHeaders(token);
  // Antigravity uses `serverUrl`; everyone else uses `url`
  const server =
    editor === 'antigravity'
      ? { serverUrl: mcpUrl, ...(headers ? { headers } : {}) }
      : editor === 'claude'
      ? { type: 'http', url: mcpUrl, ...(headers ? { headers } : {}) }
      : { url: mcpUrl, ...(headers ? { headers } : {}) };
  return JSON.stringify({ mcpServers: { remnus: server } }, null, 2);
}

export const TEST_PROMPT = 'List all pages and databases in my Remnus workspace';
