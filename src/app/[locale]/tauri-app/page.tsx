'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/lib/actions/locale';
import { initDesktopZoom } from '@/lib/desktop/zoom';
import { PLATFORM_COOKIE } from '@/lib/constants/cookies';

const SUPPORTED_LOCALES = ['en', 'tr', 'hi', 'es', 'fr', 'de', 'zh', 'ru'];

function detectLocale(): string | null {
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  const primary = lang.split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(primary) ? primary : null;
}

function hasLocaleCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith('NEXT_LOCALE='));
}

export default function TauriEntryPage() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      // Apply saved zoom as early as possible
      initDesktopZoom();

      // Mark this request context as the Tauri desktop shell so server-rendered
      // content routes can defer to the client keep-alive tab host (`TabHost`).
      // Tauri's WebView cookie jar is isolated, so this never reaches a browser.
      document.cookie = `${PLATFORM_COOKIE}=tauri; path=/; max-age=31536000; SameSite=Lax`;

      // Auto-detect OS language on first launch (no cookie yet)
      if (!hasLocaleCookie()) {
        const locale = detectLocale();
        if (locale && locale !== 'en') {
          await setLocale(locale);
        }
      }

      router.replace('/app');
    }
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
    </div>
  );
}
