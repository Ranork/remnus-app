'use client';
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { signIn } from 'next-auth/react';
import { loginAsDemo } from '@/lib/actions/demo';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDesktopLoginUrl } from '@/lib/authDesktopLogin';

type TauriState = 'idle' | 'waiting' | 'activating' | 'error';

export default function LoginPage() {
  const t = useTranslations('Auth');
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

  if (isTauri) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 select-none">
        <img
          src="/logo-square-dark.png"
          alt="Remnus"
          className="w-16 h-16 object-contain rounded-2xl mb-5"
        />
        <h1 className="text-xl font-semibold text-white mb-10 tracking-tight">Remnus</h1>

        {tauriState === 'idle' && (
          <button
            type="button"
            onClick={handleTauriSignIn}
            className="px-10 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
          >
            {t('signIn')}
          </button>
        )}

        {(tauriState === 'waiting' || tauriState === 'activating') && (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm text-neutral-500">
              {tauriState === 'waiting' ? t('openingBrowser') : t('signingIn')}
            </p>
            {tauriState === 'waiting' && (
              <>
                <p className="text-xs text-neutral-600 text-center max-w-55 leading-relaxed">
                  {t('openBrowserInstruction')}
                </p>
                <button
                  type="button"
                  onClick={cancelSignIn}
                  className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mt-1"
                >
                  {t('cancelSignIn')}
                </button>
              </>
            )}
          </div>
        )}

        {tauriState === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-red-400">{t('clientLoginError')}</p>
            {openUrlError && (
              <p className="text-xs text-neutral-600 font-mono text-center max-w-xs break-all select-all">
                {openUrlError}
              </p>
            )}
            <button
              type="button"
              onClick={() => { deviceIdRef.current = null; setOpenUrlError(null); setTauriState('idle'); }}
              className="px-10 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm rounded-lg transition-colors"
            >
              {t('signIn')}
            </button>
          </div>
        )}

        <div className="absolute bottom-6">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>{t('backToHome')}</span>
        </Link>
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/" className="flex flex-col items-center hover:opacity-80 transition-opacity">
            <img
              src="/logo-square-dark.png"
              alt="Remnus"
              className="w-14 h-14 object-contain rounded-xl mb-4 shadow-lg"
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">Remnus</h1>
          </Link>
          <p className="text-neutral-400 text-sm mt-1">{t('signInSubtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-3">
          {/* Google */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/app' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </button>

          {/* GitHub */}
          <button
            type="button"
            onClick={() => signIn('github', { callbackUrl: '/app' })}
            className="w-full flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#2f363d] text-white border border-neutral-800 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <GithubIcon />
            {t('continueWithGithub')}
          </button>
        </div>

        {/* Demo mode */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-neutral-800" />
            <span className="text-xs text-neutral-600">{t('or')}</span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>
          <form action={demoFormAction}>
            <button
              type="submit"
              disabled={isDemoPending}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-neutral-800 text-neutral-400 hover:text-neutral-200 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              <span className="text-base">🧪</span>
              {isDemoPending ? t('loadingDemo') : t('tryDemo')}
            </button>
          </form>
          {demoState?.error && (
            <p className="text-xs text-red-400 text-center mt-2">{demoState.error}</p>
          )}
          <p className="text-center text-xs text-neutral-700 mt-2">
            {t('demoHint')}
          </p>
        </div>

        {/* Language switcher */}
        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

function useIsTauri() {
  return useSyncExternalStore(
    () => () => {},
    () => '__TAURI_INTERNALS__' in window || '__TAURI__' in window,
    () => false,
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-neutral-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
