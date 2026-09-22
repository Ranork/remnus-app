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
import { eq, lt } from 'drizzle-orm';

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
  /** `denied` only: ISO timestamp after which asking again is allowed. */
  retryAt?: string;
}

/** Same 5-minute window the Tauri bridge uses: long enough to sign in, short enough
 *  that an abandoned install leaves nothing usable behind. */
const TTL_MS = 5 * 60 * 1000;

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
 * Returns the pending install result and deletes it — one-time use, so a token that
 * leaks from the wait channel cannot be replayed. Returns null when nothing is
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.token);
  } catch {
    // A bare JWT from the Tauri sign-in bridge. Not ours — leave it for its own
    // poller instead of consuming (and destroying) someone else's sign-in.
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || (parsed as InstallResult).kind !== 'install') {
    return null;
  }

  await db.delete(clientAuthTokens).where(eq(clientAuthTokens.deviceId, deviceId));
  return parsed as InstallResult;
}
