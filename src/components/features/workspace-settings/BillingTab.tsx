'use client';
import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';

interface BillingTabProps {
  /** Closes Workspace Settings and opens the global Billing center. */
  onOpenBilling: () => void;
}

/**
 * Thin redirect tab. Billing is per-user (the billing owner's seat pool), so it
 * lives in the global {@link BillingModal} rather than a per-workspace surface.
 */
export default function BillingTab({ onOpenBilling }: BillingTabProps) {
  const t = useTranslations('Billing');

  return (
    <SettingsPage>
      <SettingsSection title={t('tabHeroTitle')} description={t('tabHeroSubtitle')}>
        <Button variant="primary" className="self-start" onClick={onOpenBilling}>
          <CreditCard />
          {t('openBilling')}
        </Button>
      </SettingsSection>
    </SettingsPage>
  );
}
