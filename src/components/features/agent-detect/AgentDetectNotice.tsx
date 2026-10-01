'use client';
import { useTranslations } from 'next-intl';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="mx-2 mt-1 flex items-center gap-2 rounded-control bg-signal-soft py-1.5 pr-1 pl-2.5">
      <Sparkles size={14} className="shrink-0 text-signal-text" />
      <button
        type="button"
        onClick={onConnect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
      >
        <span className="truncate text-xs font-medium text-fg">
          {t('agentDetectNoticeLabel', { count })}
        </span>
        <span className="shrink-0 text-xs font-semibold text-fg-2 underline underline-offset-2 transition-colors hover:text-fg">
          {t('agentDetectNoticeCta')}
        </span>
      </button>
      <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label={t('checklistDismiss')} className="size-6">
        <X />
      </Button>
    </div>
  );
}
