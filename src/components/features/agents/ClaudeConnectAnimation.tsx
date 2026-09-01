'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, RotateCcw } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { buildClaudeCmd } from '@/lib/mcp/deeplinks';

/**
 * Self-playing animated demo of the Claude Code connect flow, shown above the
 * "Quick connect" box when Claude Code is the selected editor. It narrates the
 * happy path visually: a fake mouse clicks into a terminal, types the
 * `claude mcp add …` command, hits enter, Remnus connects + the OAuth browser
 * pops up, and finally a "Connection successful" screen lands. Loops so a user
 * who looks away still catches the next run; honors prefers-reduced-motion by
 * jumping straight to the finished frame.
 */

type Phase = 'init' | 'move' | 'click' | 'type' | 'run' | 'success';

// Terminal output lines streamed in after Enter. CLI output is literal/technical
// (like the command itself), so it is intentionally not translated.
const OUTPUT = [
  { text: 'Connecting to remnus…', tone: 'muted' as const },
  { text: 'Opening browser to sign in…', tone: 'muted' as const, browser: true },
  { text: '✓ Signed in', tone: 'ok' as const },
  { text: '✓ remnus connected · 24 tools available', tone: 'ok' as const },
];
const BROWSER_LINE = OUTPUT.findIndex(l => l.browser);

export default function ClaudeConnectAnimation({ mcpUrl }: { mcpUrl: string }) {
  const t = useTranslations('WorkspaceSettings');
  const cmd = buildClaudeCmd(mcpUrl);

  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const [phase, setPhase] = useState<Phase>(reduced ? 'success' : 'init');
  const [typed, setTyped] = useState(reduced ? cmd.length : 0);
  const [lines, setLines] = useState(reduced ? OUTPUT.length : 0);
  const [browser, setBrowser] = useState(false);
  const [authorized, setAuthorized] = useState(reduced);
  const [runKey, setRunKey] = useState(0); // bump to replay

  useEffect(() => {
    if (reduced) return; // static finished frame, no animation

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let clock = 0;
    const at = (delay: number, fn: () => void) => {
      clock += delay;
      timers.push(setTimeout(() => !cancelled && fn(), clock));
    };

    // reset (deferred via timer so it never runs synchronously in the effect)
    at(0, () => {
      setPhase('init');
      setTyped(0);
      setLines(0);
      setBrowser(false);
      setAuthorized(false);
    });

    at(500, () => setPhase('move'));        // mouse glides toward the terminal
    at(750, () => setPhase('click'));       // click ripple + focus
    at(450, () => setPhase('type'));        // start typing

    // type the command char-by-char
    for (let i = 1; i <= cmd.length; i++) at(26, () => setTyped(i));

    at(420, () => setPhase('run'));         // press Enter

    // stream output lines
    for (let i = 0; i < OUTPUT.length; i++) {
      at(i === 0 ? 500 : 700, () => {
        setLines(i + 1);
        if (i === BROWSER_LINE) setBrowser(true);
      });
      if (i === BROWSER_LINE) {
        at(950, () => setAuthorized(true)); // user clicks "Authorize"
        at(650, () => setBrowser(false));    // browser closes
      }
    }

    at(550, () => setPhase('success'));     // ta-da
    at(3200, () => !cancelled && setRunKey(k => k + 1)); // loop

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [runKey, cmd, reduced]);

  const showCaret = phase === 'type' || phase === 'click';

  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden select-none">
      {/* title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900/60">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500">
          <AIMark name="claude" size={11} /> Claude Code
        </span>
        <button
          onClick={() => setRunKey(k => k + 1)}
          className="ml-auto flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-300 transition-colors"
          title={t('connectAnimReplay')}
        >
          <RotateCcw size={10} /> {t('connectAnimReplay')}
        </button>
      </div>

      {/* terminal body */}
      <div className="relative h-44 px-3.5 py-3 font-mono text-[11px] leading-relaxed">
        {/* command line */}
        <div className="flex items-start gap-1.5">
          <span className="text-green-400 shrink-0">$</span>
          <span className="text-neutral-200 break-all">
            {cmd.slice(0, typed)}
            {showCaret && <span className="connect-anim-caret">▋</span>}
          </span>
        </div>

        {/* output */}
        <div className="mt-1 space-y-0.5">
          {OUTPUT.slice(0, lines).map((l, i) => (
            <div
              key={i}
              className={`connect-anim-line ${
                l.tone === 'ok' ? 'text-green-400' : 'text-neutral-500'
              }`}
            >
              {l.text}
            </div>
          ))}
        </div>

        {/* fake mouse cursor */}
        <div
          className={`connect-anim-mouse ${phase === 'init' ? 'is-start' : 'is-target'} ${
            phase === 'click' ? 'is-click' : ''
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 1.5L13 7.5L8 8.5L11 13.5L9 14.5L6 9.5L2 12.5V1.5Z"
              fill="#fff"
              stroke="#111"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          {phase === 'click' && <span className="connect-anim-ripple" />}
        </div>

        {/* OAuth browser popup */}
        {browser && (
          <div className="connect-anim-browser absolute right-3 bottom-3 w-44 rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1 bg-neutral-800/80 border-b border-neutral-700">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
              <span className="flex-1 text-center text-[8px] text-neutral-500 truncate">
                remnus.com
              </span>
            </div>
            <div className="p-2.5 flex flex-col items-center gap-1.5 text-center">
              <span className="text-[11px] font-semibold text-neutral-100 tracking-tight lowercase">
                remnus
              </span>
              <span className="text-[8px] text-neutral-400 leading-tight">
                {t('connectAnimAuthorize')}
              </span>
              <span
                className={`mt-0.5 w-full rounded-md py-1 text-[8px] font-semibold transition-colors ${
                  authorized
                    ? 'bg-green-600 text-white'
                    : 'connect-anim-authbtn bg-blue-500 text-white'
                }`}
              >
                {authorized ? '✓' : t('connectAnimAuthBtn')}
              </span>
            </div>
          </div>
        )}

        {/* success overlay */}
        {phase === 'success' && (
          <div className="connect-anim-success absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/95 backdrop-blur-[1px]">
            <span className="connect-anim-check flex items-center justify-center w-11 h-11 rounded-full bg-green-500/15 border border-green-500/40 text-green-400">
              <Check size={22} strokeWidth={3} />
            </span>
            <span className="text-xs font-semibold text-neutral-100">
              {t('connectAnimSuccess')}
            </span>
            <span className="text-[10px] text-neutral-400">{t('connectAnimSuccessSub')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
