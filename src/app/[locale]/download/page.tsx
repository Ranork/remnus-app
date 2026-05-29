import LandingNav from '@/components/marketing/LandingNav';
import LandingFooter from '@/components/marketing/LandingFooter';
import DownloadView from '@/components/marketing/DownloadView';

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <LandingNav />
      <main>
        <DownloadView />
      </main>
      <LandingFooter />
    </div>
  );
}
