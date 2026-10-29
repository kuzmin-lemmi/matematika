// src/lib.ts: адреса материалов, кнопки карточки, подписи классов, контраст цвета материала.
// lib.ts импортирует config.ts и читает import.meta.env.BASE_URL — транспилируем оба во временную папку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'matshag-lib-'));
const transpile = (file, out, patch = s => s) => {
  const source = patch(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  writeFileSync(join(dir, out), outputText);
};
transpile('config.ts', 'config.mjs');
transpile('lib.ts', 'lib.mjs', s => s.replace("from './config'", "from './config.mjs'").replaceAll('import.meta.env.BASE_URL', "'/'"));
const lib = await import(pathToFileURL(join(dir, 'lib.mjs')));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const item = (data = {}) => ({ id: 'teorema-pifagora', data: {
  url: 'materials/teorema-pifagora.html', access: 'free', parts: ['board', 'print', 'home'],
  sheets: [{ kind: 'oge', label: 'Бланк ОГЭ', icon: '🧾' }], ...data } });

test('адреса: наружу — /zapusk/ и /item/, внешние — как есть', () => {
  const it = item();
  assert.equal(lib.openPageHref(it), '/zapusk/teorema-pifagora/');
  assert.equal(lib.openPageHref(it, 'print'), '/zapusk/teorema-pifagora/?mode=print');
  assert.equal(lib.sheetHref(it, 'oge'), '/zapusk/teorema-pifagora/?mode=print&kind=oge');
  assert.equal(lib.pageHref('teorema-pifagora'), '/item/teorema-pifagora/');
  assert.equal(lib.studentHref(it, new URL('https://matshag.ru')), 'https://matshag.ru/zapusk/teorema-pifagora/?mode=home&student=1');
  const ext = item({ url: 'https://example.org/kurs', access: 'external' });
  assert.equal(lib.openPageHref(ext), 'https://example.org/kurs');
  assert.equal(lib.studentHref(ext), '');
  assert.equal(lib.studentHref(item({ parts: ['board'] })), '', 'без режима «Дома» ссылки для учеников нет');
});

test('кнопки карточки: опубликованный, «скоро», платный, внешний', () => {
  const free = lib.itemLinks(item());
  assert.deepEqual(free.modes.map(m => m.part), ['board', 'print', 'home']);
  assert.equal(free.sheets[0].href, '/zapusk/teorema-pifagora/?mode=print&kind=oge');
  assert.equal(free.download, '/materials/teorema-pifagora.html');
  assert.equal(free.external, false);

  const soon = lib.itemLinks(item({ access: 'soon' }));
  assert.deepEqual([soon.ready, soon.open, soon.modes.length, soon.sheets.length, soon.download], [false, '', 0, 0, '']);

  const paid = lib.itemLinks(item({ access: 'paid' }));
  assert.equal(paid.download, '', 'платный материал не скачивается');

  const ext = lib.itemLinks(item({ url: 'https://example.org/kurs', access: 'external' }));
  assert.deepEqual([ext.external, ext.local, ext.open, ext.modes.length, ext.download], [true, false, 'https://example.org/kurs', 0, '']);
});

test('подписи классов', () => {
  assert.equal(lib.gradeLabel([]), '');
  assert.equal(lib.gradeLabel([7]), '7 класс');
  assert.equal(lib.gradeLabel([9, 5, 7, 6, 8]), '5–9 классы');
  assert.equal(lib.gradeLabel([5, 7]), '5 класс, 7 класс');
  assert.deepEqual(lib.gradeSubjects(6), ['math']);
  assert.deepEqual(lib.gradeSubjects(8), ['algebra', 'geometry']);
});

test('цвет материала: кнопки и текст читаются на светлом и тёмном фоне (контраст ≥ 4,6)', () => {
  const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const hex of ['#E07A1F', '#3D7563', '#FFD400', '#2F6FD6', '#111111', '#FFFFFF']) {
    const vars = Object.fromEntries(lib.colorVars(hex).split(';').map(v => v.split(':')));
    assert.equal(vars['--c'], hex);
    assert.ok(contrast(vars['--cb'], '#FFFDF8') >= 4.6, `${hex}: --cb ${vars['--cb']} на светлом`);
    assert.ok(contrast(vars['--cd'], '#20332B') >= 4.6, `${hex}: --cd ${vars['--cd']} на тёмном`);
  }
});
