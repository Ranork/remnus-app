'use client';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { MarkIcon } from '@/components/features/agents/AgentMark';
import type { AgentMarkName } from '@/components/features/agents/agentMarks';

interface Props {
  /** Recommended path — open the editor-connection flow. */
  onConnect: () => void;
  /** Secondary path — dismiss and let the user explore the workspace manually. */
  onExplore: () => void;
  /** Close (X / backdrop / Esc) — treated like "explore" but without intent signal. */
  onClose: () => void;
}

// The tools people most often connect first; the panel shows them so "your AI agent"
// is something the reader recognises, not an abstraction.
const FIRST_AGENTS: { mark: AgentMarkName; label: string }[] = [
  { mark: 'claude', label: 'Claude Code' },
  { mark: 'cursor', label: 'Cursor' },
  { mark: 'vscode', label: 'VS Code' },
  { mark: 'codex', label: 'Codex' },
  { mark: 'windsurf', label: 'Windsurf' },
];

/**
 * First-run welcome shown once to a brand-new user. Connecting an agent is what Remnus
 * is for, so it is the one primary action, in its own panel; exploring by hand is the
 * quiet way out below it (V2 R8.6). The pre-seeded sample workspace is named as a sample
 * so it isn't mistaken for the user's own data. See {@link OnboardingGuide}.
 */
export default function WelcomeModal({ onConnect, onExplore, onClose }: Props) {
  const t = useTranslations('Onboarding');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" className="dialog-compact:gap-5 dialog-compact:p-6">
        <DialogHeader className="gap-1.5">
          <span className="mb-2 flex size-10 items-center justify-center rounded-control bg-ink text-ink-fg">
            <RemnusMark className="size-5" />
          </span>
          <DialogTitle className="text-xl tracking-[-0.015em]">{t('welcomeTitle')}</DialogTitle>
          <DialogDescription className="text-sm">{t('welcomeSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 rounded-surface bg-raised p-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <ul className="flex flex-wrap items-center gap-1.5">
            {FIRST_AGENTS.map((a) => (
              <li
                key={a.mark}
                title={a.label}
                className="flex size-8 items-center justify-center rounded-control bg-sheet shadow-[inset_0_0_0_1px_var(--color-line)]"
              >
                <MarkIcon mark={a.mark} size={16} />
                <span className="sr-only">{a.label}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-fg">{t('welcomeConnectTitle')}</p>
            <p className="text-xs leading-relaxed text-fg-3">{t('welcomeConnectDesc')}</p>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={onConnect}>
            {t('welcomeConnectCta')}
          </Button>
        </div>

        <Button variant="ghost" className="self-center" onClick={onExplore}>
          {t('welcomeExploreCta')}
        </Button>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-fg-3" aria-hidden />
            <span>{t('welcomeTrust')}</span>
          </p>
          <p className="pl-5.5 text-xs leading-relaxed text-fg-3">{t('welcomeSeedNote')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
