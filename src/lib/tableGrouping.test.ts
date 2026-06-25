import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  UNCATEGORIZED_TABLE_GROUP,
  getEffectiveTableGroupOrder,
  getVisibleTableGroups,
  groupPagesForTable,
  isTableGroupableColumn,
} from './tableGrouping';

describe('table grouping helpers', () => {
  it('only allows select and status columns', () => {
    assert.equal(isTableGroupableColumn({ type: 'select' }), true);
    assert.equal(isTableGroupableColumn({ type: 'status' }), true);
    assert.equal(isTableGroupableColumn({ type: 'multi_select' }), false);
    assert.equal(isTableGroupableColumn({ type: 'checkbox' }), false);
    assert.equal(isTableGroupableColumn(null), false);
  });

  it('uses saved group order first and appends new options in schema order', () => {
    assert.deepEqual(
      getEffectiveTableGroupOrder(['Todo', 'Doing', 'Done', 'Blocked'], ['Done', 'Todo', 'Missing']),
      ['Done', 'Todo', 'Doing', 'Blocked'],
    );
  });

  it('adds Uncategorized last unless it is hidden', () => {
    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Done'], ['Done', 'Todo'], []),
      ['Done', 'Todo', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Done'], ['Done', 'Todo'], [UNCATEGORIZED_TABLE_GROUP]),
      ['Done', 'Todo'],
    );
  });

  it('omits hidden configured groups', () => {
    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Doing', 'Done'], ['Done', 'Todo', 'Doing'], ['Doing']),
      ['Done', 'Todo', UNCATEGORIZED_TABLE_GROUP],
    );
  });

  it('groups unknown, empty, and missing values into Uncategorized', () => {
    const pages = [
      { id: '1', properties: { status: 'Todo' } },
      { id: '2', properties: { status: 'Done' } },
      { id: '3', properties: { status: 'Blocked' } },
      { id: '4', properties: { status: '' } },
      { id: '5', properties: {} },
    ];

    const grouped = groupPagesForTable(
      pages,
      'status',
      ['Todo', 'Done'],
      ['Todo', 'Done', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.deepEqual(grouped.Todo.map((p) => p.id), ['1']);
    assert.deepEqual(grouped.Done.map((p) => p.id), ['2']);
    assert.deepEqual(grouped[UNCATEGORIZED_TABLE_GROUP].map((p) => p.id), ['3', '4', '5']);
  });

  it('does not surface pages for hidden groups', () => {
    const grouped = groupPagesForTable(
      [
        { id: '1', properties: { status: 'Todo' } },
        { id: '2', properties: { status: 'Done' } },
      ],
      'status',
      ['Todo', 'Done'],
      ['Done', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.equal(grouped.Todo, undefined);
    assert.deepEqual(grouped.Done.map((p) => p.id), ['2']);
  });
});
