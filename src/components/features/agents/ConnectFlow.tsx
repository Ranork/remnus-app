'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ArrowRight, ChevronLeft, ChevronDown, X, KeyRound, Globe, AlertCircle, AlertTriangle } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { mintAgentToken } from '@/lib/actions/agentToken';
import {
  EDITORS, OAUTH_READY, CONFIG_PATHS, TEST_PROMPT,
  buildCursorUrl, buildVscodeUrl, buildClaudeCmd, buildJsonConfig,
  type EditorId, type OS,
} from '@/lib/mcp/deeplinks';

/** Workspaces the user can mint a PAT in (passed by AgentsModal / TokensTab). */
export interface MintTarget { id: string; name: string }

// ── Custom VS Code mark (not in AIMark) ──────────────────────────────────────
function VscodeMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
      <path d="M17.583.063L9.963 7.087 4.19 2.383 2 3.436v17.125l2.19 1.054 5.773-4.704 7.62 7.026L22 22.564V1.436L17.583.063zM20 19.437l-6-5.453v-3.97l6-5.451v14.874zM4 19.204V4.797l4 3.26v7.888L4 19.204z" />
    </svg>
  );
}

function EditorMark({ id, size = 14 }: { id: EditorId; size?: number }) {
  const meta = EDITORS.find(e => e.id === id);
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
  t, onSelect, current,
}: {
  t: ReturnType<typeof useTranslations>;
  onSelect: (id: EditorId) => void;
  current?: EditorId;
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {EDITORS.map(({ id, label }) => {
          const selected = current === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group relative flex items-center gap-2.5 px-3 py-3 rounded-lg border text-xs font-semibold transition-all text-left ${
                selected
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-200 shadow-[0_0_12px_rgba(68,92,149,0.25)]'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white'
              }`}
            >
              <EditorMark id={id} size={15} />
              <span>{label}</span>
              {selected
                ? <Check size={11} className="ml-auto text-blue-400 shrink-0" />
                : <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 text-neutral-500 transition-opacity shrink-0" />
              }
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: connect (OAuth primary + advanced PAT) ────────────────────────────
function StepConnect({
  t, editor, mcpUrl, onNext, onBack, mintTargets,
}: {
  t: ReturnType<typeof useTranslations>;
  editor: EditorId;
  mcpUrl: string;
  onNext: () => void;
  onBack: () => void;
  mintTargets: MintTarget[];
}) {
  const [os, setOs] = useState<OS>('mac');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const meta = EDITORS.find(e => e.id === editor)!;
  const oauthReady = OAUTH_READY[editor];

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
      const res = await mintAgentToken(selectedWs, meta.label, scope);
      setMintedToken(res.token);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setMinting(false);
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
    // json-only editors (windsurf / continue / antigravity) — not OAuth-ready
    return (
      <CodeBlock
        code={buildJsonConfig(editor, mcpUrl)}
        isCmd={false}
        filePath={CONFIG_PATHS[editor as Exclude<EditorId, 'claude' | 'vscode'>][os]}
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
    return (
      <CodeBlock
        code={buildJsonConfig(editor, mcpUrl, token)}
        isCmd={false}
        filePath={CONFIG_PATHS[editor as Exclude<EditorId, 'claude' | 'vscode'>][os]}
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
            <select
              value={selectedWs}
              onChange={e => setSelectedWs(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-md text-neutral-100 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500/60 transition-colors"
            >
              {mintTargets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
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

  const needsOs = meta.kind === 'json' || (showAdvanced && editor === 'cursor');

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

      {/* Nav */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          onClick={onNext}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-md transition-colors"
        >
          {t('connectNext')} <ArrowRight size={13} />
        </button>
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
  t, onDone, onBack,
}: {
  t: ReturnType<typeof useTranslations>;
  onDone: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(TEST_PROMPT).then(() => {
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

      <div className="flex items-stretch gap-2">
        <p className="flex-1 text-[11px] text-neutral-200 italic bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-3 leading-relaxed">
          &ldquo;{TEST_PROMPT}&rdquo;
        </p>
        <button
          onClick={copy}
          className="shrink-0 flex flex-col items-center justify-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-3 rounded-lg border border-neutral-700 transition-colors"
        >
          {copied ? <Check size={13} className="text-sky-400" /> : <Copy size={13} />}
          <span>{copied ? t('copied') : t('copyToken')}</span>
        </button>
      </div>

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
}

export default function ConnectFlow({ mcpUrl, onClose, mintTargets = [] }: Props) {
  const t = useTranslations('WorkspaceSettings');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editor, setEditor] = useState<EditorId | null>(null);

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-800">
        <span className="text-xs font-semibold text-neutral-200">{t('connectTitle')}</span>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded">
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-5">
        {step === 1 && (
          <StepChoose t={t} current={editor ?? undefined} onSelect={id => { setEditor(id); setStep(2); }} />
        )}
        {step === 2 && editor && (
          <StepConnect
            t={t}
            editor={editor}
            mcpUrl={mcpUrl}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            mintTargets={mintTargets}
          />
        )}
        {step === 3 && (
          <StepTest t={t} onDone={onClose} onBack={() => setStep(2)} />
        )}
      </div>
    </div>
  );
}
