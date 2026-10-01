/**
 * The one agent session measured in docs/blog/agent-token-efficiency.md (reproducible with
 * `npm run bench:tokens`, chars ÷ 4): orient, check the board, read one page — first by
 * reading everything, then the Remnus way (digest, `fields` projection, outline).
 * The landing's savings section shows these numbers and nothing else; if the benchmark is
 * re-measured, update the post and this file together.
 */
export const SESSION_STEPS = [
  { key: 'rowOrient', usual: 1379, remnus: 136 },
  { key: 'rowQuery', usual: 3706, remnus: 632 },
  { key: 'rowPage', usual: 655, remnus: 133 },
] as const;

export const SESSION_USUAL = SESSION_STEPS.reduce((sum, s) => sum + s.usual, 0); // 5,740
export const SESSION_REMNUS = SESSION_STEPS.reduce((sum, s) => sum + s.remnus, 0); // 901
export const SESSION_SAVED = SESSION_USUAL - SESSION_REMNUS;
/** 84 — the headline percentage. */
export const SESSION_SAVED_PERCENT = Math.round((SESSION_SAVED / SESSION_USUAL) * 100);
/** 6 — how many sessions fit where one used to. */
export const SESSION_ROOM_FACTOR = Math.floor(SESSION_USUAL / SESSION_REMNUS);
