import SiteAgents from './SiteAgents';
import SiteApps from './SiteApps';
import SiteClosing from './SiteClosing';
import SiteFooter from './SiteFooter';
import SiteHero from './SiteHero';
import SiteNav from './SiteNav';
import SitePricing from './SitePricing';
import SiteProduct from './SiteProduct';
import SiteSavings from './SiteSavings';
import SiteSteps from './SiteSteps';

/**
 * The home page (R8.7): the site in the app's own language — the desk as
 * the page, product on sheets, ink actions, yellow for the one thing to do and for what
 * an agent is touching. The previous landing (LandingBridgeSwitcher) is archived at
 * /landing-old and the /landing-next draft stays; `home` is where the brand link points.
 *
 * Order follows the visitor: what is it (hero + live stage) → how do I start → what
 * will I see → what does it save me → can my agent work well here → what does it cost →
 * where else → go.
 */
export default function SiteLanding({ home = '/' }: { home?: string }) {
  return (
    <div className="site min-h-screen bg-desk text-fg">
      <SiteNav home={home} />
      <main>
        <SiteHero />
        <SiteSteps />
        <SiteProduct />
        <SiteSavings />
        <SiteAgents />
        <SitePricing />
        <SiteApps />
        <SiteClosing />
      </main>
      <SiteFooter home={home} />
    </div>
  );
}
