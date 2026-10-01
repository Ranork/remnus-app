'use client';
import { useTranslations } from 'next-intl';
import { Check, ListChecks, Minus, X } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/actions/onboarding';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface Props {
  progress: Pick<OnboardingProgress, 'hasToken' | 'hasAgentCall'>;
  /** Collapsed = render a compact sidebar button instead of the full card. */
  collapsed: boolean;
  /** Open the connect-editor flow (used by both pending steps). */
  onConnect: () => void;
  /** Toggle between the full card and the compact button. */
  onToggleCollapse: () => void;
  /** Permanently hide the widget — only offered once every step is done. */
  onDismiss: () => void;
}

type StepId = 'account' | 'connect' | 'call';

/**
 * Persistent sidebar "Getting started" checklist. Steps are derived from real DB
 * state ({@link OnboardingProgress}) — never a stored flag — so the ticks are
 * always truthful. Mirrors the activation funnel: signup → token → first call.
 *
 * A small sheet on the desk like the agents card under it (V2 R8.6). The progress is
 * three bars (the connect flow's step bars); the step that is next carries the one
 * action — connecting an agent is what the product is for, so it is the ink button.
 * Minimizing collapses it into a sidebar row that re-expands on click; a permanent
 * dismiss is only offered once everything is done.
 */
export default function GettingStartedChecklist({
  progress, collapsed, onConnect, onToggleCollapse, onDismiss,
}: Props) {
  const t = useTranslations('Onboarding');

  const steps: { id: StepId; done: boolean }[] = [
    { id: 'account', done: true },
    { id: 'connect', done: progress.hasToken },
    { id: 'call',    done: progress.hasAgentCall },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const activeStepId = steps.find(s => !s.done)?.id;

  if (allDone) {
    return (
      <div className="mx-2 mb-1.5 flex items-center gap-2.5 rounded-surface bg-sheet/70 py-2.5 pr-1.5 pl-3 shadow-lift">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signal text-signal-fg">
          <Check size={13} strokeWidth={3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui font-semibold text-fg">{t('checklistDoneTitle')}</p>
          <p className="truncate text-xs text-fg-3">{t('checklistDoneHint')}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label={t('checklistDismiss')}>
          <X />
        </Button>
      </div>
    );
  }

  // Collapsed: one sidebar row, like the rows around it.
  if (collapsed) {
    return (
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-ui text-fg-2 transition-[background-color,box-shadow] hover:bg-sheet/55 hover:text-fg"
        >
          <ListChecks size={15} className="shrink-0 text-fg-3" aria-hidden />
          <span className="truncate">{t('checklistTitle')}</span>
          <span className="ml-auto shrink-0 text-xs text-fg-3">{doneCount}/{steps.length}</span>
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={t('checklistTitle')}
      className="mx-2 mb-1.5 flex flex-col gap-3 rounded-surface bg-sheet/70 p-3 shadow-lift"
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-ui font-semibold text-fg">{t('checklistTitle')}</p>
        <span className="shrink-0 text-xs text-fg-3">{doneCount}/{steps.length}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-my-1 -mr-1 size-6"
          onClick={onToggleCollapse}
          aria-label={t('checklistCollapse')}
        >
          <Minus />
        </Button>
      </div>

      <div className="flex gap-1" aria-hidden>
        {steps.map((s) => (
          <span key={s.id} className={cn('h-1 flex-1 rounded-full', s.done ? 'bg-signal' : 'bg-hover')} />
        ))}
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step) => {
          const isActive = step.id === activeStepId;
          return (
            <li key={step.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full',
                    step.done
                      ? 'bg-fg-4/35 text-fg-2'
                      : isActive
                        ? 'shadow-[inset_0_0_0_1.5px_var(--color-signal)]'
                        : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
                  )}
                >
                  {step.done && <Check size={10} strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'min-w-0 truncate text-ui',
                    step.done ? 'text-fg-3' : isActive ? 'font-medium text-fg' : 'text-fg-3',
                  )}
                >
                  {t(`checklist_${step.id}`)}
                  {step.done && <span className="sr-only"> ({t('checklistDoneLabel')})</span>}
                </span>
              </div>

              {isActive && step.id === 'connect' && (
                <Button variant="primary" className="ml-6.5" onClick={onConnect}>
                  {t('checklistConnectCta')}
                </Button>
              )}
              {isActive && step.id === 'call' && (
                <div className="ml-6.5 flex flex-col items-start gap-1.5">
                  <p className="text-xs leading-relaxed text-fg-3">{t('checklistCallHint')}</p>
                  <Button variant="secondary" size="sm" onClick={onConnect}>
                    {t('checklistCallCta')}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
