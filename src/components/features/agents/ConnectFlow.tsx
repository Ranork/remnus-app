'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { Check, Copy, ChevronLeft, ChevronDown, X, KeyRound, Globe, AlertCircle, AlertTriangle, Plug, Sparkles, Wrench, PartyPopper, Send, BookOpen } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { cn } from '@/lib/cn';

/** Workspaces the user can mint a PAT in (passed down through ConnectModal from AgentsModal). */
export interface MintTarget { id: string; name: string; icon?: string | null; iconColor?: string | null }

/** A block of the flow that is one choice or one set of instructions. */
const PANEL = 'flex flex-col gap-3 rounded-surface p-4 shadow-[inset_0_0_0_1px_var(--color-line)]';
const LABEL = 'text-xs font-medium text-fg-2';

// ── Workspace picker — icon list (mirrors the OAuth authorize page's picker) ──
function WorkspacePicker({
  targets, value, onChange, label,
}: {
  targets: MintTarget[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
      {targets.map(w => {
        const active = value === w.id;
        return (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(w.id)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-left transition-colors',
              active ? 'bg-hover text-fg' : 'text-fg-2 hover:bg-hover/50 hover:text-fg',
            )}
          >
            {w.icon
              ? <PageIcon icon={w.icon} iconColor={w.iconColor} size={15} />
              : <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-hover text-2xs leading-none font-semibold text-fg-3">
                  {w.name.charAt(0).toUpperCase()}
                </span>
            }
            <span className="flex-1 truncate text-ui">{w.name}</span>
            {active && <Check size={14} className="shrink-0 text-signal-text" />}
          </button>
        );
      })}
    </div>
  );
}

function EditorMark({ id, size = 14 }: { id: EditorId; size?: number }) {
  const meta = EDITORS.find(e => e.id === id);
  if (id === 'custom') return <Plug size={size} className="text-fg-2" />;
  if (id === 'vscode' || !meta?.aiMark) return <VscodeMark size={size} />;
  return <AIMark name={meta.aiMark} size={size} />;
}

/** The editor's name as shown; the catch-all entry is named in the UI language. */
function editorLabel(id: EditorId, t: ReturnType<typeof useTranslations>): string {
  if (id === 'custom') return t('connectOtherTool');
  return EDITORS.find(e => e.id === id)?.label ?? id;
}

/** Where the flow is: "Step 2 of 3" over three bars. The steps are a real sequence. */
function StepHeading({
  step, title, hint, t, children,
}: {
  step: 1 | 2 | 3;
  title: React.ReactNode;
  hint?: React.ReactNode;
  t: ReturnType<typeof useTranslations>;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <div aria-hidden className="flex w-20 gap-1">
          {[1, 2, 3].map(n => (
            <span key={n} className={cn('h-1 flex-1 rounded-full', n <= step ? 'bg-fg' : 'bg-line-strong')} />
          ))}
        </div>
        <p className="text-xs text-fg-3">{t('connectStep', { current: step, total: 3 })}</p>
      </div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        {title}
        {children}
      </h3>
      {hint && <p className="text-xs leading-relaxed text-fg-3">{hint}</p>}
    </div>
  );
}

