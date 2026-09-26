// ── Install session store ────────────────────────────────────────────────────
//
// Carries the result of a browser-side `remnus init` approval back to the CLI that
// is waiting in the user's terminal. The CLI never sees a login form and the user
// never sees a token: the CLI invents a `deviceId`, opens the browser at
// /install?device_id=…, and polls /api/install/poll until the approval lands here.
//
// Storage reuses the `client_auth_tokens` table, which already implements exactly
// the semantics this needs (device-keyed, short-lived, one-time read) for the Tauri
// sign-in bridge. To keep the two flows from ever handing each other's payload to
// the wrong client, install results are stored as a JSON envelope tagged with
// `kind: 'install'`, and a read that finds anything else reports "nothing pending"
// rather than returning it. The Tauri bridge stores a bare JWT and is untouched.

import { db } from '@/db';
import { clientAuthTokens } from '@/db/schema';
import { and, eq, lt } from 'drizzle-orm';

/** Matches the CLI's generated device id (a UUID). Rejects anything that could not
 *  have come from us before it is used as a lookup key. */
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function isDeviceIdShape(value: string | null | undefined): value is string {
  return typeof value === 'string' && DEVICE_ID_RE.test(value);
}

/**
 * How the browser step ended.
 *
 * `remnus init` can only ever produce `connected`. `remnus join` adds the two
 * outcomes where nothing was granted: the person is not a member of the workspace
 * the project names, so they either just asked its owner for access (`requested`)
 * or had already been refused (`denied`). Both come back through this same channel
 * on purpose — a CLI sitting at a prompt should be told the answer, not left to
 * time out after five minutes as if the browser had been abandoned.
 */
export type InstallStatus = 'connected' | 'requested' | 'denied';

/** Everything the CLI needs to write the project's files, in one payload. */
export interface InstallResult {
  kind: 'install';
  /** Absent on results written before the join flow existed — read as `connected`. */
  status?: InstallStatus;
  /**
   * Workspace-scoped agent token, delivered exactly once. Null in OAuth mode, where
   * the project stores no secret and the MCP client runs its own browser flow against
   * the workspace-pinned URL instead — this channel then only carries the choice of
   * workspace, which is the one thing the CLI cannot work out on its own. Also null
   * for a non-`connected` status, where there is nothing to hand over.
   */
  token: string | null;
  workspaceId: string;
  /**
   * Display name for the workspace. For a non-`connected` status this is the
   * *project* name the CLI supplied, never the real workspace name — that branch is
   * reached by people who are not members, and they may learn nothing about it.
   */
  workspaceName: string;
  scope: 'read' | 'write';
  /** Workspace-pinned MCP endpoint — what goes into the project's MCP config. */
  mcpUrl: string;
  /** `join` only: a previous token for this same person + project was revoked to make
   *  room for this one, so the CLI can say so instead of silently dropping a session. */
  replacedPrevious?: boolean;
  /** `join` + `connected` only: the joiner's own role, so the CLI can tell "you picked
   *  read only" apart from "a viewer can only read". Never set for a non-member. */
  role?: 'owner' | 'member' | 'viewer';
  /** `denied` only: ISO timestamp after which asking again is allowed. */
  retryAt?: string;
}

/** Same 5-minute window the Tauri bridge uses: long enough to sign in, short enough
 *  that an abandoned install leaves nothing usable behind. */
const TTL_MS = 5 * 60 * 1000;

/**
 * How long an install link is good for after the CLI issued it. The CLI waits exactly
 * this long (plus a few seconds); an approval after that would mint a token no terminal
 * is waiting for any more.
 */
export const INSTALL_LINK_LIFETIME_MS = 5 * 60 * 1000;

/**
 * What a link leaves behind once its result has been picked up: no token, just the fact
 * that it was used. Without it, opening the same link again — from the terminal's
 * scrollback, or because an agent repeated it in chat — showed the connect form again,
 * and approving it minted a second token that nobody would ever receive.
 */
interface UsedMarker {
  kind: 'install-used';
  status: InstallStatus;
}

/** Long enough to cover "I clicked the link again the next day"; the row carries no secret. */
const USED_MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InstallLinkState =
  | { state: 'open' }
  | { state: 'used'; status: InstallStatus }
  | { state: 'expired' };

