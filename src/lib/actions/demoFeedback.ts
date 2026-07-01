'use server';
import { db } from '@/db';
import { demoFeedback } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';

export type DemoSentiment = 'positive' | 'neutral' | 'negative';

const SENTIMENTS: DemoSentiment[] = ['positive', 'neutral', 'negative'];
const MAX_COMMENT = 1000;

/**
 * Records feedback from the in-app demo prompt. Only demo sessions can submit —
 * the prompt is demo-only and this keeps the table free of noise from real
 * accounts. Best-effort: never throws so a failed insert can't break the UI.
 */
export async function submitDemoFeedback(input: {
  sentiment: DemoSentiment;
  comment?: string | null;
}): Promise<{ ok: boolean }> {
  try {
    const user = await getCurrentUser();
    if (user.role !== 'demo') return { ok: false };
    if (!SENTIMENTS.includes(input.sentiment)) return { ok: false };

    const comment = input.comment?.trim().slice(0, MAX_COMMENT) || null;

    await db.insert(demoFeedback).values({
      userId: user.id,
      sentiment: input.sentiment,
      comment,
      createdAt: new Date(),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type DemoFeedbackItem = {
  id: string;
  sentiment: DemoSentiment;
  comment: string | null;
  createdAt: number | null; // epoch ms
};

export type DemoFeedbackOverview = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  withComment: number;
  recent: DemoFeedbackItem[]; // newest first, capped
};

const RECENT_LIMIT = 100;

/**
 * Admin-only rollup of demo feedback: sentiment counts + the most recent entries
 * with comments. Powers the admin dashboard's "Demo Feedback" section.
 */
export async function getDemoFeedback(): Promise<DemoFeedbackOverview> {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }

  const [counts] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      positive: sql<number>`cast(sum(case when ${demoFeedback.sentiment} = 'positive' then 1 else 0 end) as int)`,
      neutral: sql<number>`cast(sum(case when ${demoFeedback.sentiment} = 'neutral' then 1 else 0 end) as int)`,
      negative: sql<number>`cast(sum(case when ${demoFeedback.sentiment} = 'negative' then 1 else 0 end) as int)`,
      withComment: sql<number>`cast(sum(case when ${demoFeedback.comment} is not null and ${demoFeedback.comment} != '' then 1 else 0 end) as int)`,
    })
    .from(demoFeedback);

  const rows = await db
    .select({
      id: demoFeedback.id,
      sentiment: demoFeedback.sentiment,
      comment: demoFeedback.comment,
      createdAt: demoFeedback.createdAt,
    })
    .from(demoFeedback)
    .orderBy(desc(demoFeedback.createdAt))
    .limit(RECENT_LIMIT);

  return {
    total: counts?.total ?? 0,
    positive: counts?.positive ?? 0,
    neutral: counts?.neutral ?? 0,
    negative: counts?.negative ?? 0,
    withComment: counts?.withComment ?? 0,
    recent: rows.map((r) => ({
      id: r.id,
      sentiment: r.sentiment as DemoSentiment,
      comment: r.comment,
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : null,
    })),
  };
}
