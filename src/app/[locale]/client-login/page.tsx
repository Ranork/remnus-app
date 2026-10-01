'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import { AuthCard, AuthScreen } from '@/components/features/auth/AuthScreen';
import ProviderButtons from '@/components/features/auth/ProviderButtons';

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-desk" />}>
      <ClientLoginForm />
    </Suspense>
  );
}

// The browser half of the desktop app's sign-in: the app opened this page with its
// device id, and the bridge hands the session back to the app once a provider is done.
function ClientLoginForm() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('device_id') ?? '';

  const bridgeUrl = deviceId
    ? `/api/auth/client-bridge?device_id=${encodeURIComponent(deviceId)}`
    : '/api/auth/client-bridge';

  return (
    <AuthScreen aside={<LanguageSwitcher />}>
      <AuthCard title={t('clientLoginTitle')} description={t('clientLoginSubtitle')}>
        <ProviderButtons callbackUrl={bridgeUrl} />
      </AuthCard>
    </AuthScreen>
  );
}
