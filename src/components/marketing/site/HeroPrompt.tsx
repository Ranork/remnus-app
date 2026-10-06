'use client';

import AIMark, { type AIMarkName } from '../AIMark';
// The canonical setup prompt (request + install guide). It lives with the /landing-next
// draft that introduced it; it is not translated, because it works in any language.
import { AGENT_SETUP_PROMPT, PROMPT_GUIDE_LABEL, PROMPT_GUIDE_URL, PROMPT_REQUEST } from '../next/AgentPrompt';
import { CopyButton } from './CopyCommand';

const MARKS: AIMarkName[] = ['claude', 'codex', 'cursor'];

export type HeroPromptCopy = { title: string; body: string; copy: string; copied: string; steps: string[] };

/**
 * The hero's fastest way in: paste one prompt into the agent you already use. Who it
 * is for (marks + one line), the prompt with the site's copy button, and the three
 * things that happen after pasting it — an actual sequence, so they are numbered.
 */
export default function HeroPrompt({ copy }: { copy: HeroPromptCopy }) {
  return (
    <div className="rounded-surface bg-sheet p-4 shadow-sheet sm:p-5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-8 lg:p-6">
      <div className="flex items-center gap-3.5 lg:col-span-4">
        <span className="site-marks flex shrink-0 items-center -space-x-2 text-fg-2" aria-hidden>
          {MARKS.map((id) => (
            <span key={id} className="flex size-9 items-center justify-center rounded-full bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] ring-2 ring-sheet">
              <AIMark name={id} size={16} />
            </span>
          ))}
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-fg">{copy.title}</p>
          <p className="m-0 mt-0.5 text-ui text-fg-3">{copy.body}</p>
        </div>
      </div>

      <div className="mt-4 lg:col-span-8 lg:mt-0">
        <div className="flex items-start gap-2 rounded-control bg-raised py-2 pr-1.5 pl-3.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <div className="min-w-0 flex-1 py-0.5 font-mono text-ui leading-[1.55] select-all">
            <div className="text-fg">
              <span className="mr-2 text-fg-4 select-none" aria-hidden>
                ›
              </span>
              {PROMPT_REQUEST}
            </div>
            <div className="truncate pl-4 text-fg-3">
              {PROMPT_GUIDE_LABEL} {PROMPT_GUIDE_URL}
            </div>
          </div>
          <CopyButton text={AGENT_SETUP_PROMPT} copyLabel={copy.copy} copiedLabel={copy.copied} />
        </div>
        <ol className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-3 sm:gap-4">
          {copy.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-2.5 text-ui text-fg-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
