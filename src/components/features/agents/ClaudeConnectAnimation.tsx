'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  { text: '✓ remnus connected · 25 tools available', tone: 'ok' as const },
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
    <div className="relative overflow-hidden rounded-surface bg-desk shadow-[inset_0_0_0_1px_var(--color-line)] select-none">
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-1.5">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        </span>
        <span className="flex items-center gap-1.5 font-mono text-2xs text-fg-3">
          <AIMark name="claude" size={11} /> Claude Code
        </span>
        <Button variant="ghost" size="xs" onClick={() => setRunKey(k => k + 1)} className="ml-auto">
          <RotateCcw /> {t('connectAnimReplay')}
        </Button>
      </div>

      {/* terminal body */}
      <div className="relative h-44 px-3.5 py-3 font-mono text-2xs leading-relaxed">
        {/* command line */}
        <div className="flex items-start gap-1.5">
          <span className="text-green-400 shrink-0">$</span>
          <span className="break-all text-fg">
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
                l.tone === 'ok' ? 'text-green-400' : 'text-fg-3'
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
          <div className="connect-anim-browser absolute right-3 bottom-3 w-52 overflow-hidden rounded-control bg-float shadow-float">
            <div className="flex items-center gap-1 border-b border-line bg-raised px-2 py-1">
              <span className="size-1.5 rounded-full bg-line-strong" />
              <span className="size-1.5 rounded-full bg-line-strong" />
              <span className="flex-1 truncate text-center text-2xs text-fg-3">
                remnus.com
              </span>
            </div>
            <div className="p-2.5 flex flex-col items-center gap-1.5 text-center">
              <span className="text-xs font-semibold tracking-tight text-fg lowercase">
                remnus
              </span>
              <span className="text-2xs leading-tight text-fg-3">
                {t('connectAnimAuthorize')}
              </span>
              <span
                className={`mt-0.5 w-full rounded-sm py-1 text-2xs font-semibold transition-colors ${
                  authorized
                    ? 'bg-green-500 text-white'
                    : 'connect-anim-authbtn bg-ink text-ink-fg'
                }`}
              >
                {authorized ? '✓' : t('connectAnimAuthBtn')}
              </span>
            </div>
          </div>
        )}

        {/* success overlay */}
        {phase === 'success' && (
          <div className="connect-anim-success absolute inset-0 flex flex-col items-center justify-center gap-2 bg-desk/95 backdrop-blur-[1px]">
            <span className="connect-anim-check flex size-11 items-center justify-center rounded-full bg-green-500/15 text-green-400">
              <Check size={22} strokeWidth={3} />
            </span>
            <span className="text-xs font-semibold text-fg">
              {t('connectAnimSuccess')}
            </span>
            <span className="text-2xs text-fg-3">{t('connectAnimSuccessSub')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
