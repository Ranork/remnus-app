import SiteAgents from './SiteAgents';
import SiteApps from './SiteApps';
import SiteClosing from './SiteClosing';
import SiteFaq from './SiteFaq';
import SiteFooter from './SiteFooter';
import SiteHero from './SiteHero';
import SiteNav from './SiteNav';
import SitePricing from './SitePricing';
import SiteProblem from './SiteProblem';
import SiteProduct from './SiteProduct';
import SiteSavings from './SiteSavings';
import SiteSteps from './SiteSteps';

/**
 * The home page (R8.7): the site in the app's own language — the desk as
 * the page, product on sheets, ink actions, yellow for the one thing to do and for what
 * an agent is touching. The previous landing (LandingBridgeSwitcher) is archived at
 * /landing-old and the /landing-next draft stays; `home` is where the brand link points.
 *
 * The story (U1, after the /landing-next draft): agents build fast, so a project stops
 * being understood — Remnus turns their work into pages and dashboards you can read,
 * and you keep the final say. Order follows the visitor: what is it (hero + live stage
 * + the prompt to paste) → why it matters (comprehension debt) → how do I start → what
 * will I see → what does it save me → can any agent work here → what does it cost →
 * where else → what people ask → go. Copy addresses the reader formally where the
 * language has the distinction ("siz", Sie, vous, вы, आप); Spanish keeps tú, Chinese 你.
 */
export default function SiteLanding({ home = '/' }: { home?: string }) {
  return (
    <div className="site min-h-screen bg-desk text-fg">
      <SiteNav home={home} />
      <main>
        <SiteHero />
        <SiteProblem />
        <SiteSteps />
        <SiteProduct />
        <SiteSavings />
        <SiteAgents />
        <SitePricing />
        <SiteApps />
        <SiteFaq />
        <SiteClosing />
      </main>
      <SiteFooter home={home} />
    </div>
  );
}
