import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and lets a later Tailwind utility override an earlier one
 *  (`cn('px-2', cond && 'px-4')` → `px-4`). The shadcn/ui components in
 *  src/components/ui/ are built on it; see components.json. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
