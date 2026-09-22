/**
 * "Would refreshing right now disturb the user?"
 *
 * A background `router.refresh()` (or query invalidation) is only ever deferred
 * for one reason: not resetting the caret, selection or focus out from under
 * someone who is mid-edit. The gate this replaced deferred on *any* activity
 * event — including `mousemove` — with a 10s timer, which meant a human simply
 * watching an agent fill the workspace deferred every refresh indefinitely,
 * just by keeping a hand on the mouse. Moving the pointer is not editing.
 *
 * So the gate blocks on the real editing states only:
 *   • a pointer held down — a drag or a text selection in progress;
 *   • a keystroke in the last 1.5s — actively typing;
 *   • focus inside an editable element AND a keystroke in the last 15s —
 *     working in the editor. The keystroke window matters: a caret parked in a
 *     field nobody has touched for a while must not block refreshes forever
 *     (autofocus alone used to be enough to do that).
 *
 * Callers add their own reasons on top — an open modal, picker or inline
 * rename — via their `paused` flag; see `isAnyModalOrPickerOpen`.
 *
 * `onRelease` fires when a blocking condition lapses, so a deferred refresh can
 * be applied at the first safe moment rather than waiting for the next poll.
 */

const KEYSTROKE_MS = 1_500;
const EDITING_MS = 15_000;

export type InteractionGate = {
  /** True while a background refresh would interrupt something the user is doing. */
  isBlocked(): boolean;
  dispose(): void;
};

function isEditableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function createInteractionGate(onRelease: () => void): InteractionGate {
  if (typeof window === 'undefined') {
    return { isBlocked: () => false, dispose: () => {} };
  }

  let lastKeyAt = 0;
  let pointerDown = false;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  const blocked = () => {
    if (pointerDown) return true;
    const sinceKey = Date.now() - lastKeyAt;
    if (sinceKey < KEYSTROKE_MS) return true;
    return isEditableFocused() && sinceKey < EDITING_MS;
  };

  // Re-check once the keystroke windows lapse. Scheduled against the longer
  // window while an editable has focus, so the caret-parked case still releases.
  const scheduleRelease = () => {
    if (releaseTimer) clearTimeout(releaseTimer);
    const window_ = isEditableFocused() ? EDITING_MS : KEYSTROKE_MS;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      if (!blocked()) onRelease();
      else scheduleRelease();
    }, window_ + 50);
  };

  const onKeyDown = () => {
    lastKeyAt = Date.now();
    scheduleRelease();
  };
  const onPointerDown = () => { pointerDown = true; };
  const onPointerUp = () => {
    pointerDown = false;
    if (!blocked()) onRelease();
  };
  // Leaving an editable drops the longer editing window immediately.
  const onFocusOut = () => { if (!blocked()) onRelease(); };

  window.addEventListener('keydown', onKeyDown, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  // `focusout` bubbles where `blur` does not, so one window listener covers every field.
  window.addEventListener('focusout', onFocusOut, { passive: true });

  return {
    isBlocked: blocked,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('focusout', onFocusOut);
      if (releaseTimer) clearTimeout(releaseTimer);
    },
  };
}
