import LandingFooter from '../LandingFooter';
import NextNav from './NextNav';
import NextHero from './NextHero';
import NextProblem from './NextProblem';
import NextDashboards from './NextDashboards';
import NextMap from './NextMap';
import NextFinalSay from './NextFinalSay';
import NextHowItWorks from './NextHowItWorks';
import {
  NextAgents,
  NextAudience,
  NextClosing,
  NextDemo,
  NextFaq,
  NextPricing,
  NextStory,
  NextTrust,
} from './NextSections';

// Draft of the next landing page, built around one idea: agents build the
// project, the human stays in command. Lives at /landing-next next to the live
// landing (LandingBridgeSwitcher), which it does not touch.
//
// Order follows the visitor's questions: what is it → is this my problem →
// what will I see → how do I stay in control → how do I start → can I trust it.
export default function NextLanding() {
  return (
    <div className="marketing-site min-h-screen bg-neutral-950 text-neutral-100">
      <NextNav />
      <main>
        <NextHero />
        <NextProblem />
        <NextDashboards />
        <NextMap />
        <NextFinalSay />
        <NextHowItWorks />
        <NextDemo />
        <NextAgents />
        <NextTrust />
        <NextAudience />
        <NextStory />
        <NextPricing />
        <NextFaq />
        <NextClosing />
      </main>
      <LandingFooter />
    </div>
  );
}
