'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { Check, Copy, ArrowRight, ChevronLeft, ChevronDown, X, KeyRound, Globe, AlertCircle, AlertTriangle, Plug, Sparkles, Loader2, Wrench, PartyPopper, Send } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { VscodeMark } from '@/components/features/agents/AgentMark';
import ClaudeConnectAnimation from '@/components/features/agents/ClaudeConnectAnimation';
import PageIcon from '@/components/features/PageIcon';
import { mintAgentToken } from '@/lib/actions/agentToken';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  EDITORS, OAUTH_READY, CONFIG_PATHS, CODEX_LOGIN_CMD,
  buildCursorUrl, buildVscodeUrl, buildClaudeCmd, buildJsonConfig, buildCodexToml,
  type EditorId, type OS,
} from '@/lib/mcp/deeplinks';

/** Workspaces the user can mint a PAT in (passed down through ConnectModal from AgentsModal). */
export interface MintTarget { id: string; name: string; icon?: string | null; iconColor?: string | null }

// ── Workspace picker — icon list (mirrors the OAuth authorize page's picker) ──
function WorkspacePicker({
  targets, value, onChange, accent,
}: {
  targets: MintTarget[];
  value: string;
  onChange: (id: string) => void;
  accent: 'blue' | 'emerald';
}) {
  const activeCls = accent === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-blue-500/10 border-blue-500/40';
  const activeText = accent === 'emerald' ? 'text-emerald-100' : 'text-blue-100';
  const activeCheck = accent === 'emerald' ? 'text-emerald-400' : 'text-blue-400';
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
      {targets.map(w => {
        const active = value === w.id;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onChange(w.id)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-all ${
              active ? activeCls : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {w.icon
              ? <PageIcon icon={w.icon} iconColor={w.iconColor} size={15} />
              : <span className="w-4 h-4 rounded bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-300 shrink-0">
                  {w.name.charAt(0).toUpperCase()}
                </span>
            }
            <span className={`flex-1 text-xs truncate ${active ? activeText : 'text-neutral-300'}`}>
              {w.name}
            </span>
            {active && <Check size={13} className={`${activeCheck} shrink-0`} />}
          </button>
        );
      })}
    </div>
  );
}

function EditorMark({ id, size = 14 }: { id: EditorId; size?: number }) {
  const meta = EDITORS.find(e => e.id === id);
  if (id === 'custom') return <Plug size={size} className="text-blue-400" />;
  if (id === 'vscode' || !meta?.aiMark) return <VscodeMark size={size} />;
  return <AIMark name={meta.aiMark} size={size} />;
}

