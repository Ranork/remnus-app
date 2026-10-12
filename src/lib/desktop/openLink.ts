// The page side of the desktop app's `remnus://open?workspace=<id>` hand-off (src-tauri sends
// it as the `desktop-open-workspace` event). Plain module, import-safe from any context.
//
// Two listeners share it. `DesktopOpenListener`, inside the app shell, opens the workspace.
// `DesktopOpenCatcher`, on every page, keeps a link that arrives while no shell is listening
// until one is. The shell only learns "the page listens" once (`desktop-open-ready`) and then
// sends every later link at once — so after signing out, a link sent to the sign-in screen
// was dropped there, and signing in opened nothing (R11, found on desktop 0.1.20).

export const DESKTOP_OPEN_EVENT = 'desktop-open-workspace';

/** Same shape rule as the CLI and the desktop shell: never build a path from anything else. */
const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Per window (sessionStorage): survives the sign-in trip, which ends in a hard navigation,
// but not a restart. Long enough to finish signing in through the system browser.
const HELD_KEY = 'remnus_desktop_open';
const HELD_FOR_MS = 10 * 60 * 1000;

/** The event's workspace id, if it is one. */
export function workspaceIdOf(payload: unknown): string | null {
  const id = (payload as { workspaceId?: unknown } | null)?.workspaceId;
  return typeof id === 'string' && WORKSPACE_ID_RE.test(id) ? id : null;
}

// One instance per page runtime, shared by both listeners.
let shellListening = false;

/** Set by the shell's listener while it is registered; the catcher stands aside then. */
export function setShellListening(on: boolean) {
  shellListening = on;
}

export function isShellListening() {
  return shellListening;
}

export function holdOpenLink(workspaceId: string) {
  try {
    sessionStorage.setItem(HELD_KEY, JSON.stringify({ workspaceId, at: Date.now() }));
  } catch {
    // Storage blocked: the link is lost, as it was before.
  }
}

/** The held link, removed as it is read; null when none, or older than HELD_FOR_MS. */
export function takeHeldOpenLink(): string | null {
  try {
    const raw = sessionStorage.getItem(HELD_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HELD_KEY);
    const held = JSON.parse(raw) as { workspaceId?: unknown; at?: unknown };
    if (typeof held.at !== 'number' || Date.now() - held.at > HELD_FOR_MS) return null;
    return workspaceIdOf(held);
  } catch {
    return null;
  }
}
