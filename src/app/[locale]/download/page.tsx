import type { Metadata } from 'next';
import MarketingShell from '@/components/marketing/MarketingShell';
import DownloadView from '@/components/marketing/DownloadView';

export const metadata: Metadata = {
  title: 'Download',
  description: 'Download Remnus for Windows, macOS, or Linux. The MCP-native workspace for vibe coders — now as a native desktop app powered by Tauri.',
  alternates: { canonical: 'https://remnus.com/download' },
  openGraph: {
    title: 'Download | Remnus',
    description: 'Download Remnus for Windows, macOS, or Linux. The MCP-native workspace for vibe coders — now as a native desktop app powered by Tauri.',
    url: 'https://remnus.com/download',
  },
};

export default function DownloadPage() {
  return (
    <MarketingShell>
      <DownloadView />
    </MarketingShell>
  );
}
