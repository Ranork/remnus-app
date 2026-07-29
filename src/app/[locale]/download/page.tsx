import type { Metadata } from 'next';
import MarketingShell from '@/components/marketing/MarketingShell';
import DownloadView from '@/components/marketing/DownloadView';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Download',
  description: 'Download Remnus for Windows, macOS, or Linux. The Human-Agent Collaborative Workspace — now as a native desktop app powered by Tauri.',
  alternates: { canonical: 'https://remnus.com/download' },
  openGraph: {
    title: 'Download | Remnus',
    description: 'Download Remnus for Windows, macOS, or Linux. The Human-Agent Collaborative Workspace — now as a native desktop app powered by Tauri.',
    url: 'https://remnus.com/download',
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download | Remnus',
    description: 'Download Remnus for Windows, macOS, or Linux. The Human-Agent Collaborative Workspace — now as a native desktop app powered by Tauri.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function DownloadPage() {
  return (
    <MarketingShell>
      <DownloadView />
    </MarketingShell>
  );
}
