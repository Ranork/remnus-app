'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition, useState, useRef, useEffect } from 'react';
import { setLocale } from '@/lib/actions/locale';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
] as const;

type Variant = 'sidebar' | 'compact' | 'header';

export default function LanguageSwitcher({
  compact = false,
  variant,
}: {
  compact?: boolean;
  variant?: Variant;
}) {
  const t = useTranslations('LanguageSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const resolvedVariant: Variant = variant ?? (compact ? 'compact' : 'sidebar');
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(code: string) {
    setOpen(false);
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  const buttonClass =
    resolvedVariant === 'header'
      ? 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-600 rounded-md transition-colors disabled:opacity-50'
      : resolvedVariant === 'compact'
      ? 'flex items-center justify-center w-6 h-6 text-sm rounded hover:bg-neutral-800 transition-colors disabled:opacity-50'
      : 'flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 rounded transition-colors disabled:opacity-50';

  const dropdownClass =
    resolvedVariant === 'header'
      ? 'absolute top-full mt-1.5 right-0 z-50 bg-neutral-900 border border-neutral-800 rounded-md min-w-36 py-1 shadow-xl'
      : resolvedVariant === 'compact'
      ? 'absolute top-full mt-1 right-0 z-50 bg-neutral-900 border border-neutral-800 rounded min-w-35 py-1 shadow-lg'
      : 'absolute bottom-full mb-1 left-0 z-50 bg-neutral-900 border border-neutral-800 rounded min-w-35 py-1 shadow-lg';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        title={t('label')}
        className={buttonClass}
      >
        {resolvedVariant === 'header' ? (
          <>
            <Globe size={13} />
            <span className="uppercase tracking-wide">{current.code}</span>
          </>
        ) : resolvedVariant === 'compact' ? (
          <span>{current.flag}</span>
        ) : (
          <>
            <Globe size={13} />
            <span className="font-medium">{current.flag} {current.label}</span>
          </>
        )}
      </button>

      {open && (
        <div className={dropdownClass}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
                lang.code === locale
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-neutral-300 hover:bg-neutral-800/60'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
