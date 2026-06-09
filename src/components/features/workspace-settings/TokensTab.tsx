'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Copy, Plus, ChevronDown, Zap, Pencil, Link2 } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { getAgentTokens, revokeAgentToken } from '@/lib/actions/agentToken';
import { AGENT_OPTIONS, type AgentId, type AgentToken } from './types';
import McpOnboarding from './McpOnboarding';
import McpCreateToken from './McpCreateToken';
import McpEditToken from './McpEditToken';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { buildCursorUrl, buildVscodeUrl } from '@/lib/mcp/deeplinks';
import ConnectFlow from '@/components/features/agents/ConnectFlow';

const GUIDES = [
  { id: 'claude'      as const, label: 'Claude Code' },
  { id: 'cursor'      as const, label: 'Cursor'       },
  { id: 'windsurf'    as const, label: 'Windsurf'     },
  { id: 'continue'    as const, label: 'Continue'     },
  { id: 'antigravity' as const, label: 'Antigravity'  },
];

type GuideId = typeof GUIDES[number]['id'];

const FILE_PATHS: Record<Exclude<GuideId, 'claude'>, Record<'mac' | 'linux' | 'windows', string>> = {
  cursor:      { mac: '~/.cursor/mcp.json',                    linux: '~/.cursor/mcp.json',                    windows: '%USERPROFILE%\\.cursor\\mcp.json' },
  windsurf:    { mac: '~/.codeium/windsurf/mcp_config.json',   linux: '~/.codeium/windsurf/mcp_config.json',   windows: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json' },
  continue:    { mac: '~/.continue/config.json',               linux: '~/.continue/config.json',               windows: '%USERPROFILE%\\.continue\\config.json' },
  antigravity: { mac: '~/.gemini/config/mcp_config.json',      linux: '~/.gemini/config/mcp_config.json',      windows: '%USERPROFILE%\\.gemini\\config\\mcp_config.json' },
};

const AGENT_TO_TOOL: Partial<Record<AgentId, 'claude' | 'cursor' | 'windsurf' | 'continue' | 'antigravity'>> = {
  'claude-code': 'claude',
  'cursor':      'cursor',
  'windsurf':    'windsurf',
  'continue':    'continue',
  'antigravity': 'antigravity',
};

interface TokensTabProps {
  workspaceId: string;
  workspaceName: string;
  hasPrivilegedAccess: boolean;
}

export default function TokensTab({ workspaceId, workspaceName, hasPrivilegedAccess }: TokensTabProps) {
  const t = useTranslations('WorkspaceSettings');

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  const claudeCliCmd = `claude mcp add --transport http --scope user remnus ${mcpUrl} --header "Authorization: Bearer <your-token>"`;
  const standardJsonConfig = JSON.stringify({ mcpServers: { remnus: { url: mcpUrl, headers: { Authorization: 'Bearer <your-token>' } } } }, null, 2);
  const antigravityJsonConfig = JSON.stringify({ mcpServers: { remnus: { serverUrl: mcpUrl, headers: { Authorization: 'Bearer <your-token>' } } } }, null, 2);
  const claudeJsonConfig = JSON.stringify({ mcpServers: { remnus: { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer <your-token>' } } } }, null, 2);
  const testPrompt = 'List all pages and databases in my Remnus workspace';

  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState<string | null>(null);
  const [newTokenAgent, setNewTokenAgent] = useState<AgentId | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeToken, setConfirmRevokeToken] = useState<AgentToken | null>(null);
  const [editingToken, setEditingToken] = useState<AgentToken | null>(null);
  const [showInactiveTokens, setShowInactiveTokens] = useState(false);
  const [cmdCopied, setCmdCopied] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuide, setActiveGuide] = useState<GuideId>('claude');
  const [claudeMode, setClaudeMode] = useState<'cli' | 'json'>('cli');
  const [os, setOs] = useState<'mac' | 'linux' | 'windows'>('mac');

  const loadTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const list = await getAgentTokens(workspaceId);
      setTokens(list as AgentToken[]);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => { loadTokens(); }, [workspaceId]);

  const newTokenPrefix = newTokenValue ? newTokenValue.split('_')[1] : null;
  const showOnboarding = !!newTokenValue && !onboardingDone;

  const formatDate = (d: Date | null) => {
    if (!d) return t('never');
    return new Date(d).toLocaleDateString();
  };

  const getExpiryState = (expiresAt: Date | null): 'expired' | 'soon' | 'ok' | 'never' => {
    if (!expiresAt) return 'never';
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) return 'expired';
    if (msLeft < 14 * 24 * 60 * 60 * 1000) return 'soon';
    return 'ok';
  };

  const formatExpiryBadge = (expiresAt: Date | null): string => {
    if (!expiresAt) return t('tokenExpiryForever');
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) return t('tokenExpired');
    return t('tokenExpiresInDays', { days: Math.ceil(msLeft / (1000 * 60 * 60 * 24)) });
  };

  const handleCopyToken = (value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doRevokeToken = async () => {
    if (!confirmRevokeToken) return;
    const tokenId = confirmRevokeToken.id;
    setConfirmRevokeToken(null);
    setRevokingId(tokenId);
    try {
      await revokeAgentToken(tokenId);
      loadTokens();
    } catch (err) {
      console.error(err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyCmd = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCmdCopied(key);
      setTimeout(() => setCmdCopied(null), 2000);
    });
  };

  const renderCodeBlock = () => {
    let code: string;
    let hint: string;
    let filePath: string | undefined;
    let codeKey: string;
    let isCmd = false;

    if (activeGuide === 'claude') {
      codeKey = `claude-${claudeMode}`;
      if (claudeMode === 'cli') {
        code = claudeCliCmd; hint = t('integrateCliStep'); isCmd = true;
      } else {
        code = claudeJsonConfig; hint = t('integrateJsonStep'); filePath = '.mcp.json';
      }
    } else if (activeGuide === 'antigravity') {
      codeKey = activeGuide;
      code = antigravityJsonConfig; hint = t('integrateJsonStep'); filePath = FILE_PATHS[activeGuide][os];
    } else {
      codeKey = activeGuide;
      code = standardJsonConfig; hint = t('integrateJsonStep'); filePath = FILE_PATHS[activeGuide][os];
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-neutral-400">{hint}</p>
          {filePath && (
            <code className="shrink-0 text-[10px] text-neutral-300 font-mono bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
              {filePath}
            </code>
          )}
        </div>
        <div className="relative group">
          {isCmd ? (
            <code className="block bg-neutral-950 border border-neutral-800 rounded-md px-4 py-3 text-[11px] text-sky-400 font-mono break-all leading-relaxed">
              {code}
            </code>
          ) : (
            <pre className="bg-neutral-950 border border-neutral-800 rounded-md px-4 py-3 text-[11px] text-sky-400 font-mono overflow-x-auto leading-relaxed">
              {code}
            </pre>
          )}
          <button
            onClick={() => handleCopyCmd(codeKey, code)}
            className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-neutral-800/90 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded border border-neutral-700 transition-all opacity-0 group-hover:opacity-100"
          >
            {cmdCopied === codeKey ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
            {cmdCopied === codeKey ? t('copied') : t('copyToken')}
          </button>
        </div>
      </div>
    );
  };

  // ── Early returns for full-screen flows ──────────────────────────────────────

  if (showConnect) {
    return (
      <ConnectFlow
        mcpUrl={mcpUrl}
        onClose={() => { setShowConnect(false); loadTokens(); }}
        mintTargets={hasPrivilegedAccess ? [{ id: workspaceId, name: workspaceName }] : []}
      />
    );
  }

  if (showOnboarding && newTokenValue) {
    return (
      <McpOnboarding
        token={newTokenValue}
        tokenName={newTokenName ?? undefined}
        initialTool={newTokenAgent ? AGENT_TO_TOOL[newTokenAgent] : undefined}
        mcpUrl={mcpUrl}
        onDismiss={() => setOnboardingDone(true)}
      />
    );
  }

  if (showCreateFlow && hasPrivilegedAccess) {
    return (
      <McpCreateToken
        workspaceId={workspaceId}
        onCreated={(token, name, agent) => {
          setShowCreateFlow(false);
          setNewTokenValue(token);
          setNewTokenName(name);
          setNewTokenAgent(agent);
          setOnboardingDone(false);
          loadTokens();
        }}
        onDismiss={() => setShowCreateFlow(false)}
      />
    );
  }

  if (editingToken && hasPrivilegedAccess) {
    return (
      <McpEditToken
        token={editingToken}
        onSaved={() => { setEditingToken(null); loadTokens(); }}
        onDismiss={() => setEditingToken(null)}
      />
    );
  }

  // ── Normal view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {hasPrivilegedAccess ? (
        <div className="space-y-4">
          {/* ── Hero — always visible ── */}
          <div className="border border-amber-500/20 rounded-xl p-5 space-y-4 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={16} className="text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-neutral-100">{t('mcpHeroTitle')}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{t('mcpHeroSubtitle')}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">{t('connectHeroDesc')}</p>

            {/* Primary CTA: opens the editor connect flow (OAuth + token) */}
            <button
              onClick={() => setShowConnect(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 px-5 py-3 rounded-lg shadow-[0_0_20px_-6px_rgba(68,92,149,0.6)] transition-colors"
            >
              <Link2 size={16} />
              {t('connectButton')}
            </button>
          </div>

          {/* ── Token list ── */}
          {isLoadingTokens ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
            </div>
          ) : tokens.length > 0 ? (
            <div className="space-y-2">
              {(() => {
                const inactiveCount = tokens.filter(tk => !!tk.revokedAt || getExpiryState(tk.expiresAt) === 'expired').length;
                const visibleTokens = showInactiveTokens
                  ? tokens
                  : tokens.filter(tk => !tk.revokedAt && getExpiryState(tk.expiresAt) !== 'expired');
                return (
                  <>
                    {inactiveCount > 0 && (
                      <button
                        onClick={() => setShowInactiveTokens(v => !v)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${showInactiveTokens ? 'bg-neutral-600 border-neutral-500' : 'border-neutral-600'}`}>
                          {showInactiveTokens && <Check size={9} />}
                        </span>
                        {showInactiveTokens ? t('hideInactiveTokens') : t('showInactiveTokens', { count: inactiveCount })}
                      </button>
                    )}
                    {visibleTokens.length > 0 && (
                      <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/20">
                        {visibleTokens.map((token) => {
                          const isRevoked = !!token.revokedAt;
                          const isRevoking = revokingId === token.id;
                          const isNew = newTokenPrefix === token.tokenPrefix;
                          const expiryState = getExpiryState(token.expiresAt);
                          const expiryLabel = formatExpiryBadge(token.expiresAt);
                          const expiryCls =
                            expiryState === 'expired' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                            expiryState === 'soon'    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            expiryState === 'ok'      ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                                                        'text-neutral-500 bg-neutral-800 border-neutral-700';
                          const agent = AGENT_OPTIONS.find(a => a.id === token.agentName);
                          return (
                            <div key={token.id} className="flex flex-col">
                              <div className="flex items-center justify-between p-3 gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-semibold truncate ${isRevoked ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>
                                      {token.name}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                      isRevoked ? 'text-neutral-500 bg-neutral-800 border-neutral-700'
                                        : token.scope === 'write' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                        : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    }`}>
                                      {isRevoked ? t('revoked') : token.scope === 'write' ? t('tokenScopeWrite') : t('tokenScopeRead')}
                                    </span>
                                    {agent && !isRevoked && (
                                      <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded-full shrink-0">
                                        <AIMark name={agent.aiMarkName} size={10} />
                                        {agent.label}
                                      </span>
                                    )}
                                    {!isRevoked && (
                                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${expiryCls}`}>
                                        {expiryLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                                    {token.tokenPrefix}… · {t('lastUsed')}: {formatDate(token.lastUsedAt)}
                                  </p>
                                </div>
                                {!isRevoked && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => setEditingToken(token)}
                                      title={t('editToken')}
                                      className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded border border-neutral-700 transition-colors flex items-center gap-1"
                                    >
                                      <Pencil size={10} />
                                      {t('editToken')}
                                    </button>
                                    <button
                                      onClick={() => setConfirmRevokeToken(token)}
                                      disabled={isRevoking}
                                      className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/20 transition-colors disabled:opacity-50"
                                    >
                                      {isRevoking ? t('revoking') : t('revokeToken')}
                                    </button>
                                  </div>
                                )}
                              </div>
                              {/* Inline copy card shown after onboarding dismissed */}
                              {isNew && newTokenValue && (
                                <div className="mx-3 mb-3 border border-amber-500/30 bg-amber-500/5 rounded-md p-3 space-y-2">
                                  <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                                    <AlertCircle size={11} /> {t('tokenCreatedHint')}
                                  </p>
                                  <div className="flex gap-2">
                                    <code className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-[11px] text-sky-400 font-mono break-all select-all">
                                      {newTokenValue}
                                    </code>
                                    <button
                                      onClick={() => handleCopyToken(newTokenValue)}
                                      className="shrink-0 flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded border border-neutral-700 transition-colors"
                                    >
                                      {copied ? <Check size={12} className="text-sky-400" /> : <Copy size={12} />}
                                      {copied ? t('copied') : t('copyToken')}
                                    </button>
                                  </div>
                                  <div className="pt-0.5 space-y-1.5">
                                    <p className="text-[10px] text-neutral-400">{t('installIn')}</p>
                                    <div className="flex gap-2 flex-wrap">
                                      <a
                                        href={buildCursorUrl(mcpUrl, newTokenValue)}
                                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-200 px-3 py-1.5 rounded transition-colors"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-300">
                                          <path d="M3 3l9 9-9 9h4l7-7.5V12l-7-7.5H3zm10 0l9 9-9 9h4l7-7.5V12l-7-7.5h-4z"/>
                                        </svg>
                                        {t('installCursor')}
                                      </a>
                                      <a
                                        href={buildVscodeUrl(mcpUrl, newTokenValue)}
                                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-200 px-3 py-1.5 rounded transition-colors"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                                          <path d="M17.583.063L9.963 7.087 4.19 2.383 2 3.436v17.125l2.19 1.054 5.773-4.704 7.62 7.026L22 22.564V1.436L17.583.063zM20 19.437l-6-5.453v-3.97l6-5.451v14.874zM4 19.204V4.797l4 3.26v7.888L4 19.204z"/>
                                        </svg>
                                        {t('installVSCode')}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => setShowCreateFlow(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-blue-400 border border-dashed border-neutral-700 hover:border-blue-500/40 px-4 py-2.5 rounded-lg transition-colors"
                    >
                      <Plus size={13} />
                      {t('createToken')}
                    </button>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-neutral-500 italic">{t('ownerOnlyTokens')}</p>
      )}

      {/* ── Static integration guide ── */}
      <div className="border-t border-neutral-800 pt-4">
        <button
          onClick={() => setShowGuide(v => !v)}
          className="w-full flex items-center justify-between group py-1"
        >
          <span className="text-[11px] font-semibold text-neutral-300 group-hover:text-white transition-colors uppercase tracking-widest">
            {t('integrateSetup')}
          </span>
          <ChevronDown
            size={14}
            className={`text-neutral-400 group-hover:text-neutral-200 transition-all ${showGuide ? 'rotate-180' : ''}`}
          />
        </button>

        {showGuide && (
          <div className="mt-4 space-y-4">
            <p className="text-[11px] text-neutral-400 leading-relaxed">{t('integrateHint')}</p>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400 mr-1">OS:</span>
              {(['mac', 'linux', 'windows'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setOs(key)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${
                    os === key
                      ? 'bg-neutral-700 border-neutral-600 text-neutral-100'
                      : 'border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                  }`}
                >
                  {key === 'mac' ? 'macOS' : key === 'linux' ? 'Linux' : 'Windows'}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
              {GUIDES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveGuide(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                    activeGuide === id ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <AIMark name={id} size={12} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {activeGuide === 'claude' && (
              <div className="flex gap-1 w-fit border border-neutral-800 rounded-md p-0.5 bg-neutral-900">
                {(['cli', 'json'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setClaudeMode(mode)}
                    className={`px-3 py-1 rounded text-[10px] font-semibold transition-colors ${
                      claudeMode === mode ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {mode === 'cli' ? 'CLI' : 'JSON'}
                  </button>
                ))}
              </div>
            )}

            {renderCodeBlock()}

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 space-y-2">
              <span className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wider">
                {t('integrateTestPrompt')}
              </span>
              <p className="text-[10px] text-neutral-400">{t('integrateTestHint')}</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[11px] text-neutral-200 italic bg-neutral-950 border border-neutral-700 rounded px-3 py-2 leading-relaxed">
                  &ldquo;{testPrompt}&rdquo;
                </p>
                <button
                  onClick={() => handleCopyCmd('test', testPrompt)}
                  className="shrink-0 flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-2 py-2 rounded border border-neutral-700 transition-colors"
                >
                  {cmdCopied === 'test' ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmRevokeToken && (
        <ConfirmDialog
          title={t('revokeToken')}
          description={t('removeConfirm', { name: confirmRevokeToken.name })}
          confirmLabel={t('revokeToken')}
          cancelLabel={t('cancel')}
          onConfirm={doRevokeToken}
          onCancel={() => setConfirmRevokeToken(null)}
        />
      )}
    </div>
  );
}
