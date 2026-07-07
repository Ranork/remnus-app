'use client';
import { useTranslations } from 'next-intl';
import { Sparkles, X } from 'lucide-react';

interface Props {
  count: number;
  onConnect: () => void;
  onDismiss: () => void;
}

/**
 * Persistent sidebar pill reminding the user that AgentDetectModal found tools
 * on this device. Shown after the modal is dismissed (or on later launches);
 * has its own independent close, separate from the modal's own dismiss.
 */
export default function AgentDetectNotice({ count, onConnect, onDismiss }: Props) {
  const t = useTranslations('Onboarding');

  return (
    <div className="mx-2 mt-1 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
      <Sparkles size={14} className="shrink-0 text-emerald-400" />
      <button
        onClick={onConnect}
        className="min-w-0 flex-1 flex items-center gap-1.5 text-left"
      >
        <span className="truncate text-[11px] font-medium text-emerald-200">
          {t('agentDetectNoticeLabel', { count })}
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-emerald-300 hover:text-emerald-100 transition-colors underline underline-offset-2">
          {t('agentDetectNoticeCta')}
        </span>
      </button>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 text-emerald-400/60 hover:text-emerald-200 transition-colors rounded"
        aria-label={t('checklistDismiss')}
      >
        <X size={12} />
      </button>
    </div>
  );
}
