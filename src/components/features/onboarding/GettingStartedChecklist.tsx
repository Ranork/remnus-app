'use client';
import { useTranslations } from 'next-intl';
import { Check, Minus, Plug, Zap, PartyPopper, ArrowRight, ListChecks } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/actions/onboarding';

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

type Step = {
  id: 'account' | 'connect' | 'call';
  done: boolean;
  icon: typeof Plug;
  action?: boolean;
};

/**
 * Persistent sidebar "Getting started" checklist. Steps are derived from real DB
 * state ({@link OnboardingProgress}) — never a stored flag — so the ticks are
 * always truthful. Mirrors the activation funnel: signup → token → first call.
 *
 * Minimizing collapses it into a sidebar-style "Getting started N/3" button
 * (like the AI Agents / Plan / Settings rows) that re-expands on click; a
 * permanent dismiss is only offered once everything is done.
 */
export default function GettingStartedChecklist({
  progress, collapsed, onConnect, onToggleCollapse, onDismiss,
}: Props) {
  const t = useTranslations('Onboarding');

  const steps: Step[] = [
    { id: 'account', done: true,                  icon: Check },
    { id: 'connect', done: progress.hasToken,     icon: Plug, action: true },
    { id: 'call',    done: progress.hasAgentCall, icon: Zap,  action: true },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  // The first not-yet-done actionable step is the one we surface a button on.
  const activeStepId = steps.find(s => !s.done && s.action)?.id;

  if (allDone) {
    return (
      <div className="mx-2 mt-1 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2.5 flex items-center gap-2.5">
        <PartyPopper size={15} className="text-green-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-green-300 truncate">{t('checklistDoneTitle')}</p>
          <p className="text-[10px] text-green-400/70 truncate">{t('checklistDoneHint')}</p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-[10px] font-semibold text-green-300/80 hover:text-green-200 transition-colors"
        >
          {t('checklistDismiss')}
        </button>
      </div>
    );
  }

  // Collapsed: a compact sidebar button matching the AI Agents / Plan / Settings rows.
  if (collapsed) {
    return (
      <div className="px-2 pt-1">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-1.5 min-w-0 px-2 py-1.5 rounded-md text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 transition-all duration-200"
        >
          <ListChecks size={14} className="shrink-0 text-blue-400" />
          <span className="truncate">{t('checklistTitle')}</span>
          <span className="ml-auto shrink-0 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full leading-none">
            {doneCount}/{steps.length}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mt-1 rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span className="text-[11px] font-semibold text-neutral-200">{t('checklistTitle')}</span>
        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full leading-none">
          {doneCount}/{steps.length}
        </span>
        <button
          onClick={onToggleCollapse}
          title={t('checklistCollapse')}
          className="ml-auto p-0.5 text-neutral-600 hover:text-neutral-300 transition-colors rounded"
        >
          <Minus size={13} />
        </button>
      </div>

      <div className="px-2 pb-2 space-y-0.5">
        {steps.map((step) => {
          const isActive = step.id === activeStepId;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-1.5 py-1 rounded-md ${isActive ? 'bg-neutral-800/40' : ''}`}
            >
              <span
                className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center border ${
                  step.done
                    ? 'bg-green-500/15 border-green-500/40 text-green-400'
                    : isActive
                      ? 'border-blue-500/50 text-blue-400'
                      : 'border-neutral-700 text-neutral-600'
                }`}
              >
                {step.done ? <Check size={10} /> : <step.icon size={9} />}
              </span>
              <span
                className={`text-[11px] truncate ${
                  step.done ? 'text-neutral-500 line-through' : isActive ? 'text-neutral-100' : 'text-neutral-400'
                }`}
              >
                {t(`checklist_${step.id}` as 'checklist_connect')}
              </span>
              {isActive && (
                <button
                  onClick={onConnect}
                  className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded transition-colors"
                >
                  {t('checklistGo')} <ArrowRight size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
