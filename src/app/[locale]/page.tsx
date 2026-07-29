import type { Metadata } from 'next';
import LandingBridgeSwitcher from '@/components/marketing/LandingBridgeSwitcher';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: {
    absolute: 'Remnus | Human-Agent Collaborative Workspace',
  },
  description: 'Remnus is the Human-Agent Collaborative Workspace. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
  alternates: {
    canonical: 'https://remnus.com',
    languages: {
      'en': 'https://remnus.com',
      'tr': 'https://remnus.com',
      'hi': 'https://remnus.com',
      'es': 'https://remnus.com',
      'fr': 'https://remnus.com',
      'de': 'https://remnus.com',
      'zh': 'https://remnus.com',
      'ru': 'https://remnus.com',
      'x-default': 'https://remnus.com',
    },
  },
  openGraph: {
    title: 'Remnus | Human-Agent Collaborative Workspace',
    description: 'Remnus is the Human-Agent Collaborative Workspace. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
    url: METADATA_BASE_URL,
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remnus | Human-Agent Collaborative Workspace',
    description: 'Remnus is the Human-Agent Collaborative Workspace. Build databases, kanban boards, and pages that Claude, Cursor, Windsurf, and any MCP client can read and write.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function HomePage() {
  return <LandingBridgeSwitcher />;
}
