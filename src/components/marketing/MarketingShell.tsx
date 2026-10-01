import SiteFooter from './site/SiteFooter';
import SiteNav from './site/SiteNav';

interface Props {
  children: React.ReactNode;
}

/**
 * The frame of every public page that isn't the landing (pricing, download, contact,
 * privacy, security, brand, wiki, docs): the site's nav and footer around the page on the
 * desk, in the app's own role tokens (`.site`, R8.7).
 */
export default async function MarketingShell({ children }: Props) {
  return (
    <div className="site flex min-h-screen flex-col bg-desk text-fg">
      <SiteNav home="/" />
      <main className="grow">{children}</main>
      <SiteFooter home="/" />
    </div>
  );
}
