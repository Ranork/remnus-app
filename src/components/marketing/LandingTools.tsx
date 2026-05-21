import { getTranslations } from 'next-intl/server';

const TOOLS = [
  { scope: 'read',  tool: 'search',          desc: 'Search pages and databases in the workspace by title keyword.',       ret: 'Result[]' },
  { scope: 'read',  tool: 'list_workspace',  desc: 'List all workspace items (pages & databases). Filter by parentId.',  ret: 'Item[]'   },
  { scope: 'read',  tool: 'get_page',        desc: 'Fetch full content of a page or database row by ID.',                ret: 'Page'     },
  { scope: 'read',  tool: 'query_database',  desc: 'Return schema and rows of a database. Limit up to 50 rows.',         ret: 'DbResult' },
  { scope: 'write', tool: 'create_page',     desc: 'Create a standalone page or database row with title and content.',   ret: '{ id }'   },
  { scope: 'write', tool: 'update_page',     desc: 'Update title, markdown content, or properties of an existing page.', ret: '{ updated }' },
] as const;

const SCOPE_COLORS: Record<string, string> = {
  read:  'var(--color-opt-teal)',
  write: 'var(--color-amber-500)',
};

export default async function LandingTools() {
  const t = await getTranslations('Landing');

  return (
    <section id="tools" className="px-4 sm:px-8 lg:px-14 py-16 lg:py-27.5">
      <div className="max-w-7xl mx-auto">
        {/* section header */}
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
            {t('bridgeToolsSnum')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>

        {/* title */}
        <div className="mb-8 lg:mb-9">
          <h2
            className="m-0 mb-1.5 font-sans font-semibold text-neutral-100 leading-[0.98] text-[26px] sm:text-[32px] lg:text-[40px]"
            style={{ letterSpacing: '-0.035em' }}
          >
            {t('bridgeToolsH2Part1')}{' '}
            <span className="font-serif italic text-accent-strong text-[30px] sm:text-[36px] lg:text-[44px]">
              {t('bridgeToolsH2Accent')}
            </span>{' '}
            {t('bridgeToolsH2Part2')}
          </h2>
          <p className="m-0 text-[14px] lg:text-[15px] text-dim">{t('bridgeToolsSubhead')}</p>
        </div>

        {/* tools table — horizontally scrollable on mobile */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            {/* header row */}
            <div
              className="grid px-4 lg:px-4.5 py-3 bg-neutral-850 font-mono text-[11px] text-dim uppercase tracking-[0.08em] min-w-[580px]"
              style={{ gridTemplateColumns: '80px 1.4fr 1.5fr 0.6fr' }}
            >
              <span>{t('bridgeToolsColScope')}</span>
              <span>{t('bridgeToolsColTool')}</span>
              <span>{t('bridgeToolsColDesc')}</span>
              <span className="text-right">{t('bridgeToolsColReturns')}</span>
            </div>

            {TOOLS.map((row, i) => {
              const sc = SCOPE_COLORS[row.scope];
              return (
                <div
                  key={i}
                  className="grid items-center px-4 lg:px-4.5 py-3 text-[13px] lg:text-[13.5px] min-w-[580px]"
                  style={{
                    gridTemplateColumns: '80px 1.4fr 1.5fr 0.6fr',
                    borderTop: '1px solid var(--color-neutral-800)',
                  }}
                >
                  <span>
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium px-1.75 py-0.5 rounded-xs"
                      style={{ color: sc, background: `color-mix(in oklab, ${sc} 16%, transparent)` }}
                    >
                      {row.scope}
                    </span>
                  </span>
                  <span className="font-mono text-neutral-100 font-medium">{row.tool}</span>
                  <span className="text-dim">{row.desc}</span>
                  <span className="font-mono text-accent-strong text-[12.5px] text-right">{row.ret}</span>
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div
            className="flex items-center gap-2 px-4 lg:px-4.5 py-3.5 bg-neutral-850 text-[12.5px]"
            style={{ borderTop: '1px solid var(--color-neutral-800)' }}
          >
            <span className="text-dim">{t('bridgeToolsFooterText')}</span>
            <span className="flex-1" />
            <a href="#" className="font-mono text-accent-strong text-[12.5px]">
              {t('bridgeToolsReferenceLink')} ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
