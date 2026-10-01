'use client';
import { useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';

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
    <SettingsPage>
      <SettingsSection title={t('mcpHeroTitle')} description={t('mcpHeroSubtitle')}>
        <p className="text-xs leading-relaxed text-fg-2">{t('tokensManagedInCenter')}</p>
        <Button variant="primary" className="self-start" onClick={onOpenAgents}>
          <Bot />
          {t('openAgentsCenter')}
        </Button>
      </SettingsSection>
    </SettingsPage>
  );
}