// ── Copyable code/command block ──────────────────────────────────────────────
function CodeBlock({
  code, isCmd, filePath, hint, t,
}: {
  code: string;
  isCmd: boolean;
  filePath?: string;
  hint: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-neutral-400">{hint}</p>
        {filePath && (
          <code className="shrink-0 text-[10px] text-neutral-300 font-mono bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
            {filePath}
          </code>
        )}
      </div>
      <div className="relative">
        {isCmd ? (
          <code className="block bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-[11px] text-sky-400 font-mono break-all leading-relaxed pr-20">
            {code}
          </code>
        ) : (
          <pre className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-[11px] text-sky-400 font-mono overflow-x-auto leading-relaxed">
            {code}
          </pre>
        )}
        <button
          onClick={copy}
          className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded border border-neutral-700 transition-colors"
        >
          {copied ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
          {copied ? t('copied') : t('copyToken')}
        </button>
      </div>
    </div>
  );
}

// ── Step 1: choose editor ─────────────────────────────────────────────────────
function StepChoose({
  t, onSelect, current, detected,
}: {
  t: ReturnType<typeof useTranslations>;
  onSelect: (id: EditorId) => void;
  current?: EditorId;
  /** Editor ids Tauri found on this device (desktop shell only) — shows a "detected" badge. */
  detected?: Record<string, boolean> | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {t('connectStep', { current: 1, total: 3 })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100">{t('connectChooseTitle')}</h3>
        <p className="text-[11px] text-neutral-400">{t('connectChooseHint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EDITORS.map(({ id, label, descKey }) => {
          const selected = current === id;
          const isDetected = !!detected?.[id];
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                selected
                  ? 'bg-blue-500/15 border-blue-500/50 shadow-[0_0_18px_rgba(68,92,149,0.3)]'
                  : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 hover:-translate-y-0.5'
              }`}
            >
              <span
                className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                  selected
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-neutral-950/60 border-neutral-800 group-hover:border-neutral-700'
                }`}
              >
                <EditorMark id={id} size={22} />
              </span>
              <span className="min-w-0 flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold ${selected ? 'text-blue-100' : 'text-neutral-200 group-hover:text-white'}`}>
                    {label}
                  </span>
                  {isDetected && (
                    <span className="shrink-0 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-full leading-none">
                      {t('connectDetectedBadge')}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-snug text-neutral-400">
                  {t(descKey as Parameters<typeof t>[0])}
                </span>
              </span>
              {selected && (
                <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: connect (OAuth primary + advanced PAT) ────────────────────────────
function StepConnect({
  t, editor, mcpUrl, onNext, onBack, mintTargets, detected, autoConnectReady, onAutoConnected,
}: {
  t: ReturnType<typeof useTranslations>;
  editor: EditorId;
  mcpUrl: string;
  onNext: () => void;
  onBack: () => void;
  mintTargets: MintTarget[];
  /** Whether Tauri found this editor on this device (desktop shell only). */
  detected?: boolean;
  /**
   * Whether the desktop shell's `agent_connect.rs` commands are confirmed
   * present (a successful `detect_installed_agents` call already landed) — NOT
   * just whether we're running in Tauri. The frontend ships instantly on every
   * web deploy, but these Rust commands only exist once the user has actually
   * updated their installed desktop app, so `isTauri` alone would show the
   * auto-connect button to users on an older build and fail when clicked.
   */
  autoConnectReady?: boolean;
  /** Called with the editor's label right after a successful auto-connect, before advancing to the test step. */
  onAutoConnected?: (toolLabel: string) => void;
}) {
  const [os, setOs] = useState<OS>('mac');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const meta = EDITORS.find(e => e.id === editor)!;
  const oauthReady = OAUTH_READY[editor];
  // Editors Remnus can connect for the user directly from the desktop shell:
  // json/toml editors get their config file written, Claude Code gets its CLI
  // run — vs. deeplink editors (cursor/vscode) which are already one click.
  const autoConnectEligible = meta.kind === 'json' || meta.kind === 'toml' || meta.kind === 'command';
  // When true, auto-connect is the primary path and everything manual
  // (walkthrough animation, OAuth/config instructions, advanced token section)
  // collapses behind a "connect it yourself" toggle instead of always showing.
  const autoAvailable = !!autoConnectReady && autoConnectEligible;

  // ── Inline token minting state ──
  const [selectedWs, setSelectedWs] = useState(mintTargets[0]?.id ?? '');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [minting, setMinting] = useState(false);
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [mintError, setMintError] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);

  const canMint = mintTargets.length > 0;

  const handleMint = async () => {
    if (!selectedWs) return;
    setMinting(true);
    setMintError('');
    try {
      // Pass the editor id as the canonical agent id so the right brand icon renders.
      // 'custom' isn't a real brand id — leave it unset so it falls back to a generic icon.
      const res = await mintAgentToken(selectedWs, meta.label, scope, editor === 'custom' ? undefined : editor);
      setMintedToken(res.token);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setMinting(false);
    }
  };

  // ── Desktop-only one-click connect: writes the config file / runs the CLI
  // directly via Tauri, instead of asking the user to copy-paste. Manual
  // instructions below are never hidden — this is purely additive. ──
  const [autoConnecting, setAutoConnecting] = useState(false);
  const [autoResult, setAutoResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleAutoConnect = async () => {
    setAutoConnecting(true);
    setAutoResult(null);
    try {
      // Auto-connect always mints a real token instead of pointing at OAuth —
      // the user is already signed in right here, so there's no reason to make
      // the external tool go run its own browser OAuth dance on first use when
      // we can just hand it working credentials directly. (OAuth is still
      // available as an option in the manual/"connect it yourself" section.)
      if (!canMint) throw new Error(t('connectTokenNoAccess'));
      if (!selectedWs) throw new Error(t('connectAutoPickWorkspaceFirst'));
      const minted = await mintAgentToken(selectedWs, meta.label, scope, editor);
      setMintedToken(minted.token);

      const { invoke } = await import('@tauri-apps/api/core');
      if (meta.kind === 'command') {
        const res = await invoke<{ success: boolean; stdout: string; stderr: string }>('run_claude_connect', {
          mcpUrl,
          token: minted.token,
        });
        if (!res.success) throw new Error(res.stderr.trim() || res.stdout.trim() || 'unknown error');
      } else {
        await invoke('write_agent_config', { editor, mcpUrl, token: minted.token });
      }
      setAutoResult({ ok: true, message: t('connectAutoSuccess', { tool: meta.label }) });
      // Let the success message land for a beat, then advance automatically —
      // the user already has a working connection, no need to make them click Next.
      onAutoConnected?.(meta.label);
      setTimeout(onNext, 900);
    } catch (err) {
      setAutoResult({ ok: false, message: t('connectAutoError', { error: err instanceof Error ? err.message : String(err) }) });
    } finally {
      setAutoConnecting(false);
    }
  };

  const copyToken = () => {
    if (!mintedToken) return;
    navigator.clipboard.writeText(mintedToken).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  // ── OAuth-mode artifact (token-less) ──
  const renderOAuth = () => {
    if (meta.kind === 'command') {
      // Claude Code — run command, OAuth auto-triggers on first 401
      return (
        <>
          <CodeBlock code={buildClaudeCmd(mcpUrl)} isCmd hint={t('connectRunCommand')} t={t} />
          <p className="text-[11px] text-neutral-400 flex items-start gap-1.5">
            <Globe size={12} className="text-blue-400 shrink-0 mt-0.5" />
            {t('connectClaudeOAuthHint')}
          </p>
        </>
      );
    }
    if (meta.kind === 'deeplink') {
      const href = editor === 'cursor' ? buildCursorUrl(mcpUrl) : buildVscodeUrl(mcpUrl);
      return (
        <div className="space-y-2">
          <a
            href={href}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2.5 rounded-lg transition-colors"
          >
            <EditorMark id={editor} size={14} />
            {t('connectOpenIn', { tool: meta.label })}
          </a>
          {editor === 'cursor' && (
            <p className="text-[11px] text-amber-400/90 flex items-start gap-1.5">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              {t('connectCursorOAuthWarn')}
            </p>
          )}
        </div>
      );
    }
    if (meta.kind === 'toml') {
      // Codex — add the server to config.toml, then sign in with one command.
      return (
        <div className="space-y-3">
          <CodeBlock
            code={buildCodexToml(mcpUrl)}
            isCmd={false}
            filePath={CONFIG_PATHS.codex[os]}
            hint={t('connectAddToFile')}
            t={t}
          />
          <CodeBlock code={CODEX_LOGIN_CMD} isCmd hint={t('connectCodexLoginHint')} t={t} />
        </div>
      );
    }
    if (meta.kind === 'generic') {
      // Any other MCP-capable tool — give them the raw endpoint + a standard config.
      return (
        <div className="space-y-3">
          <CodeBlock code={mcpUrl} isCmd hint={t('connectEndpointLabel')} t={t} />
          <p className="text-[11px] text-neutral-400 leading-relaxed">{t('connectCustomHint')}</p>
          <CodeBlock code={buildJsonConfig('custom', mcpUrl)} isCmd={false} hint={t('connectGenericConfig')} t={t} />
        </div>
      );
    }
    // json-only editors (windsurf / continue / antigravity) — not OAuth-ready
    return (
      <CodeBlock
        code={buildJsonConfig(editor, mcpUrl)}
        isCmd={false}
        filePath={CONFIG_PATHS[editor as Exclude<EditorId, 'claude' | 'vscode' | 'custom'>][os]}
        hint={t('connectAddToFile')}
        t={t}
      />
    );
  };

  // ── PAT-mode artifact: built with the freshly-minted token ──
  const renderTokenArtifact = (token: string) => {
    // Token mode: deeplinks embed the header and work directly.
    if (meta.kind === 'deeplink') {
      const href = editor === 'cursor' ? buildCursorUrl(mcpUrl, token) : buildVscodeUrl(mcpUrl, token);
      return (
        <a
          href={href}
          className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg transition-colors"
        >
          <EditorMark id={editor} size={14} />
          {t('connectOpenIn', { tool: meta.label })}
        </a>
      );
    }
    if (meta.kind === 'command') {
      return <CodeBlock code={buildClaudeCmd(mcpUrl, token)} isCmd hint={t('connectRunCommand')} t={t} />;
    }
    if (meta.kind === 'toml') {
      return (
        <CodeBlock
          code={buildCodexToml(mcpUrl, token)}
          isCmd={false}
          filePath={CONFIG_PATHS.codex[os]}
          hint={t('connectAddToFile')}
          t={t}
        />
      );
    }
    if (meta.kind === 'generic') {
      return <CodeBlock code={buildJsonConfig('custom', mcpUrl, token)} isCmd={false} hint={t('connectGenericConfig')} t={t} />;
    }
    return (
      <CodeBlock
        code={buildJsonConfig(editor, mcpUrl, token)}
        isCmd={false}
        filePath={CONFIG_PATHS[editor as Exclude<EditorId, 'claude' | 'vscode' | 'custom'>][os]}
        hint={t('connectAddToFile')}
        t={t}
      />
    );
  };

  // ── Advanced section body: mint form → minted-token artifact ──
  const renderToken = () => {
    if (!canMint) {
      return <p className="text-[11px] text-neutral-500 italic">{t('connectTokenNoAccess')}</p>;
    }

    if (mintedToken) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-1.5 text-[11px] text-amber-400">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{t('connectTokenCreated')}</span>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-[11px] text-sky-400 font-mono break-all select-all">
              {mintedToken}
            </code>
            <button
              onClick={copyToken}
              className="shrink-0 flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded border border-neutral-700 transition-colors"
            >
              {tokenCopied ? <Check size={12} className="text-sky-400" /> : <Copy size={12} />}
              {tokenCopied ? t('copied') : t('copyToken')}
            </button>
          </div>
          {renderTokenArtifact(mintedToken)}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-[11px] text-neutral-400 leading-relaxed">{t('connectTokenHint')}</p>

        {/* Workspace picker (only when more than one) */}
        {mintTargets.length > 1 && (
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
              {t('connectTokenWorkspaceLabel')}
            </label>
            <WorkspacePicker targets={mintTargets} value={selectedWs} onChange={setSelectedWs} accent="blue" />
          </div>
        )}

        {/* Scope */}
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
            {t('mcpCreateScopeLabel')}
          </label>
          <div className="flex gap-2">
            {(['read', 'write'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                  scope === s
                    ? s === 'write'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                }`}
              >
                {s === 'read' ? t('tokenScopeRead') : t('tokenScopeWrite')}
              </button>
            ))}
          </div>
        </div>

        {mintError && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {mintError}
          </p>
        )}

        <button
          onClick={handleMint}
          disabled={minting || !selectedWs}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
        >
          <KeyRound size={12} />
          {minting ? t('creating') : t('connectGenerateToken')}
        </button>
      </div>
    );
  };

  const needsOs = meta.kind === 'json' || meta.kind === 'toml' || (showAdvanced && editor === 'cursor');

  // Everything manual: OS selector, the Claude Code walkthrough animation, the
  // OAuth/config instructions, and the advanced token section. Shown directly
  // when auto-connect isn't available (web, or a deeplink/generic editor);
  // collapsed behind a toggle when it is, since auto-connect is now the
  // primary path and most desktop users won't need to look at this.
  const manualContent = (
    <>
      {/* OS selector (only when a file path is shown) */}
      {needsOs && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500 mr-1">OS</span>
          {(['mac', 'linux', 'windows'] as OS[]).map(k => (
            <button
              key={k}
              onClick={() => setOs(k)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${
                os === k ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'border-neutral-700 text-neutral-500 hover:text-neutral-200 hover:border-neutral-600'
              }`}
            >
              {k === 'mac' ? 'macOS' : k === 'linux' ? 'Linux' : 'Windows'}
            </button>
          ))}
        </div>
      )}

      {/* Animated walkthrough — Claude Code only, above Quick connect */}
      {editor === 'claude' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
            {t('connectAnimTitle')}
          </p>
          <ClaudeConnectAnimation mcpUrl={mcpUrl} />
        </div>
      )}

      {/* Primary: OAuth */}
      <div className="border border-blue-500/20 rounded-xl p-4 bg-blue-500/5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-blue-400" />
          <span className="text-xs font-semibold text-neutral-100">
            {oauthReady ? t('connectOAuthTitle') : t('connectConfigTitle')}
          </span>
          {oauthReady && (
            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
              {t('connectRecommended')}
            </span>
          )}
        </div>
        {oauthReady && <p className="text-[11px] text-neutral-400 leading-relaxed">{t('connectOAuthDesc')}</p>}
        {renderOAuth()}
      </div>

      {/* Advanced: token */}
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 group"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-200 transition-colors">
            <KeyRound size={12} />
            {t('connectAdvancedToggle')}
          </span>
          <ChevronDown size={13} className={`text-neutral-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {showAdvanced && <div className="px-4 pb-4">{renderToken()}</div>}
      </div>

      {/* Manual completion — only needed here: unlike auto-connect, these steps
          don't self-report success, so the user tells us when they're done.
          Lives in the main Nav row when auto-connect isn't available (see below). */}
      {autoAvailable && (
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="flex items-center gap-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-md transition-colors"
          >
            {t('connectNext')} <ArrowRight size={13} />
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {t('connectStep', { current: 2, total: 3 })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
          {t('connectConnectTitle', { tool: meta.label })}
          <EditorMark id={editor} size={14} />
        </h3>
      </div>

      {/* Desktop-only: one-click auto-connect via Tauri. The primary path when
          available — everything manual moves into the collapse below. */}
      {autoAvailable && (
        <div className="border border-emerald-500/25 rounded-xl p-4 bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-neutral-100">{t('connectAutoHeading')}</span>
            {detected && (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                {t('connectDetectedBadge')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">{t('connectAutoDesc', { tool: meta.label })}</p>

          {!canMint ? (
            <p className="text-[11px] text-neutral-500 italic">{t('connectTokenNoAccess')}</p>
          ) : (
            <>
              {mintTargets.length > 1 && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                    {t('connectTokenWorkspaceLabel')}
                  </label>
                  <WorkspacePicker targets={mintTargets} value={selectedWs} onChange={setSelectedWs} accent="emerald" />
                </div>
              )}

              <button
                onClick={handleAutoConnect}
                disabled={autoConnecting || !selectedWs}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
              >
                {autoConnecting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {autoConnecting ? t('connectAutoRunning') : t('connectAutoButton')}
              </button>
            </>
          )}

          {autoResult && (
            <p className={`text-[11px] flex items-start gap-1.5 ${autoResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {autoResult.ok ? <Check size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
              {autoResult.message}
            </p>
          )}
        </div>
      )}

      {/* Manual path: direct when auto-connect isn't available, collapsed behind
          a toggle when it is (auto-connect is the primary path in that case). */}
      {autoAvailable ? (
        <div className="border border-neutral-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowManual(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 group"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-200 transition-colors">
              <Wrench size={12} />
              {t('connectManualToggle')}
            </span>
            <ChevronDown size={13} className={`text-neutral-500 transition-transform ${showManual ? 'rotate-180' : ''}`} />
          </button>
          {showManual && <div className="px-4 pb-4 space-y-4">{manualContent}</div>}
        </div>
      ) : (
        manualContent
      )}

      {/* Nav — the primary "Next" moves into the manual collapse above when
          auto-connect is available (it already advances on its own success). */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {!autoAvailable && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-md transition-colors"
          >
            {t('connectNext')} <ArrowRight size={13} />
          </button>
        )}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ChevronLeft size={12} /> {t('mcpOnboardBack')}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: test ───────────────────────────────────────────────────────────────
function StepTest({
  t, onDone, onBack, autoConnectedTool, toolLabel,
}: {
  t: ReturnType<typeof useTranslations>;
  onDone: () => void;
  onBack: () => void;
  /** Set when this step was reached via a successful auto-connect — shows a completion banner. */
  autoConnectedTool?: string | null;
  /** The chosen editor's display name — used in the "send this to X" action hint. */
  toolLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const testPrompt = t('connectTestPrompt');
  const copy = () => {
    navigator.clipboard.writeText(testPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {t('connectStep', { current: 3, total: 3 })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100">{t('connectTestTitle')}</h3>
        <p className="text-[11px] text-neutral-400">{t('connectTestHint')}</p>
      </div>

      {autoConnectedTool && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <span className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <PartyPopper size={17} className="text-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-100">{t('connectAutoCompleteTitle')}</p>
            <p className="text-[11px] text-emerald-400/80">{t('connectAutoCompleteHint', { tool: autoConnectedTool })}</p>
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <p className="flex-1 text-[11px] text-neutral-200 italic bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-3 leading-relaxed">
          &ldquo;{testPrompt}&rdquo;
        </p>
        <button
          onClick={copy}
          className="shrink-0 flex flex-col items-center justify-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-3 rounded-lg border border-neutral-700 transition-colors"
        >
          {copied ? <Check size={13} className="text-sky-400" /> : <Copy size={13} />}
          <span>{copied ? t('copied') : t('copyToken')}</span>
        </button>
      </div>

      <p className="text-[11px] text-neutral-500 leading-relaxed flex items-start gap-1.5">
        <Send size={12} className="text-neutral-600 shrink-0 mt-0.5" />
        {t('connectTestAction', { tool: toolLabel })}
      </p>

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          onClick={onDone}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-md transition-colors"
        >
          <Check size={13} /> {t('connectDone')}
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors ml-auto"
        >
          <ChevronLeft size={12} /> {t('mcpOnboardBack')}
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
interface Props {
  mcpUrl: string;
  onClose: () => void;
  /** Workspaces the user can mint a PAT in. Empty = token mode unavailable. */
  mintTargets?: MintTarget[];
  /** When true, render only the step body (no outer card/header). Used by ConnectModal, which supplies its own chrome. */
  bare?: boolean;
  /** Where the flow was opened from, for funnel attribution ('onboarding' | 'agents_modal' | 'workspace_settings'). */
  source?: string;
}

export default function ConnectFlow({ mcpUrl, onClose, mintTargets = [], bare = false, source = 'unknown' }: Props) {
  const t = useTranslations('WorkspaceSettings');
  const posthog = usePostHog();
  const isTauri = useIsTauri();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editor, setEditor] = useState<EditorId | null>(null);
  const [detected, setDetected] = useState<Record<string, boolean> | null>(null);
  // True only once a real `agent_connect.rs` command call has actually
  // succeeded — NOT just "we're in Tauri". The frontend deploys instantly on
  // every web push, but these Rust commands only exist in the compiled binary
  // once the user has updated their installed desktop app; without this check
  // a user on an older build would see the auto-connect button and have it
  // fail on click instead of just not seeing it.
  const [autoConnectReady, setAutoConnectReady] = useState(false);
  // Set right before auto-advancing from a successful auto-connect — shows a
  // completion banner on the test step instead of a plain, unexplained jump.
  const [autoConnectedTool, setAutoConnectedTool] = useState<string | null>(null);

  // Funnel (in-app): the connect flow was opened — top of the agent-add funnel.
  // posthog-js honors the user's consent state, so no extra gating is needed here.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    posthog?.capture('connect_flow_opened', { source });
  }, [posthog, source]);

  // Desktop-only: which AI tools Tauri found on this device, fetched once per
  // open. Powers the "detected" badges and the auto-connect blocks in StepConnect.
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const rows = await invoke<{ id: string; detected: boolean }[]>('detect_installed_agents');
        if (cancelled) return;
        setDetected(Object.fromEntries(rows.map(r => [r.id, r.detected])));
        setAutoConnectReady(true); // the call succeeded — this build has agent_connect.rs
      } catch {
        // not in the desktop shell, or an older build without agent_connect.rs —
        // no badges, no auto-connect button, manual flow unaffected
      }
    })();
    return () => { cancelled = true; };
  }, [isTauri]);

  const selectEditor = (id: EditorId) => {
    posthog?.capture('connect_editor_selected', { editor: id, source });
    setEditor(id);
    setAutoConnectedTool(null);
    setStep(2);
  };

  const finish = () => {
    // Funnel: user self-reports the connection is done (vs the server-side `agent_call`
    // that proves a real tool call landed). The gap between the two = "thinks they're
    // connected but no call arrived".
    posthog?.capture('connect_completed', { editor: editor ?? null, source });
    onClose();
  };

  const steps = (
    // key={step} remounts on each transition so the fade/slide-in replays.
    <div key={step} className="animate-step-in">
      {step === 1 && (
        <StepChoose t={t} current={editor ?? undefined} onSelect={selectEditor} detected={detected} />
      )}
      {step === 2 && editor && (
        <StepConnect
          t={t}
          editor={editor}
          mcpUrl={mcpUrl}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          mintTargets={mintTargets}
          detected={!!detected?.[editor]}
          autoConnectReady={autoConnectReady}
          onAutoConnected={setAutoConnectedTool}
        />
      )}
      {step === 3 && editor && (
        <StepTest
          t={t}
          onDone={finish}
          onBack={() => setStep(2)}
          autoConnectedTool={autoConnectedTool}
          toolLabel={EDITORS.find(e => e.id === editor)?.label ?? ''}
        />
      )}
    </div>
  );

  if (bare) return steps;

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-800">
        <span className="text-xs font-semibold text-neutral-200">{t('connectTitle')}</span>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded">
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-5">{steps}</div>
    </div>
  );
}