/** Opens or closes a part of the flow most people don't need. */
function Disclosure({
  icon, label, open, onToggle, children,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-surface px-4 py-2.5"
      >
        <span className="flex items-center gap-2 text-ui font-medium text-fg-2 transition-colors group-hover:text-fg [&_svg]:size-3.5 [&_svg]:text-fg-3">
          {icon}
          {label}
        </span>
        <ChevronDown size={16} className={cn('text-fg-3 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>}
    </div>
  );
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
  const codeClass = 'rounded-control bg-raised px-3 py-2.5 pr-20 font-mono text-xs leading-relaxed text-fg shadow-[inset_0_0_0_1px_var(--color-line)]';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-3">{hint}</p>
        {filePath && <Badge variant="outline" className="font-mono">{filePath}</Badge>}
      </div>
      <div className="relative">
        {isCmd ? (
          <code className={cn('block break-all', codeClass)}>{code}</code>
        ) : (
          <pre className={cn('overflow-x-auto', codeClass)}>{code}</pre>
        )}
        <Button size="xs" onClick={copy} className="absolute top-2 right-2">
          {copied ? <Check /> : <Copy />}
          {copied ? t('copied') : t('copyToken')}
        </Button>
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
    <div className="flex flex-col gap-4">
      <StepHeading step={1} title={t('connectChooseTitle')} hint={t('connectChooseHint')} t={t} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EDITORS.map(({ id, descKey }) => {
          const selected = current === id;
          const isDetected = !!detected?.[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={selected}
              className={cn(
                'group flex cursor-pointer items-start gap-3 rounded-surface bg-raised p-3.5 text-left transition-shadow',
                selected
                  ? 'shadow-[inset_0_0_0_1.5px_var(--color-signal)]'
                  : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-float shadow-[inset_0_0_0_1px_var(--color-line)]">
                <EditorMark id={id} size={20} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-ui font-semibold text-fg">{editorLabel(id, t)}</span>
                  {isDetected && <Badge variant="signal" size="sm">{t('connectDetectedBadge')}</Badge>}
                </span>
                <span className="text-xs leading-snug text-fg-3">
                  {t(descKey as Parameters<typeof t>[0])}
                </span>
              </span>
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
  const toolName = editorLabel(editor, t);
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
  // Claude Code is currently the only client with an Anthropic Skills concept
  // (`~/.claude/skills/<name>/SKILL.md`) — offered only there, on by default.
  const [installSkill, setInstallSkill] = useState(true);

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

      // Best-effort companion step — a failed skill install must never mask
      // the successful (and more important) MCP connection above.
      let skillInstalled = false;
      if (editor === 'claude' && installSkill) {
        try {
          await invoke('install_remnus_skill');
          skillInstalled = true;
        } catch {
          skillInstalled = false;
        }
      }

      setAutoResult({
        ok: true,
        message: skillInstalled
          ? t('connectAutoSuccessWithSkill', { tool: toolName })
          : t('connectAutoSuccess', { tool: toolName }),
      });
      // Let the success message land for a beat, then advance automatically —
      // the user already has a working connection, no need to make them click Next.
      onAutoConnected?.(toolName);
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
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-fg-3">
            <Globe size={14} className="mt-0.5 shrink-0 text-fg-4" />
            {t('connectClaudeOAuthHint')}
          </p>
        </>
      );
    }
    if (meta.kind === 'deeplink') {
      const href = editor === 'cursor' ? buildCursorUrl(mcpUrl) : buildVscodeUrl(mcpUrl);
      return (
        <div className="flex flex-col gap-2">
          <a href={href} className={cn(buttonVariants({ variant: 'primary' }), 'self-start')}>
            <EditorMark id={editor} size={14} />
            {t('connectOpenIn', { tool: toolName })}
          </a>
          {editor === 'cursor' && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {t('connectCursorOAuthWarn')}
            </p>
          )}
        </div>
      );
    }
    if (meta.kind === 'toml') {
      // Codex — add the server to config.toml, then sign in with one command.
      return (
        <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-3">
          <CodeBlock code={mcpUrl} isCmd hint={t('connectEndpointLabel')} t={t} />
          <p className="text-xs leading-relaxed text-fg-3">{t('connectCustomHint')}</p>
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
        <a href={href} className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}>
          <EditorMark id={editor} size={14} />
          {t('connectOpenIn', { tool: toolName })}
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
      return <p className="text-xs text-fg-3">{t('connectTokenNoAccess')}</p>;
    }

    if (mintedToken) {
      return (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{t('connectTokenCreated')}</span>
          </p>
          <div className="flex gap-2">
            <code className="flex-1 rounded-control bg-raised px-2.5 py-1.5 font-mono text-xs break-all text-fg shadow-[inset_0_0_0_1px_var(--color-line)] select-all">
              {mintedToken}
            </code>
            <Button size="sm" onClick={copyToken}>
              {tokenCopied ? <Check /> : <Copy />}
              {tokenCopied ? t('copied') : t('copyToken')}
            </Button>
          </div>
          {renderTokenArtifact(mintedToken)}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-fg-3">{t('connectTokenHint')}</p>

        {/* Workspace picker (only when more than one) */}
        {mintTargets.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>{t('connectTokenWorkspaceLabel')}</span>
            <WorkspacePicker targets={mintTargets} value={selectedWs} onChange={setSelectedWs} label={t('connectTokenWorkspaceLabel')} />
          </div>
        )}

        {/* Scope */}
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t('mcpCreateScopeLabel')}</span>
          <SegmentedControl value={scope} onValueChange={setScope} aria-label={t('mcpCreateScopeLabel')}>
            <SegmentedControlItem value="read">{t('tokenScopeRead')}</SegmentedControlItem>
            <SegmentedControlItem value="write">{t('tokenScopeWrite')}</SegmentedControlItem>
          </SegmentedControl>
        </div>

        {mintError && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle size={12} /> {mintError}
          </p>
        )}

        <Button size="sm" className="self-start" onClick={handleMint} disabled={!selectedWs} loading={minting}>
          <KeyRound />
          {t('connectGenerateToken')}
        </Button>
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
        <SegmentedControl value={os} onValueChange={setOs} aria-label="OS">
          <SegmentedControlItem value="mac">macOS</SegmentedControlItem>
          <SegmentedControlItem value="linux">Linux</SegmentedControlItem>
          <SegmentedControlItem value="windows">Windows</SegmentedControlItem>
        </SegmentedControl>
      )}

      {/* Animated walkthrough — Claude Code only, above Quick connect */}
      {editor === 'claude' && (
        <div className="flex flex-col gap-1.5">
          <p className={LABEL}>{t('connectAnimTitle')}</p>
          <ClaudeConnectAnimation mcpUrl={mcpUrl} />
        </div>
      )}

      {/* Primary: OAuth */}
      <div className={PANEL}>
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-fg-3" />
          <span className="text-ui font-semibold text-fg">
            {oauthReady ? t('connectOAuthTitle') : t('connectConfigTitle')}
          </span>
          {oauthReady && <Badge variant="signal" size="sm">{t('connectRecommended')}</Badge>}
        </div>
        {oauthReady && <p className="text-xs leading-relaxed text-fg-3">{t('connectOAuthDesc')}</p>}
        {renderOAuth()}
      </div>

      {/* Advanced: token */}
      <Disclosure
        icon={<KeyRound />}
        label={t('connectAdvancedToggle')}
        open={showAdvanced}
        onToggle={() => setShowAdvanced(v => !v)}
      >
        {renderToken()}
      </Disclosure>

      {/* Manual completion — only needed here: unlike auto-connect, these steps
          don't self-report success, so the user tells us when they're done.
          Lives in the main Nav row when auto-connect isn't available (see below). */}
      {autoAvailable && (
        <Button variant="primary" className="self-end" onClick={onNext}>
          {t('connectNext')}
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={2} title={t('connectConnectTitle', { tool: toolName })} t={t}>
        <EditorMark id={editor} size={14} />
      </StepHeading>

      {/* Desktop-only: one-click auto-connect via Tauri. The primary path when
          available — everything manual moves into the collapse below. */}
      {autoAvailable && (
        <div className="flex flex-col gap-3 rounded-surface bg-signal-soft p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-signal-text" />
            <span className="text-ui font-semibold text-fg">{t('connectAutoHeading')}</span>
            {detected && <Badge variant="signal" size="sm">{t('connectDetectedBadge')}</Badge>}
          </div>
          <p className="text-xs leading-relaxed text-fg-2">{t('connectAutoDesc', { tool: toolName })}</p>

          {!canMint ? (
            <p className="text-xs text-fg-3">{t('connectTokenNoAccess')}</p>
          ) : (
            <>
              {mintTargets.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <span className={LABEL}>{t('connectTokenWorkspaceLabel')}</span>
                  <WorkspacePicker targets={mintTargets} value={selectedWs} onChange={setSelectedWs} label={t('connectTokenWorkspaceLabel')} />
                </div>
              )}

              {editor === 'claude' && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox checked={installSkill} onCheckedChange={(v) => setInstallSkill(v)} className="mt-0.5" />
                  <span className="min-w-0 text-xs leading-relaxed">
                    <span className="inline-flex items-center gap-1 font-medium text-fg">
                      <BookOpen size={12} className="shrink-0 text-fg-3" />
                      {t('connectInstallSkillLabel')}
                    </span>{' '}
                    <span className="text-fg-3">{t('connectInstallSkillHint')}</span>
                  </span>
                </label>
              )}

              <Button
                variant="primary"
                className="self-start"
                onClick={handleAutoConnect}
                disabled={!selectedWs}
                loading={autoConnecting}
              >
                <Sparkles />
                {autoConnecting ? t('connectAutoRunning') : t('connectAutoButton')}
              </Button>
            </>
          )}

          {autoResult && (
            <p
              role={autoResult.ok ? 'status' : 'alert'}
              className={cn('flex items-start gap-1.5 text-xs leading-relaxed', autoResult.ok ? 'text-green-400' : 'text-red-400')}
            >
              {autoResult.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              {autoResult.message}
            </p>
          )}
        </div>
      )}

      {/* Manual path: direct when auto-connect isn't available, collapsed behind
          a toggle when it is (auto-connect is the primary path in that case). */}
      {autoAvailable ? (
        <Disclosure
          icon={<Wrench />}
          label={t('connectManualToggle')}
          open={showManual}
          onToggle={() => setShowManual(v => !v)}
        >
          {manualContent}
        </Disclosure>
      ) : (
        manualContent
      )}

      {/* Nav — the primary "Next" moves into the manual collapse above when
          auto-connect is available (it already advances on its own success). */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!autoAvailable && (
          <Button variant="primary" onClick={onNext}>
            {t('connectNext')}
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft />
          {t('mcpOnboardBack')}
        </Button>
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
    <div className="flex flex-col gap-4">
      <StepHeading step={3} title={t('connectTestTitle')} hint={t('connectTestHint')} t={t} />

      {autoConnectedTool && (
        <div role="status" className="flex items-center gap-3 rounded-surface bg-green-500/10 px-4 py-3">
          <PartyPopper size={18} className="shrink-0 text-green-400" />
          <div className="min-w-0">
            <p className="text-ui font-semibold text-fg">{t('connectAutoCompleteTitle')}</p>
            <p className="text-xs text-fg-2">{t('connectAutoCompleteHint', { tool: autoConnectedTool })}</p>
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <p className="flex-1 rounded-control bg-raised px-3 py-3 text-ui leading-relaxed text-fg shadow-[inset_0_0_0_1px_var(--color-line)]">
          &ldquo;{testPrompt}&rdquo;
        </p>
        <Button onClick={copy} className="h-auto flex-col gap-1 px-3 text-xs">
          {copied ? <Check /> : <Copy />}
          {copied ? t('copied') : t('copyToken')}
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-fg-3">
        <Send size={14} className="mt-0.5 shrink-0 text-fg-4" />
        {t('connectTestAction', { tool: toolLabel })}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="primary" onClick={onDone}>
          <Check />
          {t('connectDone')}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft />
          {t('mcpOnboardBack')}
        </Button>
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
  const tUi = useTranslations('UI');
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
          toolLabel={editorLabel(editor, t)}
        />
      )}
    </div>
  );

  if (bare) return steps;

  return (
    <div className="overflow-hidden rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
      <div className="flex items-center justify-between border-b border-line px-5 pt-4 pb-3">
        <span className="text-ui font-semibold text-fg">{t('connectTitle')}</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={tUi('close')}>
          <X />
        </Button>
      </div>

      <div className="px-5 py-5">{steps}</div>
    </div>
  );
}
