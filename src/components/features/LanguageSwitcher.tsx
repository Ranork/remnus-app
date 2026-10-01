'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check, Globe } from 'lucide-react';
import { setLocale } from '@/lib/actions/locale';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import FlagIcon from './FlagIcon';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
] as const;

type Variant = 'sidebar' | 'compact' | 'header';

/**
 * The language menu. `sidebar` (default) is the quiet ghost button the sign-in screens
 * put on the desk; `header` is the marketing nav's bordered code button (its own pass is
 * R8.7); `compact` shows the flag alone. The menu is the shared DropdownMenu.
 */
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

  const resolvedVariant: Variant = variant ?? (compact ? 'compact' : 'sidebar');
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  function handleSelect(code: string) {
    if (code === locale) return;
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  const triggerClass =
    resolvedVariant === 'header'
      ? 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-600 rounded-md transition-colors disabled:opacity-50'
      : resolvedVariant === 'compact'
        ? cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))
        : cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'data-popup-open:bg-hover data-popup-open:text-fg');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={resolvedVariant === 'sidebar' ? `${t('label')}: ${current.label}` : t('label')}
        className={triggerClass}
      >
        {resolvedVariant === 'header' ? (
          <>
            <Globe size={13} />
            <span className="uppercase tracking-wide">{current.code}</span>
          </>
        ) : resolvedVariant === 'compact' ? (
          <FlagIcon code={current.code} size={18} />
        ) : (
          <>
            <Globe aria-hidden />
            <span lang={current.code}>{current.label}</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => handleSelect(lang.code)}>
            <FlagIcon code={lang.code} size={16} />
            <span lang={lang.code} className="flex-1">{lang.label}</span>
            {lang.code === locale && <Check className="text-fg" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
