import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

// What `/app` shows when there is nothing to open: no workspace yet (`?none=1`), or a
// workspace without items. `/app` itself is a route handler that only redirects (see
// `lib/server/appEntry.ts`), so the empty state needs a page of its own.
export default async function AppEmptyPage({
  searchParams,
}: {
  searchParams: Promise<{ none?: string }>;
}) {
  const { none } = await searchParams;
  const t = await getTranslations('Home');

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 h-full">
      <Image
        src="/logo-square-transparent.png"
        alt="Remnus"
        width={52}
        height={52}
        className="opacity-20"
      />
      <h2 className="text-base font-medium text-neutral-300">{t('welcomeTitle')}</h2>
      <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
        {none ? t('noWorkspaceHint') : t('emptyWorkspaceHint')}
      </p>
    </div>
  );
}
