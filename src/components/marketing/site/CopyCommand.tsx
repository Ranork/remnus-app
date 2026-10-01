'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A shell command with a copy button that says "Copied" for a moment. */
export default function CopyCommand({ command, copyLabel, copiedLabel }: { command: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center gap-2 rounded-control bg-raised py-1.5 pr-1.5 pl-3.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <code className="min-w-0 flex-1 truncate font-mono text-ui text-fg">
        <span className="mr-2 text-fg-4 select-none">$</span>
        {command}
      </code>
      <Button
        variant="ghost"
        size="sm"
        aria-label={copied ? copiedLabel : copyLabel}
        onClick={() => {
          void navigator.clipboard?.writeText(command).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? <Check className="text-green-400" /> : <Copy />}
        <span className="hidden sm:inline">{copied ? copiedLabel : copyLabel}</span>
      </Button>
    </div>
  );
}
