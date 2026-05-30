import LandingNav from './LandingNav';
import LandingFooter from './LandingFooter';

interface Props {
  children: React.ReactNode;
}

export default async function MarketingShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-between">
      <LandingNav />
      <main className="grow">{children}</main>
      <LandingFooter />
    </div>
  );
}
