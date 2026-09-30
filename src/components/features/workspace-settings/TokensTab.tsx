'use client';
import { useTranslations } from 'next-intl';
import { Zap, ArrowRight, Bot } from 'lucide-react';

interface TokensTabProps {
  /** Closes Workspace Settings and opens the AI Agents control center. */
  onOpenAgents: () => void;
}

/**
 * Thin redirect tab. All token / editor-connect management now lives in the
 * AI Agents control center ({@link AgentsModal}); this tab just points there.
 */
export default function TokensTab({ onOpenAgents }: TokensTabProps) {
  const t = useTranslations('WorkspaceSettings');

  return (
    <div className="space-y-6">
      <div className="border border-amber-500/20 rounded-xl p-5 space-y-4 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-neutral-100">{t('mcpHeroTitle')}</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">{t('mcpHeroSubtitle')}</p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">{t('tokensManagedInCenter')}</p>

        <button
          onClick={onOpenAgents}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-ink-fg bg-ink hover:bg-ink/88 px-5 py-3 rounded-lg transition-colors"
        >
          <Bot size={16} />
          {t('openAgentsCenter')}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
