import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';

/**
 * Who is giving the gift (Remnus, an ink tile) and who it is for (the invited app's own
 * logo): the co-brand lockup of a prospect invite — on /welcome/[token] and in the
 * reminder a visitor carries around the site (PendingGiftToast).
 */
export function GiftLockup({
  appName,
  appLogoUrl,
  size = 'default',
}: {
  appName: string;
  appLogoUrl: string | null;
  size?: 'sm' | 'default';
}) {
  const tile = size === 'sm' ? 'size-7 rounded-sm' : 'size-10 rounded-control';
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex shrink-0 items-center justify-center bg-ink text-ink-fg', tile)}>
        <RemnusMark className={size === 'sm' ? 'size-3.5' : 'size-5'} title="Remnus" />
      </span>
      <span aria-hidden className="text-sm text-fg-4">×</span>
      {appLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Scout Forge asset; not worth a next/image remotePatterns entry for a one-off outreach link
        <img src={appLogoUrl} alt={appName} className={cn('shrink-0 object-cover', tile)} />
      ) : (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center bg-raised font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]',
            tile,
            size === 'sm' ? 'text-2xs' : 'text-sm',
          )}
        >
          {appName.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
