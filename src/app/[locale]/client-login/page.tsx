'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <ClientLoginForm />
    </Suspense>
  );
}

function ClientLoginForm() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('device_id') ?? '';

  const bridgeUrl = deviceId
    ? `/api/auth/client-bridge?device_id=${encodeURIComponent(deviceId)}`
    : '/api/auth/client-bridge';

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img
            src="/logo-square-dark.png"
            alt="Remnus"
            className="w-14 h-14 object-contain rounded-xl mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Remnus</h1>
          <p className="text-neutral-400 text-sm mt-1 text-center max-w-xs">
            {t('clientLoginSubtitle')}
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-3">
          {/* Google */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: bridgeUrl })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </button>

          {/* GitHub */}
          <button
            type="button"
            onClick={() => signIn('github', { callbackUrl: bridgeUrl })}
            className="w-full flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#2f363d] text-white border border-neutral-800 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <GithubIcon />
            {t('continueWithGithub')}
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
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
