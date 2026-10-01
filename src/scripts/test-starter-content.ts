/**
 * Starter content in every language (V2 R8.9): the item templates, the stock database
 * and the sample workspace. `tsc` already proves every locale has every word; this
 * checks what types cannot — that the words still fit the structure they are poured
 * into. A translated option value that a seed row or a board's column order spells
 * differently would leave rows in "no status" or a board column empty.
 *
 *   npm run test:starter
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routing } from '@/i18n/routing';
import { localeFromAcceptLanguage } from '@/i18n/requestLocale';
import { getSampleText, getTemplateText } from '@/lib/starterContent';
import { TEMPLATE_CATALOG, buildTemplate, stockDatabaseSchema, stockStatusDefault, type SchemaColumn } from '@/lib/templates';

const optionValues = (column: SchemaColumn) =>
  (column.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));

const OPTION_TYPES = new Set(['select', 'multi_select', 'status']);

function checkOptionsUnique(where: string, schema: SchemaColumn[]) {
  for (const column of schema) {
    if (!OPTION_TYPES.has(column.type)) continue;
    const values = optionValues(column);
    assert.equal(new Set(values).size, values.length, `${where}: duplicate option in "${column.name}"`);
    for (const v of values) assert.ok(v.trim(), `${where}: empty option in "${column.name}"`);
  }
  const names = schema.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, `${where}: two columns share a name`);
  for (const n of names) assert.ok(n.trim(), `${where}: a column has no name`);
}

/** Bold that a CJK colon closes never renders: `**连接：**智能体` shows the asterisks. */
function checkMarkdown(where: string, markdown: string) {
  assert.ok(!/[：；，。、！？]\*\*[^\s*]/.test(markdown), `${where}: bold closed after full-width punctuation`);
  for (const [, attr] of markdown.matchAll(/data-callout-text="([^"]*)"/g)) {
    assert.ok(!attr.includes('<'), `${where}: markup inside a callout attribute`);
  }
  const ticks = markdown.match(/`/g)?.length ?? 0;
  assert.equal(ticks % 2, 0, `${where}: unbalanced inline code`);
}

async function main() {
  const messages = (locale: string) =>
    JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as {
      Database: Record<string, string>;
    };

  for (const locale of routing.locales) {
    const text = await getTemplateText(locale);
    const ui = messages(locale).Database;

    // The template views use the UI's own view names, so a template's "Table" and a
    // hand-made one read the same.
    assert.equal(text.views.table, ui.viewTable, `${locale}: views.table ≠ Database.viewTable`);
    assert.equal(text.views.board, ui.viewBoard, `${locale}: views.board ≠ Database.viewBoard`);
    assert.equal(text.views.calendar, ui.viewCalendar, `${locale}: views.calendar ≠ Database.viewCalendar`);

    // The stock database: a new row lands on its "to do" option.
    const stock = stockDatabaseSchema(text.stock);
    checkOptionsUnique(`${locale} stock`, stock);
    const stockStatus = stock.find((c) => c.id === 'status')!;
    assert.equal(stockStatusDefault(stockStatus.options), text.stock.todo, `${locale}: stock default is not the to-do option`);

    for (const entry of TEMPLATE_CATALOG) {
      const where = `${locale} ${entry.id}`;
      const template = buildTemplate(entry.id, text);
      assert.equal(template.category, entry.category, `${where}: category`);

      if (template.category === 'page') {
        checkMarkdown(where, template.initialContent);
        if (entry.id !== 'page-blank') assert.ok(template.initialContent.trim(), `${where}: empty body`);
        continue;
      }
      if (template.category === 'dashboard') continue;

      checkOptionsUnique(where, template.schema);
      const byId = new Map(template.schema.map((c) => [c.id, c]));
      assert.ok(byId.has('title'), `${where}: no title column`);

      for (const view of template.views) {
        assert.ok(view.name.trim(), `${where}: unnamed view`);
        const config = view.config as { groupByCol?: string; groupOrder?: string[] };
        if (config.groupByCol && config.groupOrder?.length) {
          const values = optionValues(byId.get(config.groupByCol)!);
          assert.deepEqual([...config.groupOrder].sort(), [...values].sort(), `${where}: "${view.name}" column order`);
        }
      }

      const titles = new Set<string>();
      for (const row of template.seedRows ?? []) {
        assert.ok(row.title.trim(), `${where}: untitled seed row`);
        assert.ok(!titles.has(row.title), `${where}: seed row "${row.title}" twice`);
        titles.add(row.title);
        for (const [columnId, value] of Object.entries(row.properties)) {
          const column = byId.get(columnId);
          assert.ok(column, `${where}: seed row writes unknown column "${columnId}"`);
          if (!OPTION_TYPES.has(column.type) || value === '' || value == null) continue;
          const values = optionValues(column);
          for (const v of Array.isArray(value) ? value : [value]) {
            assert.ok(values.includes(String(v)), `${where}: "${v}" is not an option of "${column.name}"`);
          }
        }
      }
    }

    const sample = await getSampleText(locale);
    const board = sample.sprintBoard;
    for (const [group, values] of Object.entries({ status: board.status, priority: board.priority, category: board.category })) {
      const list = Object.values(values);
      assert.equal(new Set(list).size, list.length, `${locale} sample: duplicate ${group} option`);
    }
    assert.equal(board.views.table, ui.viewTable, `${locale} sample: table view ≠ Database.viewTable`);
    assert.equal(board.views.board, ui.viewBoard, `${locale} sample: board view ≠ Database.viewBoard`);
    assert.ok(sample.startHere.content.includes('{{HOW_BUILT_CB}}'), `${locale} sample: Start Here lost the child page marker`);
    assert.ok(sample.workspaceName('Ada').includes('Ada'), `${locale} sample: workspace name drops the user name`);
    checkMarkdown(`${locale} startHere`, sample.startHere.content);
    checkMarkdown(`${locale} howBuilt`, sample.howBuilt.content);
    checkMarkdown(`${locale} productSpec`, sample.productSpec.content);
    const taskTitles = new Set<string>();
    for (const [key, task] of Object.entries(sample.tasks)) {
      const where = `${locale} task ${key}`;
      assert.ok(task.content.startsWith(`# ${task.title}\n`), `${where}: body heading ≠ title`);
      assert.ok(!taskTitles.has(task.title), `${where}: title used twice`);
      taskTitles.add(task.title);
      checkMarkdown(where, task.content);
    }
  }

  // The save-memory prompt maps a memory type to a database's option by its word in any
  // language, so no word may mean two types across the locales.
  const memoryWords = new Map<string, string>();
  for (const locale of routing.locales) {
    for (const [type, word] of Object.entries((await getTemplateText(locale)).agentMemory.type)) {
      const seen = memoryWords.get(word);
      assert.ok(!seen || seen === type, `${locale}: Agent Memory "${word}" means both ${seen} and ${type}`);
      memoryWords.set(word, type);
    }
  }

  // Legacy stock columns (plain strings, no groups) keep their old default.
  assert.equal(stockStatusDefault(['To Do', 'In Progress', 'Done']), 'To Do');
  assert.equal(stockStatusDefault(['Doing', 'Done']), undefined);
  assert.equal(stockStatusDefault(undefined), undefined);

  // The request language when no middleware ran (route handlers, Auth.js events).
  assert.equal(localeFromAcceptLanguage('tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'), 'tr');
  assert.equal(localeFromAcceptLanguage('ja,de;q=0.5,fr;q=0.8'), 'fr');
  assert.equal(localeFromAcceptLanguage('pt-BR,*;q=0.5'), null);
  assert.equal(localeFromAcceptLanguage('zh-CN'), 'zh');
  assert.equal(localeFromAcceptLanguage(''), null);

  console.log(`starter content: ${routing.locales.length} locales × ${TEMPLATE_CATALOG.length} templates + sample workspace — ok`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
