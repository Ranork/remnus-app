import LandingNav from './LandingNav';
import LandingHero from './LandingHero';
import LandingWhy from './LandingWhy';
import LandingWhatsInside from './LandingWhatsInside';
import LandingIntegrations from './LandingIntegrations';
import LandingSetup from './LandingSetup';
import LandingTools from './LandingTools';
import LandingPricing from './LandingPricing';
import LandingDownload from './LandingDownload';
import LandingClosing from './LandingClosing';
import LandingFooter from './LandingFooter';

export default function LandingBridgeSwitcher() {
  return (
    <div className="marketing-site min-h-screen bg-neutral-950 text-neutral-100">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingWhy />
        <LandingIntegrations />
        <LandingSetup />
        <LandingWhatsInside />
        <LandingTools />
        <LandingPricing />
        <LandingDownload />
        <LandingClosing />
      </main>
      <LandingFooter />
    </div>
  );
}
