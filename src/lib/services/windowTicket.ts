// ── Project-window sign-in tickets ────────────────────────────────────────────
//
// `npx remnus open` trades the project's token for one of these, and the window it opens
// redeems it for a workspace-locked session (see src/lib/auth/workspaceLock.ts). The
// ticket travels in a URL, so it is built to be worthless once seen:
//   • single-use — redemption deletes it, and only the request whose delete actually
//     removed the row wins, so two concurrent redemptions cannot both succeed;
//   • 60 seconds — long enough for a browser to start, too short to matter in a history file;
//   • stored hashed — the database never holds a redeemable value.
//
// Storage reuses `client_auth_tokens`, like the install channel does. Keys are
// `win_<sha256>` (68 chars), which can never match a device id from the Tauri sign-in
// bridge or `remnus init`, and entries are a JSON envelope tagged `kind: 'window'`.

import { createHash, randomBytes } from 'crypto';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { clientAuthTokens } from '@/db/schema';

export const WINDOW_TICKET_TTL_SECONDS = 60;

export interface WindowTicket {
  kind: 'window';
  userId: string;
  workspaceId: string;
  /** The project token that asked for this window; the session is re-checked against it. */
  tokenId: string;
}

/** base64url of 32 random bytes. Anything else could not have come from us. */
const TICKET_RE = /^[A-Za-z0-9_-]{43}$/;

function storageKey(ticket: string): string {
  return `win_${createHash('sha256').update(ticket).digest('hex')}`;
}

export async function createWindowTicket(input: Omit<WindowTicket, 'kind'>): Promise<string> {
  const ticket = randomBytes(32).toString('base64url');
  const now = new Date();
  const payload = JSON.stringify({ kind: 'window', ...input } satisfies WindowTicket);

  // Evict expired entries on every write — this table has no other reaper.
  await db.delete(clientAuthTokens).where(lt(clientAuthTokens.expiresAt, now));
  await db.insert(clientAuthTokens).values({
    deviceId: storageKey(ticket),
    token: payload,
    expiresAt: new Date(now.getTime() + WINDOW_TICKET_TTL_SECONDS * 1000),
    createdAt: now,
  });

  return ticket;
}

function parseEnvelope(raw: string): WindowTicket | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const t = parsed as Partial<WindowTicket> | null;
  if (
    !t ||
    t.kind !== 'window' ||
    typeof t.userId !== 'string' ||
    typeof t.workspaceId !== 'string' ||
    typeof t.tokenId !== 'string'
  ) {
    return null;
  }
  return { kind: 'window', userId: t.userId, workspaceId: t.workspaceId, tokenId: t.tokenId };
}

async function readTicket(ticket: string, consume: boolean): Promise<WindowTicket | null> {
  if (!TICKET_RE.test(ticket)) return null;
  const key = storageKey(ticket);

  const [entry] = await db
    .select()
    .from(clientAuthTokens)
    .where(eq(clientAuthTokens.deviceId, key))
    .limit(1);
  if (!entry) return null;

  if (entry.expiresAt < new Date()) {
    await db.delete(clientAuthTokens).where(eq(clientAuthTokens.deviceId, key));
    return null;
  }

  const envelope = parseEnvelope(entry.token);
  if (!envelope) return null;

  if (consume) {
    const removed = await db
      .delete(clientAuthTokens)
      .where(eq(clientAuthTokens.deviceId, key))
      .returning({ key: clientAuthTokens.deviceId });
    if (removed.length === 0) return null;
  }

  return envelope;
}

/** Reads a pending ticket without spending it. */
export function peekWindowTicket(ticket: string): Promise<WindowTicket | null> {
  return readTicket(ticket, false);
}

/** Spends a ticket. Returns null if it was missing, expired, or already spent. */
export function consumeWindowTicket(ticket: string): Promise<WindowTicket | null> {
  return readTicket(ticket, true);
}
