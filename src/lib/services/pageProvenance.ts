/**
 * The provenance line under a page's title (V2 R8.8): which agent last edited it and
 * when, the newest human edit we know of, and whether a human has reviewed exactly
 * the current text. Read with the page itself (`getStandalonePageByItemId`, `getPage`),
 * so it refreshes whenever the page does — no request of its own.
 *
 * Every fact here is content provenance, not the audit log:
 *  - the agent edit is the knowledge stamp each MCP create/update writes
 *    (`knowledge_metadata.generated_by/generated_at`), for standalone pages and rows
 *    alike; a row stamped before those stamps existed falls back to its own
 *    `pages.agent_edited_at`;
 *  - the human edit is the newest human version in the page's history
 *    (`page_snapshots`, reason `update`) — human versions are debounced, so it can lag
 *    the last keystroke by up to the history's session gap (10 min), never lead it;
 *  - the review is a `knowledge_reviews` row bound to the current title + body hash
 *    (`trustFor`), so any later edit clears it.
 * Nothing is read from `agent_activity`, so the plan's audit window does not apply.
 *
 * One `db.batch` round trip; a second, tiny one only when the stamp names no known
 * agent brand and the token's own label is needed.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { agentTokens, knowledgeMetadata, knowledgeReviews, oauthAccessTokens, oauthClients, pageSnapshots } from '@/db/schema';
import { markForId } from '@/components/features/agents/agentMarks';
import type { PageProvenance } from '@/lib/agentPresence';
import { asEpochSeconds } from './agentMetrics';
import { hashKnowledgeContent } from './knowledge';

/** `mcp:<agentName>:<tokenId>` / `mcp:<tokenId>` — written by the MCP write tools' `actorId`. */
function parseGeneratedBy(generatedBy: string | null): { agentName: string | null; tokenId: string | null } | null {
  if (!generatedBy?.startsWith('mcp:')) return null;
  const rest = generatedBy.slice(4);
  const cut = rest.lastIndexOf(':');
  return cut === -1
    ? { agentName: null, tokenId: rest || null }
    : { agentName: rest.slice(0, cut) || null, tokenId: rest.slice(cut + 1) || null };
}

export async function getPageProvenance(input: {
  workspaceId: string;
  /** Workspace item id (standalone page) or row id. */
  itemId: string;
  itemType: 'page' | 'database_row';
  title: string;
  content: string;
  /** The signed-in viewer — "you" instead of their name. */
  viewerId: string;
  /** A row's own agent stamp, already read with the row. */
  rowStamp?: { at: Date | null; agentName: string | null; tokenName: string | null };
  now?: number;
}): Promise<PageProvenance | null> {
  const { workspaceId, itemId, itemType, viewerId } = input;
  const now = input.now ?? Date.now();
  const sameItem = and(
    eq(knowledgeMetadata.workspaceId, workspaceId),
    eq(knowledgeMetadata.itemId, itemId),
    eq(knowledgeMetadata.itemType, itemType),
  );

  const [stamps, reviews, humans] = await db.batch([
    db.select({ generatedBy: knowledgeMetadata.generatedBy, at: asEpochSeconds(knowledgeMetadata.generatedAt) })
      .from(knowledgeMetadata)
      .where(sameItem)
      .limit(1),
    db.select({ reviewerUserId: knowledgeReviews.reviewerUserId, at: asEpochSeconds(knowledgeReviews.reviewedAt) })
      .from(knowledgeReviews)
      .innerJoin(knowledgeMetadata, eq(knowledgeReviews.metadataId, knowledgeMetadata.id))
      .where(and(
        sameItem,
        isNull(knowledgeReviews.revokedAt),
        eq(knowledgeReviews.contentHash, hashKnowledgeContent(input.title, input.content)),
      ))
      .orderBy(desc(knowledgeReviews.reviewedAt))
      .limit(1),
    db.select({ name: pageSnapshots.deletedByLabel, userId: pageSnapshots.deletedByUserId, at: asEpochSeconds(pageSnapshots.createdAt) })
      .from(pageSnapshots)
      .where(and(
        eq(pageSnapshots.workspaceId, workspaceId),
        eq(pageSnapshots.originalId, itemId),
        eq(pageSnapshots.reason, 'update'),
        eq(pageSnapshots.deletedByKind, 'human'),
      ))
      .orderBy(desc(pageSnapshots.createdAt))
      .limit(1),
  ]);

  // The newer of the knowledge stamp and the row's own stamp.
  const stamp = stamps[0];
  const stampAt = Number(stamp?.at) * 1000;
  const parsed = parseGeneratedBy(stamp?.generatedBy ?? null);
  const rowAt = input.rowStamp?.at ? new Date(input.rowStamp.at).getTime() : NaN;

  let agent: PageProvenance['agent'] | null = null;
  if (parsed && Number.isFinite(stampAt) && !(Number.isFinite(rowAt) && rowAt > stampAt + 1000)) {
    agent = { agentName: parsed.agentName, tokenName: null, at: stampAt };
    // A brand id names the agent by itself; otherwise the token's own labels do.
    if (!markForId(parsed.agentName) && parsed.tokenId) {
      const [pat, oauth] = await db.batch([
        db.select({ agentName: agentTokens.agentName, name: agentTokens.name })
          .from(agentTokens).where(eq(agentTokens.id, parsed.tokenId)).limit(1),
        db.select({
            agentName: oauthAccessTokens.agentName,
            name: sql<string | null>`coalesce(${oauthAccessTokens.displayName}, ${oauthClients.clientName})`,
          })
          .from(oauthAccessTokens)
          .leftJoin(oauthClients, eq(oauthAccessTokens.clientId, oauthClients.clientId))
          .where(eq(oauthAccessTokens.id, parsed.tokenId)).limit(1),
      ]);
      const token = pat[0] ?? oauth[0];
      if (token) agent = { ...agent, agentName: parsed.agentName ?? token.agentName, tokenName: token.name };
    }
  } else if (Number.isFinite(rowAt)) {
    agent = { agentName: input.rowStamp!.agentName, tokenName: input.rowStamp!.tokenName, at: rowAt };
  }
  if (!agent) return null;

  const human = humans[0];
  const humanAt = Number(human?.at) * 1000;
  const review = reviews[0];
  const reviewAt = Number(review?.at) * 1000;

  return {
    at: now,
    agent,
    human: human && Number.isFinite(humanAt)
      ? { name: human.name, you: human.userId === viewerId, at: humanAt }
      : null,
    reviewed: review && Number.isFinite(reviewAt)
      ? { at: reviewAt, you: review.reviewerUserId === viewerId }
      : null,
  };
}
