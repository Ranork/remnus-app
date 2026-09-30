/**
 * Body edits regression test — `npm run test:body-edits`.
 *
 * Pure functions only (`src/lib/services/bodyEdits.ts`): ticking task items by
 * their text and appending, the way `update_page` `tick` / `append` apply them.
 */
import assert from 'node:assert/strict';
import { appendMarkdown, applyBodyEdits, BodyEditError, tickTasks } from '@/lib/services/bodyEdits';

let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const LOG = [
  '# Calibration Log',
  '',
  '## Build steps',
  '- [ ] Create Decisions database',
  '- [ ] Create Features database',
  '  * [ ] Add Features rows',
  '1. [ ] Build home dashboard',
  '- [x] Create Decisions draft',
  '',
  'Notes.',
].join('\n');

check('ticks the first open task starting with the text, case-insensitively', () => {
  const { body, ticked } = tickTasks(LOG, ['create decisions']);
  assert.equal(ticked, 1);
  assert.match(body, /^- \[x\] Create Decisions database$/m);
  assert.match(body, /^- \[ \] Create Features database$/m);
});

check('skips already checked items and keeps indent and marker', () => {
  const { body } = tickTasks(LOG, ['Add Features', 'Build home']);
  assert.match(body, /^ {2}\* \[x\] Add Features rows$/m);
  assert.match(body, /^1\. \[x\] Build home dashboard$/m);
});

check('appends a note to the ticked line', () => {
  const { body } = tickTasks(LOG, [{ item: 'Create Features', note: 'id 48702314' }]);
  assert.match(body, /^- \[x\] Create Features database — id 48702314$/m);
});

check('two ticks with the same prefix take two different items', () => {
  const { body, ticked } = tickTasks(LOG, ['Create', 'Create']);
  assert.equal(ticked, 2);
  assert.match(body, /^- \[x\] Create Decisions database$/m);
  assert.match(body, /^- \[x\] Create Features database$/m);
});

check('an unknown item refuses the whole edit and lists the open tasks', () => {
  assert.throws(() => tickTasks(LOG, ['Create Features', 'Deploy']), (err: unknown) => {
    assert.ok(err instanceof BodyEditError);
    assert.match(String((err as Error).message), /"Deploy"/);
    assert.match(String((err as Error).message), /Open tasks: .*"Create Decisions database"/);
    return true;
  });
});

check('append adds after one blank line, and into an empty body as is', () => {
  assert.equal(appendMarkdown('Hello\n\n\n', '## Run 2'), 'Hello\n\n## Run 2');
  assert.equal(appendMarkdown('', '- [ ] a'), '- [ ] a');
});

check('tick then append in one edit', () => {
  const { body, ticked } = applyBodyEdits(LOG, { tick: ['Build home'], append: '## 2026-09-30 run\n- added home' });
  assert.equal(ticked, 1);
  assert.ok(body.endsWith('Notes.\n\n## 2026-09-30 run\n- added home'));
  assert.match(body, /^1\. \[x\] Build home dashboard$/m);
});

check('CRLF bodies keep working', () => {
  const { body } = tickTasks(LOG.replace(/\n/g, '\r\n'), ['Create Decisions']);
  assert.match(body, /\[x\] Create Decisions database\r$/m);
});

console.log(`\n${checks} passed`);
