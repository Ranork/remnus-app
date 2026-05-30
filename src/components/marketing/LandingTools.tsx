import { getTranslations } from 'next-intl/server';

const TOOLS = [
  { scope: 'read',  tool: 'search',               descKey: 'search' },
  { scope: 'read',  tool: 'list_workspace',        descKey: 'list_workspace' },
  { scope: 'read',  tool: 'get_page',              descKey: 'get_page' },
  { scope: 'read',  tool: 'get_database_schema',   descKey: 'get_database_schema' },
  { scope: 'read',  tool: 'query_database',        descKey: 'query_database' },
  { scope: 'write', tool: 'create_page',             descKey: 'create_page' },
  { scope: 'write', tool: 'update_page',             descKey: 'update_page' },
  { scope: 'write', tool: 'bulk_update',             descKey: 'bulk_update' },
  { scope: 'write', tool: 'delete_page',             descKey: 'delete_page' },
  { scope: 'write', tool: 'move_item',               descKey: 'move_item' },
  { scope: 'write', tool: 'create_database',         descKey: 'create_database' },
  { scope: 'write', tool: 'update_database_schema',  descKey: 'update_database_schema' },
] as const;

const RESOURCES = [
  { uri: 'remnus://workspace/{id}/schema', mimeType: 'application/json', descKey: 'bridgeResourcesDescWorkspace' },
  { uri: 'remnus://page/{id}',             mimeType: 'text/markdown',     descKey: 'bridgeResourcesDescPage' },
  { uri: 'remnus://database/{id}/schema',  mimeType: 'application/json', descKey: 'bridgeResourcesDescDatabase' },
  { uri: 'remnus://audit-log/recent',     mimeType: 'application/json', descKey: 'bridgeResourcesDescAuditLog' },
] as const;

const SCOPE_COLORS: Record<string, string> = {
  read:  'var(--color-opt-teal)',
  write: 'var(--color-amber-500)',
};

const MIME_COLORS: Record<string, string> = {
  'application/json': 'var(--color-opt-teal)',
  'text/markdown': 'var(--color-blue-500)',
};

export default async function LandingTools() {
  const t = await getTranslations('Landing');

  // Dynamically resolve tools desc fallback
  const getToolDesc = (toolKey: string) => {
    switch (toolKey) {
      case 'search': return 'Search pages and databases in the workspace by title keyword.';
      case 'list_workspace': return 'List all workspace items (pages & databases). Filter by parentId.';
      case 'get_page': return 'Fetch full content of a page or database row by ID. Auto-detects type.';
      case 'get_database_schema': return 'Get column definitions and select options without fetching rows.';
      case 'query_database': return 'Return schema and rows of a database. Supports property filters.';
      case 'create_page': return 'Create a standalone page or database row with title and content.';
      case 'update_page': return 'Update title, content, or properties of a page. Merges properties safely.';
      case 'bulk_update': return 'Update multiple pages or database rows in a single call.';
      case 'delete_page': return 'Delete a page, database, or row. Requires confirm: true — dry-run by default.';
      case 'move_item': return 'Reparent a sidebar item. Pass null to move to workspace root.';
      case 'create_database': return 'Create a database with a custom column schema. Title column auto-added.';
      case 'update_database_schema': return 'Add or remove columns. Removing requires confirm: true. Title protected.';
      default: return '';
    }
  };

  return (
    <section id="tools" className="px-4 sm:px-8 lg:px-14 py-16 lg:py-27.5 bg-neutral-950">
      <div className="max-w-7xl mx-auto space-y-14">
        
        {/* ── Ortak MCP Başlık Bölümü ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-8 lg:mb-10">
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
              {t('bridgeToolsSnum')}
            </span>
            <span className="flex-1 h-px bg-neutral-800" />
          </div>

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
        </div>

        {/* ── Tablo 1: MCP Tools ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              Protocol Tools <span className="text-dim font-normal">({TOOLS.length})</span>
            </h3>
          </div>

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
                const displayDesc = getToolDesc(row.descKey);
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
                    <span className="text-dim">{displayDesc}</span>
                    <span className="font-mono text-accent-strong text-[12.5px] text-right">
                      {row.tool.includes('create') || row.tool.includes('schema') || row.tool.includes('move') ? 'Result' : 'Page'}
                    </span>
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

        {/* ── Tablo 2: MCP Resources ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              Protocol Resources <span className="text-dim font-normal">({RESOURCES.length})</span>
            </h3>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              {/* header row */}
              <div
                className="grid px-4 lg:px-4.5 py-3 bg-neutral-850 font-mono text-[11px] text-dim uppercase tracking-[0.08em] min-w-[580px]"
                style={{ gridTemplateColumns: '1.2fr 1fr 1.8fr' }}
              >
                <span>{t('bridgeResourcesColUri')}</span>
                <span>{t('bridgeResourcesColMimeType')}</span>
                <span>{t('bridgeResourcesColDesc')}</span>
              </div>

              {RESOURCES.map((row, i) => {
                const mc = MIME_COLORS[row.mimeType];
                return (
                  <div
                    key={i}
                    className="grid items-center px-4 lg:px-4.5 py-3 text-[13px] lg:text-[13.5px] min-w-[580px]"
                    style={{
                      gridTemplateColumns: '1.2fr 1fr 1.8fr',
                      borderTop: '1px solid var(--color-neutral-800)',
                    }}
                  >
                    <span className="font-mono text-neutral-100 font-medium break-all">{row.uri}</span>
                    <span>
                      <span
                        className="font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium px-1.75 py-0.5 rounded-xs"
                        style={{ color: mc, background: `color-mix(in oklab, ${mc} 16%, transparent)` }}
                      >
                        {row.mimeType}
                      </span>
                    </span>
                    <span className="text-dim">{t(row.descKey)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
