import Link from '@/components/ui/link';
import { Card } from '@/components/ui/card';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';

// The screens a person meets before (or on the way into) the app: sign-in, the project
// connect/join links, OAuth consent, invites, the account-deletion confirm, and what each
// of those says when it is done or spent (V2 R8.6). The same "desk and sheet" as the app:
// the brand sits on the desk where the sidebar would be, the screen's one job is a single
// sheet (Card on="desk") in the middle. Text in the sheet is left-aligned — it reads as a
// short document, not a splash. Server-safe (no hooks): the pages render it directly.

export function AuthScreen({
  children,
  aside,
  footer,
  width = 'sm',
}: {
  children: React.ReactNode;
  /** Top-right of the desk (the language switcher). */
  aside?: React.ReactNode;
  /** A quiet line under the sheet (what happens next, how to undo it). */
  footer?: React.ReactNode;
  /** `md` for a sheet with a form that needs the room (the welcome gift). */
  width?: 'sm' | 'md';
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-desk text-fg-2">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="-mx-1.5 flex items-center gap-2 rounded-control px-1.5 py-1 text-fg transition-opacity hover:opacity-75"
        >
          <RemnusMark className="size-5" />
          <span className="text-sm font-semibold tracking-[-0.01em]">Remnus</span>
        </Link>
        {aside}
      </header>
      {/* The bottom padding stands clear of the cookie strip while it is up. */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-2 pb-[calc(var(--consent-banner-height,0px)+4rem)] sm:pb-[calc(var(--consent-banner-height,0px)+5rem)]">
        <div className={cn('w-full', width === 'md' ? 'max-w-md' : 'max-w-sm')}>
          {children}
          {footer && <div className="mt-4 px-2 text-center text-xs leading-relaxed text-fg-3">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** The screen's sheet: a title, an optional line under it, then the content. */
export function AuthCard({
  title,
  description,
  meta,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Under the description: who is signed in, which project this is about. */
  meta?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-6 p-6 sm:p-7', className)}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-balance text-fg">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-fg-3">{description}</p>}
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {children}
    </Card>
  );
}

const STATUS_TONE = {
  neutral: 'text-fg-3',
  success: 'text-green-400',
  danger: 'text-red-400',
  warning: 'text-amber-400',
} as const;

/**
 * A screen that has nothing left to fill in: done, spent, expired, refused. The icon
 * carries the state in its semantic colour; the text says what happened and what to do.
 */
export function AuthStatus({
  icon,
  tone = 'neutral',
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  tone?: keyof typeof STATUS_TONE;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="items-start gap-5 p-6 sm:p-7">
      <span
        aria-hidden
        className={cn(
          'flex size-10 items-center justify-center rounded-full bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] [&_svg]:size-5',
          STATUS_TONE[tone],
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-balance text-fg">{title}</h1>
        {children && <div className="text-sm leading-relaxed text-fg-3">{children}</div>}
      </div>
      {action}
    </Card>
  );
}

/** A labelled block inside the sheet (a choice, a field group). */
export function AuthSection({
  label,
  labelId,
  children,
  className,
}: {
  label: React.ReactNode;
  /** Lets a radio group name itself after the label (`aria-labelledby`). */
  labelId?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p id={labelId} className="text-xs font-medium text-fg-2">{label}</p>
      {children}
    </div>
  );
}

/** A line of context inside the sheet: an error (red icon), or a neutral state. */
export function AuthNotice({
  icon,
  tone = 'neutral',
  children,
  className,
}: {
  icon?: React.ReactNode;
  tone?: 'neutral' | 'danger';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'flex gap-2.5 rounded-control px-3 py-2.5 text-ui leading-relaxed text-fg-2 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'danger'
          ? 'bg-red-500/10 [&_svg]:text-red-400'
          : 'bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] [&_svg]:text-fg-3',
        className,
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** "or" between two ways in. */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-fg-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** A literal command or directory name, set in mono (it is machine text). */
export function AuthCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-raised px-1 py-px font-mono text-[0.92em] text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
      {children}
    </code>
  );
}
