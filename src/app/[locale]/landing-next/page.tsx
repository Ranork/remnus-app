import type { Metadata } from 'next';
import NextLanding from '@/components/marketing/next/NextLanding';
import { METADATA_BASE_URL } from '@/lib/metadata';

// Draft landing under review. Not indexed and not linked from anywhere, so the
// live landing at `/` stays the only public entry point until this replaces it.
export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: {
    absolute: 'Remnus | Know your project again.',
  },
  description:
    'Your agents build it. You stay in command. Remnus turns what your coding agents build, decide and leave unfinished into pages, boards and dashboards you can actually read.',
  robots: { index: false, follow: false },
};

export default function LandingNextPage() {
  return <NextLanding />;
}