/**
 * The `issued` stamp the CLI puts on the link, in epoch seconds of *this server's* clock
 * (the CLI reads it off a response's `Date` header, so a skewed laptop clock can't make a
 * fresh link look old). It is not a credential — forging it only changes which screen the
 * forger sees. Absent (CLIs before 0.1.11) or implausible → null, and no expiry is judged.
 */
function parseIssuedAt(value: string | null | undefined): number | null {
  if (!value || !/^\d{9,11}$/.test(value)) return null;
  const ms = Number(value) * 1000;
  return ms > Date.now() + 10 * 60 * 1000 ? null : ms;
}

function parseEnvelope(raw: string): InstallResult | UsedMarker | null {
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown } | null;
    if (parsed && (parsed.kind === 'install' || parsed.kind === 'install-used')) {
      return parsed as InstallResult | UsedMarker;
    }
  } catch {
    // A bare JWT from the Tauri sign-in bridge — not ours.
  }
  return null;
}

/**
 * Whether the install page may still offer to connect for this link. A result waiting
 * to be picked up counts as used too: the approval already happened. Used wins over
 * expired, so an old link that did its job says so rather than "expired".
 */
export async function getInstallLinkState(
  deviceId: string,
  issued: string | null | undefined,
): Promise<InstallLinkState> {
  if (!isDeviceIdShape(deviceId)) return { state: 'open' };

  const [entry] = await db
    .select({ token: clientAuthTokens.token, expiresAt: clientAuthTokens.expiresAt })
    .from(clientAuthTokens)
    .where(eq(clientAuthTokens.deviceId, deviceId))
    .limit(1);

  if (entry && entry.expiresAt >= new Date()) {
    const envelope = parseEnvelope(entry.token);
    if (envelope) return { state: 'used', status: envelope.status ?? 'connected' };
  }

  const issuedAt = parseIssuedAt(issued);
  if (issuedAt !== null && Date.now() > issuedAt + INSTALL_LINK_LIFETIME_MS) return { state: 'expired' };
  return { state: 'open' };
}

export async function putInstallResult(deviceId: string, result: Omit<InstallResult, 'kind'>): Promise<void> {
  if (!isDeviceIdShape(deviceId)) throw new Error('Invalid device id');

  const expiresAt = new Date(Date.now() + TTL_MS);
  const payload = JSON.stringify({ kind: 'install', ...result } satisfies InstallResult);

  // Evict expired entries on every write to avoid unbounded growth (same as the
  // sign-in bridge — this table has no other reaper).
  await db.delete(clientAuthTokens).where(lt(clientAuthTokens.expiresAt, new Date()));
  await db
    .insert(clientAuthTokens)
    .values({ deviceId, token: payload, expiresAt })
    .onConflictDoUpdate({ target: clientAuthTokens.deviceId, set: { token: payload, expiresAt } });
}

/**
 * Returns the pending install result and replaces it with a token-less "used" marker —
 * one-time use, so a token that leaks from the wait channel cannot be replayed, while the
 * install page can still tell that this link is spent. Returns null when nothing is
 * pending, when it has expired, or when the entry belongs to the Tauri sign-in flow.
 */
export async function consumeInstallResult(deviceId: string): Promise<InstallResult | null> {
  if (!isDeviceIdShape(deviceId)) return null;

  const [entry] = await db
    .select()
    .from(clientAuthTokens)
    .where(eq(clientAuthTokens.deviceId, deviceId))
    .limit(1);

  if (!entry) return null;

  if (entry.expiresAt < new Date()) {
    await db.delete(clientAuthTokens).where(eq(clientAuthTokens.deviceId, deviceId));
    return null;
  }

  // A bare JWT (Tauri sign-in bridge) parses to null: not ours — leave it for its own
  // poller instead of consuming (and destroying) someone else's sign-in.
  const envelope = parseEnvelope(entry.token);
  if (!envelope || envelope.kind !== 'install') return null;

  const marker: UsedMarker = { kind: 'install-used', status: envelope.status ?? 'connected' };
  // Conditional on the exact payload just read, so two overlapping polls can't both be
  // handed the token: only the one whose update lands gets it.
  const claimed = await db
    .update(clientAuthTokens)
    .set({ token: JSON.stringify(marker), expiresAt: new Date(Date.now() + USED_MARKER_TTL_MS) })
    .where(and(eq(clientAuthTokens.deviceId, deviceId), eq(clientAuthTokens.token, entry.token)))
    .returning({ deviceId: clientAuthTokens.deviceId });

  return claimed.length ? envelope : null;
}
