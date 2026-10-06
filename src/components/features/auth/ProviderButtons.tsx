'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { GitHubMark } from '@/components/ui/github-mark';

/**
 * "Continue with Google / GitHub" on the sign-in screens. Both are the neutral secondary
 * button with the provider's own mark (Google's G keeps its colours, GitHub's mark takes
 * the text colour so it reads in both themes). The clicked one spins until the browser
 * leaves for the provider.
 */
export default function ProviderButtons({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('Auth');
  const [pending, setPending] = useState<'google' | 'github' | null>(null);

  function go(provider: 'google' | 'github') {
    setPending(provider);
    signIn(provider, { callbackUrl }).catch(() => setPending(null));
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        loading={pending === 'google'}
        disabled={pending !== null}
        onClick={() => go('google')}
      >
        <GoogleIcon />
        {t('continueWithGoogle')}
      </Button>
      <Button
        size="lg"
        className="w-full"
        loading={pending === 'github'}
        disabled={pending !== null}
        onClick={() => go('github')}
      >
        <GitHubMark className="size-[18px]" />
        {t('continueWithGithub')}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

