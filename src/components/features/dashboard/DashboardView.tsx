import { getTranslations } from 'next-intl/server';
import { CircleAlert, LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { WorkspaceMember } from '@/components/features/MembersContext';
import type { DashboardItem } from '@/lib/actions/dashboard';
import type { ResolvedBlock, ResolvedDashboard } from '@/lib/dashboard/data';
import { blockWidth } from '@/lib/dashboard/schema';
import DashboardHeader from './DashboardHeader';
import DashboardBlockActions from './DashboardBlockActions';
import DashboardAddBlock from './DashboardAddBlock';
import DashboardDatabaseEmbed from './DashboardDatabaseEmbed';
import AgentSavingsCard from '@/components/features/AgentSavingsCard';
import {
  ActivityBlockView,
  BlockInvalid,
  BlockUnavailable,
  ChartBlockView,
  LinksBlockView,
  ListBlockView,
  MetricBlockView,
  ProjectBlockView,
  TextBlockView,
} from './DashboardBlocks';

/**
 * A dashboard, rendered entirely on the server.
 *
 * Every block's data is already resolved by `resolveDashboard` before this
 * component runs — there is no per-block client fetch, so the page arrives
 * complete in one response rather than as a grid of spinners that each open
 * their own round trip.
 *
 * The three failure states are all local to one tile: a block whose source
 * was deleted, a block whose column no longer exists, and a block this build
 * cannot read at all. None of them can take the page down.
 */

// Phone: one column. Tablet: two, so quarter tiles (the metrics) sit in pairs instead of
// each taking a whole row. Desktop: the four-column grid the spec is written against.
const SPAN_CLASS = {
  quarter: 'col-span-1',
  half: 'col-span-1 sm:col-span-2',
  full: 'col-span-1 sm:col-span-2 lg:col-span-4',
} as const;

/** Blocks that bring their own surface: drawn without the tile around them. */
const CHROMELESS = new Set(['project', 'savings']);

function blockKey(entry: ResolvedBlock, index: number): string {
  return entry.kind === 'invalid' ? `invalid-${entry.id ?? index}` : entry.block.id;
}

function blockTitle(entry: ResolvedBlock): string | undefined {
  return entry.kind === 'invalid' ? undefined : entry.block.title;
}

export default async function DashboardView({
  item,
  resolved,
  members,
}: {
  item: DashboardItem;
  resolved: ResolvedDashboard;
  members: WorkspaceMember[];
}) {
  const t = await getTranslations('Dashboard');
  const blocks = resolved.blocks;
  // A home dashboard opens with its project block — the workspace name set large. Then the
  // dashboard's own title steps down to a small label, so the page has one title (V2 R8).
  const hasProjectHead = blocks.some((b) => b.kind === 'project');

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-10 sm:py-10">
      <DashboardHeader
        itemId={item.id}
        workspaceId={item.workspaceId}
        initialTitle={item.title}
        initialIcon={item.icon}
        initialIconColor={item.iconColor}
        blockCount={blocks.length}
        isHome={item.isHome}
        compact={hasProjectHead}
      />

      {resolved.fatal && (
        <div className="mb-5 flex items-start gap-2 border-b border-line pb-4 text-ui text-fg-2">
          <CircleAlert size={16} className="mt-px shrink-0 text-amber-400" />
          <div>
            <p>{t('specUnreadable')}</p>
            <p className="mt-1 font-mono text-2xs text-fg-4">{resolved.fatal}</p>
          </div>
        </div>
      )}

      {blocks.length === 0 && !resolved.fatal ? (
        <EmptyDashboard itemId={item.id} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {blocks.map((entry, index) => {
            const span = entry.kind === 'invalid' ? SPAN_CLASS.half : SPAN_CLASS[blockWidth(entry.block)];
            const id = entry.kind === 'invalid' ? entry.id : entry.block.id;
            const title = blockTitle(entry);
            const actions = id && (
              <DashboardBlockActions
                itemId={item.id}
                blockId={id}
                block={entry.kind === 'invalid' ? undefined : entry.block}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            );

            if (CHROMELESS.has(entry.kind)) {
              // The project header opens the page: no tile, space under it instead.
              const isHeader = entry.kind === 'project';
              return (
                <section
                  key={blockKey(entry, index)}
                  className={`group/block relative min-w-0 ${span} ${isHeader ? 'mb-3 pb-2' : ''}`}
                >
                  <div className="absolute right-2 top-2 z-10">{actions}</div>
                  <BlockBody entry={entry} members={members} />
                </section>
              );
            }

            return (
              <section
                key={blockKey(entry, index)}
                className={`group/block relative flex min-w-0 flex-col rounded-surface bg-raised p-4 shadow-sheet lg:bg-sheet ${span}`}
              >
                {/* An untitled tile (a note, a bare number) spends no row on an empty heading. */}
                {title ? (
                  <header className="mb-3 flex min-h-5 items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate text-ui font-medium text-fg-3">{title}</h2>
                    {actions}
                  </header>
                ) : (
                  <div className="absolute right-2 top-2 z-10">{actions}</div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <BlockBody entry={entry} members={members} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {(blocks.length > 0 || resolved.fatal) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4">
          <p className="text-xs leading-relaxed text-fg-4">{t('agentEditedNote')}</p>
          <DashboardAddBlock itemId={item.id} />
        </div>
      )}
    </div>
  );
}

async function BlockBody({ entry, members }: { entry: ResolvedBlock; members: WorkspaceMember[] }) {
  switch (entry.kind) {
    case 'invalid':
      return <BlockInvalid id={entry.id} error={entry.error} />;
    case 'unavailable':
      return <BlockUnavailable reason={entry.reason} />;
    case 'metric':
      return <MetricBlockView data={entry} />;
    case 'chart':
      return <ChartBlockView data={entry} />;
    case 'list':
      return <ListBlockView data={entry} />;
    case 'text':
      return <TextBlockView data={entry} />;
    case 'links':
      return <LinksBlockView data={entry} />;
    case 'activity':
      return <ActivityBlockView data={entry} />;
    case 'project':
      return <ProjectBlockView data={entry} />;
    case 'savings':
      return <AgentSavingsCard variant="dashboard" metrics={entry.metrics} />;
    case 'database_embed':
      return <DatabaseEmbedBody entry={entry} members={members} />;
  }
}

async function DatabaseEmbedBody({
  entry,
  members,
}: {
  entry: Extract<ResolvedBlock, { kind: 'database_embed' }>;
  members: WorkspaceMember[];
}) {
  const t = await getTranslations('Dashboard');
  return (
    <div>
      <DashboardDatabaseEmbed
        database={{ id: entry.database.id, name: entry.database.name, schema: entry.database.schema }}
        view={entry.view}
        rows={entry.rows as unknown as Record<string, unknown>[]}
        members={members}
      />
      {entry.truncated > 0 && (
        <p className="pt-2 text-2xs text-fg-4">{t('andMore', { count: entry.truncated })}</p>
      )}
    </div>
  );
}

async function EmptyDashboard({ itemId }: { itemId: string }) {
  const t = await getTranslations('Dashboard');
  return (
    <div className="rounded-surface bg-raised shadow-sheet lg:bg-sheet">
      <EmptyState icon={<LayoutDashboard />} title={t('emptyTitle')} description={t('emptyBody')}>
        <DashboardAddBlock itemId={itemId} prominent />
      </EmptyState>
    </div>
  );
}
