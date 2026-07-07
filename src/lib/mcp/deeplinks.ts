// ── MCP client connection builders ──────────────────────────────────────────
//
// Each builder produces the deeplink / command / config snippet a given editor
// needs to connect to the Remnus MCP server. Every builder takes an optional
// `token`:
//   • token provided  → PAT mode: the Authorization header is embedded directly
//   • token omitted    → OAuth mode: only the URL is given, so the client runs
//                         its own OAuth 2.1 discovery + browser flow on first 401
//
// Used by ConnectFlow (the editor-connect step, rendered by ConnectModal / AgentsModal).

export type EditorId = 'claude' | 'cursor' | 'vscode' | 'windsurf' | 'continue' | 'antigravity' | 'codex' | 'custom';
export type OS = 'mac' | 'linux' | 'windows';

export interface EditorMeta {
  id: EditorId;
  label: string;
  /** i18n key (WorkspaceSettings namespace) for the short "what this product is" blurb. */
  descKey: string;
  /** AIMark icon name, or null when the editor needs a custom inline SVG / generic icon */
  aiMark: 'claude' | 'cursor' | 'windsurf' | 'continue' | 'antigravity' | 'codex' | null;
  /**
   * How the user connects:
   *  • command  — a shell command (Claude Code)
   *  • deeplink — a one-click install link (Cursor, VS Code)
   *  • json     — a JSON config file edit (Windsurf, Continue, Antigravity)
   *  • toml     — a TOML config file edit + login command (Codex)
   *  • generic  — raw endpoint + standard MCP config for any other tool
   */
  kind: 'command' | 'deeplink' | 'json' | 'toml' | 'generic';
}

export const EDITORS: EditorMeta[] = [
  { id: 'claude',      label: 'Claude Code', descKey: 'connectDescClaude',      aiMark: 'claude',      kind: 'command'  },
  { id: 'cursor',      label: 'Cursor',      descKey: 'connectDescCursor',      aiMark: 'cursor',      kind: 'deeplink' },
  { id: 'vscode',      label: 'VS Code',     descKey: 'connectDescVscode',      aiMark: null,          kind: 'deeplink' },
  { id: 'codex',       label: 'Codex',       descKey: 'connectDescCodex',       aiMark: 'codex',       kind: 'toml'     },
  { id: 'windsurf',    label: 'Windsurf',    descKey: 'connectDescWindsurf',    aiMark: 'windsurf',    kind: 'json'     },
  { id: 'continue',    label: 'Continue',    descKey: 'connectDescContinue',    aiMark: 'continue',    kind: 'json'     },
  { id: 'antigravity', label: 'Antigravity', descKey: 'connectDescAntigravity', aiMark: 'antigravity', kind: 'json'     },
  { id: 'custom',      label: 'Other tool',  descKey: 'connectDescCustom',      aiMark: null,          kind: 'generic'  },
];

/** Editors that genuinely support a token-less OAuth flow on first connect. */
export const OAUTH_READY: Record<EditorId, boolean> = {
  claude:      true,
  vscode:      true,
  cursor:      true,  // works, but may prompt for manual approval — see ConnectFlow warning
  codex:       true,  // `codex mcp login remnus` runs the OAuth browser flow
  windsurf:    false,
  continue:    false,
  antigravity: false,
  custom:      true,  // presented as the default path; actual support is up to the tool
};

export const CONFIG_PATHS: Record<Exclude<EditorId, 'claude' | 'vscode' | 'custom'>, Record<OS, string>> = {
  cursor:      { mac: '~/.cursor/mcp.json',                  linux: '~/.cursor/mcp.json',                  windows: '%USERPROFILE%\\.cursor\\mcp.json' },
  codex:       { mac: '~/.codex/config.toml',                linux: '~/.codex/config.toml',                windows: '%USERPROFILE%\\.codex\\config.toml' },
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

// ── Codex (OpenAI Codex CLI) — ~/.codex/config.toml ──────────────────────────
// `codex mcp add` is stdio-only, so remote HTTP servers go straight into the
// TOML config. OAuth mode: url only, then `codex mcp login remnus`. PAT mode:
// embed the Authorization header via http_headers (static key-value).
export function buildCodexToml(mcpUrl: string, token?: string): string {
  const lines = ['[mcp_servers.remnus]', `url = "${mcpUrl}"`];
  if (token) lines.push(`http_headers = { Authorization = "Bearer ${token}" }`);
  return lines.join('\n');
}

/** Codex OAuth sign-in command — run after the server is in config.toml. */
export const CODEX_LOGIN_CMD = 'codex mcp login remnus';
