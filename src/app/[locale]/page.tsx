import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LandingBridgeSwitcher from '@/components/marketing/LandingBridgeSwitcher';

export const metadata: Metadata = {
  title: {
    absolute: 'Remnus | MCP-native workspace for vibe coders',
  },
  description: 'The workspace built for vibe coders and AI agents. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
  alternates: {
    canonical: 'https://remnus.com',
    languages: {
      'en': 'https://remnus.com',
      'tr': 'https://remnus.com',
      'hi': 'https://remnus.com',
      'es': 'https://remnus.com',
      'fr': 'https://remnus.com',
      'de': 'https://remnus.com',
      'x-default': 'https://remnus.com',
    },
  },
  openGraph: {
    title: 'Remnus | MCP-native workspace for vibe coders',
    description: 'The workspace built for vibe coders and AI agents. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
  },
  twitter: {
    title: 'Remnus | MCP-native workspace for vibe coders',
    description: 'The workspace built for vibe coders and AI agents. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
  },
};

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/app');
  return <LandingBridgeSwitcher />;
}
