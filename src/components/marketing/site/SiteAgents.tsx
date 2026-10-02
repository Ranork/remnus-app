import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { TOOLS } from '../LandingTools';
import SectionHead from './SectionHead';

const REGISTRIES = [
  { name: 'MCP Registry', score: null, href: 'https://registry.modelcontextprotocol.io' },
  { name: 'Smithery', score: '98/100', href: 'https://smithery.ai/servers/ranorkk/remnus' },
  { name: 'Glama', score: '4.2/5', href: 'https://glama.ai/mcp/connectors/io.github.Ranork/remnus' },
  { name: 'MCP.so', score: null, href: 'https://mcp.so/server/remnus/Ranork' },
];

/** Why an agent works well here: four facts, no cards, and where Remnus is listed. */
export default async function SiteAgents() {
  const t = await getTranslations('Site.agents');
  const facts = [
    { title: t('f1Title', { count: TOOLS.length }), body: t('f1Body') },
    { title: t('f2Title'), body: t('f2Body') },
    { title: t('f3Title'), body: t('f3Body') },
    { title: t('f4Title'), body: t('f4Body') },
  ];

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t('title')} lede={t('lede')} />
        <dl className="m-0 mt-12 grid gap-x-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-x-8">
          {facts.map((fact) => (
            <div key={fact.title} className="border-t border-line-strong py-6">
              <dt className="text-lg font-semibold tracking-[-0.015em] text-fg">{fact.title}</dt>
              <dd className="m-0 mt-2 text-[15px] leading-[1.6] text-fg-2">{fact.body}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
          <span className="text-ui text-fg-3">{t('listedOn')}</span>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {REGISTRIES.map((r) => (
              <li key={r.name}>
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-sm text-fg-2 transition-colors hover:text-fg">
                  {r.name}
                  {r.score && <span className="ml-1.5 text-fg-3">{r.score}</span>}
                </a>
              </li>
            ))}
          </ul>
          <Link href="/wiki" className="text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-3 sm:ml-auto">
            {t('docsLink')}
          </Link>
        </div>
      </div>
    </section>
  );
}
