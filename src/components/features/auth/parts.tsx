'use client';

import { useFormStatus } from 'react-dom';
import { Terminal } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * The sheet's one primary action, submitting a server-action form: it spins (and stops a
 * second submit) from the click until the action redirects away.
 */
export function SubmitButton({ children, variant = 'primary', className, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="lg"
      className={cn('w-full', className)}
      loading={pending}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}

/** A workspace's own icon, or its first letter on a quiet tile when it has none. */
export function WorkspaceGlyph({ name, icon, iconColor }: { name: string; icon: string | null; iconColor?: string | null }) {
  if (icon) return <PageIcon icon={icon} iconColor={iconColor} size={18} />;
  return (
    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-sm bg-hover text-2xs font-semibold text-fg-2">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The project directory the CLI ran in — the name the person recognises this setup by.
 * Mono: it is a literal folder name off their disk.
 */
export function ProjectChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-sm bg-raised px-2 text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <Terminal className="size-3.5 shrink-0 text-fg-3" aria-hidden />
      <span className="truncate font-mono">{name}</span>
    </span>
  );
}
