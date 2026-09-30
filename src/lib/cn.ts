import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge has to know the design tokens globals.css adds (V2 R8), or it misfiles
// them: `text-ui` read as a text COLOUR made `cn('text-ink-fg', 'text-ui')` drop the
// colour. Keep this list in step with the @theme block.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'ui'],
      radius: ['control', 'surface'],
      shadow: ['lift', 'sheet', 'float', 'modal'],
    },
  },
});

/** Joins class names and lets a later Tailwind utility override an earlier one
 *  (`cn('px-2', cond && 'px-4')` → `px-4`). The shadcn/ui components in
 *  src/components/ui/ are built on it; see components.json. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
