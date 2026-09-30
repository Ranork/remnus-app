/**
 * Small edits to a page body that don't need the whole body resent (V2 R6 follow-up).
 *
 * Measured in the calibration field test: ticking a Calibration Log step meant an
 * `update_page` with the full body every time — about 30% of an agent's calls, each
 * resending ~6k characters. `tick` checks a task item by its text and `append` adds
 * to the end, so a step costs a few dozen bytes instead.
 *
 * Bodies are markdown. A task item is `- [ ] text` (also `*`, `+` or `1.` as the
 * marker, any indent). Pure functions: the caller reads the current body, applies
 * this, and writes the result through the normal content path (snapshots, page links).
 */

export type TickRequest = string | { item: string; note?: string };

export class BodyEditError extends Error {}

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](\s+)(.*)$/;
const CR = '\r';

/** Match a line without its CR (`.` never matches a CR), so CRLF bodies tick too. */
const matchTask = (line: string) => TASK.exec(line.endsWith(CR) ? line.slice(0, -1) : line);

const fold = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();

/**
 * Check the first open task whose text starts with each request's `item`
 * (case-insensitive, whitespace-folded), appending ` — note` when given.
 * All-or-nothing: an item that matches no open task refuses the whole edit with
 * the open tasks listed, so the caller can correct it in one more call.
 */
export function tickTasks(body: string, ticks: TickRequest[]): { body: string; ticked: number } {
  const lines = body.split('\n');
  const missing: string[] = [];
  let ticked = 0;

  for (const raw of ticks) {
    const { item, note } = typeof raw === 'string' ? { item: raw, note: undefined } : raw;
    const want = fold(item);
    if (!want) continue;
    const index = lines.findIndex((line) => {
      const m = matchTask(line);
      return !!m && m[2] === ' ' && fold(m[4]).startsWith(want);
    });
    if (index === -1) {
      missing.push(item);
      continue;
    }
    const m = matchTask(lines[index])!;
    const suffix = note?.trim() ? ` — ${note.trim()}` : '';
    const cr = lines[index].endsWith(CR) ? CR : '';
    lines[index] = `${m[1]}[x]${m[3]}${m[4]}${suffix}${cr}`;
    ticked += 1;
  }

  if (missing.length) {
    const open = lines
      .map((line) => matchTask(line))
      .filter((m): m is RegExpExecArray => !!m && m[2] === ' ')
      .map((m) => m[4].trim())
      .slice(0, 15);
    throw new BodyEditError(
      `No open task starts with ${missing.map((m) => `"${m}"`).join(', ')}. ` +
        (open.length ? `Open tasks: ${open.map((t) => `"${t}"`).join(', ')}` : 'The body has no open tasks.'),
    );
  }
  return { body: lines.join('\n'), ticked };
}

/** Add markdown to the end of a body, separated by one blank line. */
export function appendMarkdown(body: string, addition: string): string {
  const trimmed = body.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n\n${addition.replace(/^\s+/, '')}` : addition;
}

/** Apply `tick` then `append` to a body. Either may be omitted. */
export function applyBodyEdits(body: string, edits: { tick?: TickRequest[]; append?: string }): { body: string; ticked: number } {
  let next = body;
  let ticked = 0;
  if (edits.tick?.length) ({ body: next, ticked } = tickTasks(next, edits.tick));
  if (edits.append?.trim()) next = appendMarkdown(next, edits.append);
  return { body: next, ticked };
}
