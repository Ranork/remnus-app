/**
 * Regression check for what bulk selection may pick in a grouped view
 * (`visibleRowIdsOfGroupedView`, src/lib/tableGrouping.ts). No database.
 *
 * "Select all" and everything a bulk delete / move acts on stop at what is on screen: a row in
 * a hidden Kanban column or in a collapsed table group is not visible, so it must never be
 * picked up by a click on "Select all" that then deletes it.
 *
 *   npm run test:row-selection
 */
import { visibleRowIdsOfGroupedView } from '@/lib/tableGrouping';

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const OPTIONS = ['Todo', 'Doing', 'Done'];
const page = (id: string, status?: unknown) => ({ id, properties: status === undefined ? {} : { status } });
const pages = [
  page('a', 'Todo'), page('b', 'Doing'), page('c', 'Done'), page('d', 'Todo'),
  page('e'), // no value → Uncategorized
  page('f', 'Archived-option-that-was-deleted'), // value no longer an option → Uncategorized
  page('g', ['Todo']), // not a string (a multi-select value) → Uncategorized
];
const ids = (xs: string[]) => [...xs].sort().join('');

console.log('visibleRowIdsOfGroupedView:');
check('nothing hidden: every row, once', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS)) === 'abcdefg');
check('rows follow the group order, not the page order',
  visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, ['Done', 'Todo', 'Doing']).join('') === 'cadbefg',
  visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, ['Done', 'Todo', 'Doing']).join(''));
check('a hidden group drops its rows', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], ['Doing'])) === 'acdefg');
check('several hidden groups', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], ['Todo', 'Done'])) === 'befg');
check('hiding Uncategorized drops the rows with no (or an unknown) value', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], ['Uncategorized'])) === 'abcd');
check('a collapsed group drops its rows', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], [], ['Todo'])) === 'bcefg');
check('hidden and collapsed together', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], ['Done'], ['Doing'])) === 'adefg');
check('everything hidden: nothing', visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], [...OPTIONS, 'Uncategorized']).length === 0);
check('no rows: nothing', visibleRowIdsOfGroupedView([], 'status', OPTIONS).length === 0);
check('a group order that names a deleted option is ignored', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, ['Gone', 'Done'])) === 'abcdefg');
check('a hidden name that is no group changes nothing', ids(visibleRowIdsOfGroupedView(pages, 'status', OPTIONS, [], ['Nope'])) === 'abcdefg');
check('a database with no options: everything is Uncategorized', ids(visibleRowIdsOfGroupedView(pages, 'status', [])) === 'abcdefg');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
