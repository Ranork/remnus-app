import { getTranslations } from 'next-intl/server';
import { CircleAlert, LayoutDashboard } from 'lucide-react';
import type { WorkspaceMember } from '@/components/features/MembersContext';
import type { DashboardItem } from '@/lib/actions/dashboard';
import type { ResolvedBlock, ResolvedDashboard } from '@/lib/dashboard/data';
import { blockWidth } from '@/lib/dashboard/schema';
import DashboardHeader from './DashboardHeader';
import DashboardBlockActions from './DashboardBlockActions';
import DashboardDatabaseEmbed from './DashboardDatabaseEmbed';
import {
  ActivityBlockView,
  BlockInvalid,
  BlockUnavailable,
  ChartBlockView,
  LinksBlockView,
  ListBlockView,
  MetricBlockView,
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

const SPAN_CLASS = {
  quarter: 'lg:col-span-1',
  half: 'lg:col-span-2',
  full: 'lg:col-span-4',
} as const;

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

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-10 sm:py-10">
      <DashboardHeader
        itemId={item.id}
        initialTitle={item.title}
        initialIcon={item.icon}
        initialIconColor={item.iconColor}
        blockCount={blocks.length}
      />

      {resolved.fatal && (
        <div className="mb-5 flex items-start gap-2 border-b border-neutral-850 pb-4 text-xs text-neutral-400">
          <CircleAlert size={14} className="mt-px shrink-0 text-amber-500/70" />
          <div>
            <p>{t('specUnreadable')}</p>
            <p className="mt-1 font-mono text-[10px] text-neutral-600">{resolved.fatal}</p>
          </div>
        </div>
      )}

      {blocks.length === 0 && !resolved.fatal ? (
        <EmptyDashboard />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {blocks.map((entry, index) => {
            const span = entry.kind === 'invalid' ? SPAN_CLASS.half : SPAN_CLASS[blockWidth(entry.block)];
            const id = entry.kind === 'invalid' ? entry.id : entry.block.id;
            const title = blockTitle(entry);

            return (
              <section
                key={blockKey(entry, index)}
                className={`group/block flex min-w-0 flex-col border border-neutral-800 bg-neutral-900 p-4 ${span}`}
              >
                <header className="mb-2 flex min-h-[18px] items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                    {title ?? ''}
                  </h2>
                  {id && (
                    <DashboardBlockActions
                      itemId={item.id}
                      blockId={id}
                      canMoveUp={index > 0}
                      canMoveDown={index < blocks.length - 1}
                    />
                  )}
                </header>
                <div className="min-w-0 flex-1">
                  <BlockBody entry={entry} members={members} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* v1 has no visual block builder. Saying so beats letting a reader hunt
          for an "add block" button that isn't there. */}
      <p className="mt-6 border-t border-neutral-850 pt-4 text-[11px] leading-relaxed text-neutral-600">
        {t('agentEditedNote')}
      </p>
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
        <p className="pt-2 text-[10px] text-neutral-600">{t('andMore', { count: entry.truncated })}</p>
      )}
    </div>
  );
}

async function EmptyDashboard() {
  const t = await getTranslations('Dashboard');
  return (
    <div className="border border-dashed border-neutral-800 px-6 py-14 text-center">
      <LayoutDashboard size={22} className="mx-auto mb-3 text-neutral-700" />
      <p className="text-sm font-medium text-neutral-300">{t('emptyTitle')}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-neutral-500">{t('emptyBody')}</p>
    </div>
  );
}
