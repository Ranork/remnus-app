'use client';

import Link from '@/components/ui/link';
import { Menu } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { SiteLink } from './SiteNav';

/** Below `lg` the nav links fold into one menu. */
export default function SiteMobileMenu({
  label,
  links,
  signIn,
}: {
  label: string;
  links: SiteLink[];
  signIn: SiteLink | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'lg:hidden')}>
        <Menu aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {links.map((l) => (
          <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
            {l.label}
          </DropdownMenuItem>
        ))}
        {signIn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={signIn.href} />}>{signIn.label}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
