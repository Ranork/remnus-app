'use client';
import { Suspense, useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAsDemo } from '@/lib/actions/demo';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import { AuthCard, AuthDivider, AuthNotice, AuthScreen } from '@/components/features/auth/AuthScreen';
import ProviderButtons from '@/components/features/auth/ProviderButtons';
import { Button } from '@/components/ui/button';
import { getDesktopLoginUrl } from '@/lib/authDesktopLogin';

type TauriState = 'idle' | 'waiting' | 'activating' | 'error';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-desk" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations('Auth');
  // Preserves where the visit came from (e.g. `/install` bounces unauthenticated
  // visitors here with `?callbackUrl=/install?...`) — without this, sign-in always
  // lands on `/app` and drops whatever flow was waiting for the user to return.
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/app';
  const isTauri = useIsTauri();
  const [tauriState, setTauriState] = useState<TauriState>('idle');
  const [openUrlError, setOpenUrlError] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const [demoState, demoFormAction, isDemoPending] = useActionState(loginAsDemo, null);

  function cancelSignIn() {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    deviceIdRef.current = null;
    setTauriState('idle');
  }

  async function handleTauriSignIn() {
    const deviceId = crypto.randomUUID();
    deviceIdRef.current = deviceId;
    setTauriState('waiting');

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const loginUrl = getDesktopLoginUrl(deviceId, window.location.origin);

    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(loginUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Remnus] openUrl failed:', err);
      setOpenUrlError(msg);
      deviceIdRef.current = null;
      setTauriState('error');
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      if (deviceIdRef.current !== deviceId) return;
      try {
        // `cache: 'no-store'` defends against the webview memoizing the first
        // {ready:false} response and serving it on every later poll.
        const res = await fetch(
          `/api/auth/client-poll?device_id=${encodeURIComponent(deviceId)}`,
          { cache: 'no-store' },
        );
        const data: { ready: boolean; token?: string } = await res.json();
        console.log('[client-login] poll', { ready: data.ready, hasToken: !!data.token });
        if (data.ready && data.token) {
          clearInterval(pollIntervalRef.current!);
          clearTimeout(timeoutRef.current!);
          setTauriState('activating');
          window.location.href = `/api/auth/client-activate?token=${encodeURIComponent(data.token)}`;
        }
      } catch (err) {
        // Network error — keep polling
        console.log('[client-login] poll error', err);
      }
    }, 2000);

    timeoutRef.current = setTimeout(() => {
      if (deviceIdRef.current === deviceId) {
        clearInterval(pollIntervalRef.current!);
        setTauriState('error');
      }
    }, 10 * 60 * 1000);
  }

  // The desktop app signs in through the system browser: this screen only starts that
  // trip and waits for the token to come back.
  if (isTauri) {
    const waiting = tauriState === 'waiting' || tauriState === 'activating';
    return (
      <AuthScreen aside={<LanguageSwitcher />}>
        <AuthCard
          title={t('clientLoginTitle')}
          description={waiting ? t('openBrowserInstruction') : t('desktopSignInHint')}
        >
          {tauriState === 'error' && (
            <AuthNotice tone="danger" icon={<AlertCircle />}>
              {t('clientLoginError')}
              {openUrlError && (
                <span className="mt-1 block font-mono text-xs break-all text-fg-3 select-all">{openUrlError}</span>
              )}
            </AuthNotice>
          )}

          {waiting ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="lg" className="w-full" disabled>
                <Loader2 className="animate-spin" aria-hidden />
                {tauriState === 'waiting' ? t('openingBrowser') : t('signingIn')}
              </Button>
              {tauriState === 'waiting' && (
                <Button variant="ghost" className="w-full" onClick={cancelSignIn}>
                  {t('cancelSignIn')}
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                deviceIdRef.current = null;
                setOpenUrlError(null);
                void handleTauriSignIn();
              }}
            >
              {t('signIn')}
            </Button>
          )}
        </AuthCard>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen aside={<LanguageSwitcher />}>
      <AuthCard title={t('signInTitle')} description={t('signInHint')}>
        <ProviderButtons callbackUrl={callbackUrl} />

        <AuthDivider>{t('or')}</AuthDivider>

        <form action={demoFormAction} className="flex flex-col gap-2">
          <Button type="submit" variant="ghost" size="lg" className="w-full" loading={isDemoPending}>
            {t('tryDemo')}
          </Button>
          {demoState?.error ? (
            <p role="alert" className="text-center text-xs text-red-400">{demoState.error}</p>
          ) : (
            <p className="text-center text-xs text-fg-3">{t('demoHint')}</p>
          )}
        </form>
      </AuthCard>
    </AuthScreen>
  );
}

function useIsTauri() {
  return useSyncExternalStore(
    () => () => {},
    () => '__TAURI_INTERNALS__' in window || '__TAURI__' in window,
    () => false,
  );
}
