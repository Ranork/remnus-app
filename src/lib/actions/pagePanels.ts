'use server';
import { getComments } from './comments';
import { getPageKnowledge } from './knowledge';
import { getPageRelations } from './workspace';

export type PagePanels = {
  comments: Awaited<ReturnType<typeof getComments>> | null;
  knowledge: Awaited<ReturnType<typeof getPageKnowledge>> | null;
  relations: Awaited<ReturnType<typeof getPageRelations>> | null;
};

const settled = <T,>(result: PromiseSettledResult<T>): T | null =>
  result.status === 'fulfilled' ? result.value : null;

/**
 * A page's comments, knowledge and backlinks — the floating panels' data (U4; they were
 * the sections under the body) — in ONE server action (V2 R9). Next runs server actions
 * one at a time, so three separate reads arrived one after another; here they run side
 * by side, each through its own action (same access checks), and a failing one costs
 * only its own panel. Called through `lib/pagePanels.ts`.
 */
export async function getPagePanels(workspaceId: string, pageId: string): Promise<PagePanels> {
  const [comments, knowledge, relations] = await Promise.allSettled([
    getComments(workspaceId, pageId),
    getPageKnowledge(workspaceId, pageId),
    getPageRelations(workspaceId, pageId),
  ]);
  return { comments: settled(comments), knowledge: settled(knowledge), relations: settled(relations) };
}
