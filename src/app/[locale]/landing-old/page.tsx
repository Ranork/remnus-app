import type { Metadata } from 'next';
import LandingBridgeSwitcher from '@/components/marketing/LandingBridgeSwitcher';
import { METADATA_BASE_URL } from '@/lib/metadata';

// The landing that was live at `/` until R8.7 (2026-10-01), kept for reference next to
// the /landing-next draft. Not indexed and not linked from anywhere.
export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: { absolute: 'Remnus | Human-Agent Collaborative Workspace (previous landing)' },
  robots: { index: false, follow: false },
};

export default function LandingOldPage() {
  return <LandingBridgeSwitcher />;
}
