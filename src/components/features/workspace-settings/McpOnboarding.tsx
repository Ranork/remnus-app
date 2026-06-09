'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Copy, ArrowRight, ChevronLeft, X } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { buildCursorUrl, buildVscodeUrl } from '@/lib/mcp/deeplinks';

type ToolId = 'claude' | 'cursor' | 'windsurf' | 'continue' | 'antigravity';
type OS = 'mac' | 'linux' | 'windows';

const TOOLS: { id: ToolId; label: string }[] = [
  { id: 'claude',      label: 'Claude Code' },
  { id: 'cursor',      label: 'Cursor'       },
  { id: 'windsurf',   label: 'Windsurf'     },
  { id: 'continue',   label: 'Continue'     },
  { id: 'antigravity', label: 'Antigravity'  },
];

const FILE_PATHS: Record<Exclude<ToolId, 'claude'>, Record<OS, string>> = {
  cursor:      { mac: '~/.cursor/mcp.json',                  linux: '~/.cursor/mcp.json',                  windows: '%USERPROFILE%\\.cursor\\mcp.json' },
  windsurf:    { mac: '~/.codeium/windsurf/mcp_config.json', linux: '~/.codeium/windsurf/mcp_config.json', windows: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json' },
  continue:    { mac: '~/.continue/config.json',             linux: '~/.continue/config.json',             windows: '%USERPROFILE%\\.continue\\config.json' },
  antigravity: { mac: '~/.gemini/config/mcp_config.json',   linux: '~/.gemini/config/mcp_config.json',   windows: '%USERPROFILE%\\.gemini\\config\\mcp_config.json' },
};

function getConfig(
  tool: ToolId,
  os: OS,
  claudeMode: 'cli' | 'json',
  mcpUrl: string,
  token: string,
): { code: string; isCmd: boolean; filePath?: string } {
  const auth = `Bearer ${token}`;
  if (tool === 'claude') {
    if (claudeMode === 'cli') {
      return { code: `claude mcp add --transport http --scope user remnus ${mcpUrl} --header "Authorization: ${auth}"`, isCmd: true };
    }
    return {
      code: JSON.stringify({ mcpServers: { remnus: { type: 'http', url: mcpUrl, headers: { Authorization: auth } } } }, null, 2),
      isCmd: false, filePath: '.mcp.json',
    };
  }
  if (tool === 'antigravity') {
    return {
      code: JSON.stringify({ mcpServers: { remnus: { serverUrl: mcpUrl, headers: { Authorization: auth } } } }, null, 2),
      isCmd: false, filePath: FILE_PATHS[tool][os],
    };
  }
  return {
    code: JSON.stringify({ mcpServers: { remnus: { url: mcpUrl, headers: { Authorization: auth } } } }, null, 2),
    isCmd: false, filePath: FILE_PATHS[tool as Exclude<ToolId, 'claude'>][os],
  };
}

const TEST_PROMPT = 'List all pages and databases in my Remnus workspace';
const TOTAL = 3;

interface Props {
  token: string;
  tokenName?: string;
  initialTool?: ToolId;
  mcpUrl: string;
  onDismiss: () => void;
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: TOTAL }, (_, i) => {
        const n = i + 1;
        const done = step > n;
        const curr = step === n;
        return (
          <div key={n} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
                done ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(68,92,149,0.5)]'
                     : curr ? 'bg-neutral-800 border-2 border-blue-500 text-blue-400'
                             : 'bg-neutral-800 border border-neutral-700 text-neutral-600'
              }`}>
                {done ? <Check size={13} /> : n}
              </div>
            </div>
            {i < TOTAL - 1 && (
              <div className={`h-0.5 flex-1 mx-1.5 rounded-full transition-all duration-500 ${
                step > n ? 'bg-blue-500' : 'bg-neutral-800'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Choose tool ───────────────────────────────────────────────────────
function StepChoose({
  t, onSelect, onDismiss, currentTool,
}: {
  t: ReturnType<typeof useTranslations>;
  onSelect: (tool: ToolId) => void;
  onDismiss: () => void;
  currentTool?: ToolId;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {t('mcpOnboardStep', { current: 1, total: TOTAL })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100">{t('mcpOnboardChooseTitle')}</h3>
        <p className="text-[11px] text-neutral-400">{t('mcpOnboardChooseHint')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TOOLS.map(({ id, label }) => {
          const isSelected = currentTool === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group relative flex items-center gap-2.5 px-3 py-3 rounded-lg border text-xs font-semibold transition-all text-left ${
                isSelected
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-200 shadow-[0_0_12px_rgba(68,92,149,0.25)]'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white'
              }`}
            >
              <AIMark name={id} size={15} />
              <span>{label}</span>
              {isSelected
                ? <Check size={11} className="ml-auto text-blue-400 shrink-0" />
                : <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 text-neutral-500 transition-opacity shrink-0" />
              }
            </button>
          );
        })}
      </div>

      <button
        onClick={onDismiss}
        className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        {t('mcpOnboardDismiss')}
      </button>
    </div>
  );
}

// ── Step 2: Config ────────────────────────────────────────────────────────────
function StepConfig({
  t, tool, token, mcpUrl, onNext, onBack,
}: {
  t: ReturnType<typeof useTranslations>;
  tool: ToolId;
  token: string;
  mcpUrl: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [os, setOs] = useState<OS>('mac');
  const [claudeMode, setClaudeMode] = useState<'cli' | 'json'>('cli');
  const [copied, setCopied] = useState(false);

  const cfg = getConfig(tool, os, claudeMode, mcpUrl, token);
  const toolLabel = TOOLS.find(x => x.id === tool)!.label;

  const copy = () => {
    navigator.clipboard.writeText(cfg.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {t('mcpOnboardStep', { current: 2, total: TOTAL })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
          {t('mcpOnboardAddTitle', { tool: toolLabel })}
          <AIMark name={tool} size={14} />
        </h3>
      </div>

      {/* OS selector — shown when a file path matters */}
      {!(tool === 'claude' && claudeMode === 'cli') && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500 mr-1">OS</span>
          {(['mac', 'linux', 'windows'] as OS[]).map((k) => (
            <button key={k} onClick={() => setOs(k)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${
                os === k ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'border-neutral-700 text-neutral-500 hover:text-neutral-200 hover:border-neutral-600'
              }`}>
              {k === 'mac' ? 'macOS' : k === 'linux' ? 'Linux' : 'Windows'}
            </button>
          ))}
        </div>
      )}

      {/* Claude CLI/JSON toggle */}
      {tool === 'claude' && (
        <div className="flex gap-1 w-fit border border-neutral-800 rounded-md p-0.5 bg-neutral-900">
          {(['cli', 'json'] as const).map((m) => (
            <button key={m} onClick={() => setClaudeMode(m)}
              className={`px-3 py-1 rounded text-[10px] font-semibold transition-colors ${
                claudeMode === m ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-200'
              }`}>
              {m === 'cli' ? 'CLI' : 'JSON'}
            </button>
          ))}
        </div>
      )}

      {/* Config block */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-neutral-400">
            {cfg.isCmd ? t('integrateCliStep') : t('integrateJsonStep')}
          </p>
          {cfg.filePath && (
            <code className="text-[10px] text-neutral-300 font-mono bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
              {cfg.filePath}
            </code>
          )}
        </div>
        <div className="relative">
          {cfg.isCmd ? (
            <code className="block bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-[11px] text-sky-400 font-mono break-all leading-relaxed pr-20">
              {cfg.code}
            </code>
          ) : (
            <pre className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-[11px] text-sky-400 font-mono overflow-x-auto leading-relaxed">
              {cfg.code}
            </pre>
          )}
          <button onClick={copy}
            className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded border border-neutral-700 transition-colors">
            {copied ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
            {copied ? t('copied') : t('copyToken')}
          </button>
        </div>
      </div>

      {/* Quick-install deep links */}
      {(tool === 'cursor' || tool === 'claude') && (
        <div className="flex gap-2 flex-wrap">
          {tool === 'cursor' && (
            <a href={buildCursorUrl(mcpUrl, token)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3l9 9-9 9h4l7-7.5V12l-7-7.5H3zm10 0l9 9-9 9h4l7-7.5V12l-7-7.5h-4z"/></svg>
              {t('installCursor')}
            </a>
          )}
          {tool === 'claude' && (
            <a href={buildVscodeUrl(mcpUrl, token)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400"><path d="M17.583.063L9.963 7.087 4.19 2.383 2 3.436v17.125l2.19 1.054 5.773-4.704 7.62 7.026L22 22.564V1.436L17.583.063zM20 19.437l-6-5.453v-3.97l6-5.451v14.874zM4 19.204V4.797l4 3.26v7.888L4 19.204z"/></svg>
              {t('installVSCode')}
            </a>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button onClick={onNext}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-md transition-colors">
          {t('mcpOnboardAddCTA')} <ArrowRight size={13} />
        </button>
        <button onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">
          <ChevronLeft size={12} /> {t('mcpOnboardBack')}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Test ──────────────────────────────────────────────────────────────
function StepTest({
  t, toolLabel, onDone, onBack, onSkip,
}: {
  t: ReturnType<typeof useTranslations>;
  toolLabel: string;
  onDone: () => void;
  onBack: () => void;
  onSkip: () => void;
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
          {t('mcpOnboardStep', { current: 3, total: TOTAL })}
        </p>
        <h3 className="text-sm font-semibold text-neutral-100">{t('mcpOnboardTestTitle')}</h3>
        <p className="text-[11px] text-neutral-400">{t('mcpOnboardTestHint', { tool: toolLabel })}</p>
      </div>

      <div className="flex items-stretch gap-2">
        <p className="flex-1 text-[11px] text-neutral-200 italic bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-3 leading-relaxed">
          &ldquo;{TEST_PROMPT}&rdquo;
        </p>
        <button onClick={copy}
          className="shrink-0 flex flex-col items-center justify-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-3 rounded-lg border border-neutral-700 transition-colors">
          {copied ? <Check size={13} className="text-sky-400" /> : <Copy size={13} />}
          <span>{copied ? t('copied') : t('copyToken')}</span>
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button onClick={onDone}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-md transition-colors">
          <Check size={13} /> {t('mcpOnboardTestCTA')}
        </button>
        <button onClick={onSkip}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">
          {t('mcpOnboardTestSkip')}
        </button>
        <button onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors ml-auto">
          <ChevronLeft size={12} /> {t('mcpOnboardBack')}
        </button>
      </div>
    </div>
  );
}

// ── Done banner ───────────────────────────────────────────────────────────────
function DoneBanner({
  t, toolLabel, onClose,
}: {
  t: ReturnType<typeof useTranslations>;
  toolLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
            <Check size={15} className="text-green-400" />
          </div>
          <span className="text-sm font-semibold text-green-300">{t('mcpOnboardDoneTitle')}</span>
        </div>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors rounded">
          <X size={14} />
        </button>
      </div>
      {toolLabel && (
        <p className="text-xs text-neutral-400 leading-relaxed pl-[42px]">
          {t('mcpOnboardDoneBody', { tool: toolLabel })}
        </p>
      )}
      <div className="pl-[42px]">
        <button onClick={onClose}
          className="text-xs font-semibold text-green-400 hover:text-green-300 transition-colors">
          {t('mcpOnboardDoneClose')} →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function McpOnboarding({ token, tokenName, initialTool, mcpUrl, onDismiss }: Props) {
  const t = useTranslations('WorkspaceSettings');
  const [step, setStep] = useState<1 | 2 | 3>(initialTool ? 2 : 1);
  const [done, setDone] = useState(false);
  const [tool, setTool] = useState<ToolId | null>(initialTool ?? null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [fading, setFading] = useState(false);

  const toolLabel = tool ? (TOOLS.find(x => x.id === tool)?.label ?? tool) : '';

  const goTo = (n: 1 | 2 | 3) => {
    setFading(true);
    setTimeout(() => { setStep(n); setFading(false); }, 160);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  if (done) {
    return <DoneBanner t={t} toolLabel={toolLabel} onClose={onDismiss} />;
  }

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden">
      {/* Header row: progress + dismiss */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="flex-1">
          <StepBar step={step} />
        </div>
        <button
          onClick={onDismiss}
          title={t('mcpOnboardDismiss')}
          className="shrink-0 p-1 text-neutral-600 hover:text-neutral-400 transition-colors rounded"
        >
          <X size={14} />
        </button>
      </div>

      {/* Persistent token row */}
      <div className="mx-5 mb-4 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
        <AlertCircle size={11} className="text-amber-400 shrink-0" />
        {tokenName && (
          <span className="shrink-0 text-[10px] font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded">
            {tokenName}
          </span>
        )}
        <code className="flex-1 text-[11px] text-sky-400 font-mono break-all select-all leading-relaxed min-w-0">
          {token}
        </code>
        <button
          onClick={copyToken}
          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-2.5 py-1.5 rounded border border-neutral-700 transition-colors"
        >
          {tokenCopied ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
          {tokenCopied ? t('copied') : t('copyToken')}
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-neutral-800 mx-5" />

      {/* Step content — fades between steps */}
      <div
        className="px-5 py-5"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? 'translateY(5px)' : 'translateY(0)',
          transition: 'opacity 160ms ease, transform 160ms ease',
        }}
      >
        {step === 1 && (
          <StepChoose
            t={t}
            onSelect={(id) => { setTool(id); goTo(2); }}
            onDismiss={onDismiss}
            currentTool={tool ?? undefined}
          />
        )}
        {step === 2 && tool && (
          <StepConfig
            t={t}
            tool={tool}
            token={token}
            mcpUrl={mcpUrl}
            onNext={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        )}
        {step === 3 && (
          <StepTest
            t={t}
            toolLabel={toolLabel}
            onDone={() => setDone(true)}
            onBack={() => goTo(2)}
            onSkip={onDismiss}
          />
        )}
      </div>
    </div>
  );
}
