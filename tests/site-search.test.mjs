import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const source = readFileSync(new URL('../src/scripts/site-search.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { matchesSearch, initSiteSearch } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const entries = [
  { kind:'material', title:'Арифметический квадратный корень', text:'Арифметический квадратный корень алгебра 8 класс', href:'/item/koren/', grades:[8], subject:'algebra', detail:'Алгебра · 8 класс', ready:true, status:'Материал доступен' },
  { kind:'topic', title:'Свойства квадратных корней', text:'Свойства квадратных корней алгебра 8 класс', href:'/klass/8/?subject=algebra&quarter=2#topic-algebra-2-1', grades:[8], subject:'algebra', detail:'8 класс · Алгебра · 2 четверть', ready:true, status:'Есть материал' },
  { kind:'topic', title:'Сравнение дробей', text:'Сравнение дробей математика 6 класс', href:'/klass/6/?subject=math&quarter=1#topic-math-1-1', grades:[6], subject:'math', detail:'6 класс · Математика · 1 четверть', ready:false, status:'Материалов пока нет' },
  { kind:'topic', title:'Признаки равенства треугольников', text:'Признаки равенства треугольников геометрия 7 класс', href:'/klass/7/?subject=geometry&quarter=2#topic-geometry-2-1', grades:[7], subject:'geometry', detail:'7 класс · Геометрия · 2 четверть', ready:true, status:'Есть материал' },
];

test('поиск понимает регистр, ё, формы слов и сочетает условия', () => {
  assert.equal(matchesSearch(entries[1], 'КВАДРАТНЫЙ КОРЕНЬ', '', '', false), true);
  assert.equal(matchesSearch(entries[2], 'дроби', '', '', false), true);
  assert.equal(matchesSearch(entries[3], 'треугольники', '7', 'geometry', true), true);
  assert.equal(matchesSearch(entries[3], 'треугольники', '8', 'geometry', true), false);
  assert.equal(matchesSearch(entries[2], 'дроби', '', '', true), false);
  assert.equal(matchesSearch(entries[0], 'корень геометрия', '', '', false), false);
  assert.equal(matchesSearch({ ...entries[0], text:'трёхзначное число' }, 'трехзначное', '', '', false), true);
});

test('поиск понимает беглую гласную: углы — угол, отрезки — отрезок', () => {
  const topic = text => ({ ...entries[3], text });
  for (const [query, text] of [['углы', 'Угол между прямыми'], ['угол', 'Углы при параллельных прямых'], ['угла', 'Измерение углов'],
    ['отрезки', 'Отрезок и его длина'], ['корни', 'Квадратный корень'], ['делители', 'Делитель и кратное'], ['дробь', 'Сложение дробей']]) {
    assert.equal(matchesSearch(topic(text), query, '', '', false), true, `«${query}» находит «${text}»`);
  }
  assert.equal(matchesSearch(topic('Угол между прямыми'), 'уголок треугольника', '', '', false), false);
});

test('запрос из адреса, фильтры, ссылки, пустой результат и возврат в истории', t => {
  const dom = new JSDOM(`<main><form data-search-form><input data-search-query><select data-search-grade><option value="">Все</option><option value="6">6</option><option value="8">8</option></select><select data-search-subject><option value="">Все</option><option value="algebra">Алгебра</option></select><input type="checkbox" data-search-ready><button type="submit">Найти</button></form><button data-search-example="дроби"></button><p data-search-status></p><div data-search-results></div><button data-search-more hidden></button></main>`, { url:'https://matshag.ru/poisk/?q=корень' });
  t.after(() => dom.window.close());
  const root = dom.window.document.querySelector('main');
  initSiteSearch(root, entries);
  assert.equal(root.querySelectorAll('.result-row').length, 2);
  assert.equal(root.querySelector('.result-row a').getAttribute('href'), '/item/koren/');
  assert.match(root.querySelectorAll('.result-row a')[1].getAttribute('href'), /subject=algebra&quarter=2#topic-algebra-2-1/);
  const grade = root.querySelector('[data-search-grade]');
  grade.value = '6'; grade.dispatchEvent(new dom.window.Event('change'));
  assert.match(root.querySelector('[data-search-status]').textContent, /Ничего не нашлось/);
  assert.equal(new URL(dom.window.location.href).searchParams.get('grade'), '6');
  root.querySelector('[data-search-example]').click();
  assert.equal(root.querySelectorAll('.result-row').length, 1);
  assert.equal(root.querySelector('.result-title').textContent, 'Сравнение дробей');
  dom.window.history.pushState(null, '', '?q=корень&grade=8&subject=algebra&ready=1');
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  assert.equal(root.querySelectorAll('.result-row').length, 2);
  assert.equal(root.querySelector('[data-search-ready]').checked, true);
});

test('список тем ограничивается и раскрывается без потери результатов', t => {
  const dom = new JSDOM(`<main><form data-search-form><input data-search-query><select data-search-grade><option value=""></option></select><select data-search-subject><option value=""></option></select><input type="checkbox" data-search-ready></form><p data-search-status></p><div data-search-results></div><button data-search-more hidden></button></main>`, { url:'https://matshag.ru/poisk/?q=дроби' });
  t.after(() => dom.window.close());
  const root = dom.window.document.querySelector('main');
  initSiteSearch(root, Array.from({ length: 35 }, (_, i) => ({ ...entries[2], title: `Дроби ${i}` })));
  assert.equal(root.querySelectorAll('.result-row').length, 30);
  const more = root.querySelector('[data-search-more]');
  assert.equal(more.hidden, false);
  more.click();
  assert.equal(root.querySelectorAll('.result-row').length, 35);
  assert.equal(more.hidden, true);
});
