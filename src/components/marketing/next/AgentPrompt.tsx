'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

// The "hand it to your agent" prompt: the request first, the install guide under
// it. Same request and same guide as docs/mcp/project-install.md
// (#hand-it-to-your-agent), laid out on two lines so people can read what they
// are pasting. It points at the GitHub copy on purpose so the agent can read the
// CLI source it runs, and it works in any language, so it is not translated.
export const PROMPT_REQUEST = 'Set up Remnus in this project, then calibrate the workspace to this project.';
export const PROMPT_GUIDE_LABEL = 'Follow this guide:';
export const PROMPT_GUIDE_URL = 'https://github.com/Ranork/remnus-app/blob/master/docs/mcp/project-install.md';
export const AGENT_SETUP_PROMPT = `${PROMPT_REQUEST}\n${PROMPT_GUIDE_LABEL} ${PROMPT_GUIDE_URL}`;

async function copyPrompt(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(AGENT_SETUP_PROMPT);
    return true;
  } catch {
    // Clipboard can be blocked (insecure origin, permissions). The prompt text
    // stays visible and selectable, so failing quietly is fine.
    return false;
  }
}

function useCopy(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (await copyPrompt()) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), resetMs);
    }
  }
  return { copied, copy };
}

/** The prompt itself: request on top, the guide link below, cut off with an ellipsis. */
function PromptText({ truncateLink }: { truncateLink: boolean }) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5 font-mono text-[13px] leading-[1.55]">
      <span className="text-neutral-100">
        <span className="mr-2 text-accent-strong" aria-hidden>›</span>
        {PROMPT_REQUEST}
      </span>
      <span className={`pl-4 text-dim ${truncateLink ? 'truncate' : 'wrap-anywhere'}`}>
        {PROMPT_GUIDE_LABEL} <span className="text-accent-strong">{PROMPT_GUIDE_URL}</span>
      </span>
    </span>
  );
}

/**
 * Hero card: "copy this and you're started". Agent marks and a one-line
 * explanation on top, the prompt with its copy button beside it, and the three
 * things that happen after pasting it.
 */
export function QuickStartCard({
  title,
  body,
  copyLabel,
  copiedLabel,
  steps,
  marks,
}: {
  title: string;
  body: string;
  copyLabel: string;
  copiedLabel: string;
  steps: string[];
  marks: ReactNode;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className="marketing-preview-shadow flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
      <div className="flex items-center gap-3.5">
        <span className="flex shrink-0 items-center -space-x-2" aria-hidden>{marks}</span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-neutral-100">{title}</span>
          <span className="text-[13.5px] text-dim">{body}</span>
        </div>
      </div>

      {/* Copy button sits beside the prompt; on phones it drops under it, full width. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 select-all rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <PromptText truncateLink />
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? copiedLabel : copyLabel}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border py-2.5 sm:w-[88px] sm:flex-col sm:gap-1.5 sm:py-0 text-[12.5px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            copied
              ? 'border-green-500/40 bg-green-500/10 text-green-500'
              : 'border-blue-500/40 bg-blue-500/10 text-accent-strong hover:border-blue-500/70 hover:bg-blue-500/15'
          }`}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>

      {/* What pasting it does — the actual sequence, so it is numbered. */}
      <ol className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-3 sm:gap-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-[12.5px] leading-snug text-neutral-50">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-800 font-mono text-[10.5px] text-accent-strong">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Full-width version used further down the page, with the complete link visible. */
export default function AgentPrompt({
  label,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-left">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-neutral-50 transition-colors hover:bg-neutral-800/60 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div className="select-all px-4 py-3.5">
        <PromptText truncateLink={false} />
      </div>
    </div>
  );
}
