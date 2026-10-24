import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { parse } from 'yaml';

const plans = JSON.parse(readFileSync(new URL('../src/data/lesson-plans.json', import.meta.url)));
async function loadTS(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { quarterLessons, quarterTopics, lessonRanges, topicMaterials } = await loadTS('../src/lesson-plan.ts');
const { initLessonPlan, currentQuarter } = await loadTS('../src/scripts/lesson-plan.ts');

test('850 уроков: все классы, четыре четверти, нумерация без потерь и повторов', () => {
  assert.equal(plans.length, 8);
  assert.equal(plans.reduce((n, p) => n + p.lessons.length, 0), 850);
  for (const p of plans) {
    assert.equal(p.lessons.length, p.subject === 'math' ? 170 : p.subject === 'algebra' ? 102 : 68);
    const lessons = [1,2,3,4].flatMap(q => {
      const rows = quarterLessons(p, q);
      assert.equal(rows[0].number, 1);
      assert.deepEqual(rows.map(r => r.number), Array.from({length:rows.length}, (_,i) => i+1));
      return rows;
    });
    assert.deepEqual(lessons.map(l => l.annualNumber), Array.from({length:p.lessons.length}, (_,i) => i+1));
    for (const title of p.lessons) {
      assert.ok(title.length > 5 && title.length < 250, title);
      assert.doesNotMatch(title, /https?:|Библиотека|СТРАНИЦА|٧/);
    }
  }
});

test('Темы объединяются внутри четверти, включая несоседние повторы и продолжение в следующей четверти', () => {
  const plan = {grade:5, subject:'math', quarterEnds:[4,6,7,8], lessons:['Дроби','Числа','Дроби',' Числа  ','Дроби','Дроби','Углы','Повторение']};
  assert.deepEqual(quarterTopics(plan,1),[
    {title:'Дроби',number:1,annualNumbers:[1,3]},
    {title:'Числа',number:2,annualNumbers:[2,4]},
  ]);
  assert.deepEqual(quarterTopics(plan,2),[{title:'Дроби',number:1,annualNumbers:[5,6]}]);
  for (const p of plans) for (const q of [1,2,3,4]) {
    const topics = quarterTopics(p,q);
    assert.equal(new Set(topics.map(t=>t.title.trim().replace(/\s+/g,' ').toLowerCase())).size,topics.length);
    assert.deepEqual(topics.flatMap(t=>t.annualNumbers).sort((a,b)=>a-b),quarterLessons(p,q).map(l=>l.annualNumber));
    assert.deepEqual(topics.map(t=>t.number),Array.from({length:topics.length},(_,i)=>i+1));
  }
});

test('Привязки материалов ведут на существующие уроки нужного класса и предмета', () => {
  const dir = new URL('../src/content/items/', import.meta.url);
  let bound = 0;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const data = parse(readFileSync(new URL(file, dir), 'utf8').split('---')[1]);
    for (const ref of [...(data.planLessons ?? []), ...(data.planRelated ?? [])]) {
      const plan = plans.find(p => p.grade === ref.grade && p.subject === data.subject);
      assert.ok(plan && data.grades.includes(ref.grade), file);
      assert.equal(new Set(ref.lessons).size, ref.lessons.length);
      for (const n of ref.lessons) assert.ok(Number.isInteger(n) && plan.lessons[n-1], `${file}: ${n}`);
      bound++;
    }
    // урок не может быть одновременно основным и «подходит» для одного материала
    for (const rel of data.planRelated ?? []) {
      const main = (data.planLessons ?? []).filter(r => r.grade === rel.grade).flatMap(r => r.lessons);
      for (const n of rel.lessons) assert.ok(!main.includes(n), `${file}: урок ${n} и основной, и «подходит»`);
    }
  }
  assert.ok(bound >= 4);
});

test('Фильтр сохраняет номера уроков, четверти и предмет восстанавливаются из URL', () => {
  const panes = ['algebra','geometry'].flatMap(s => [1,2,3,4].map(q => `<section data-plan-pane data-subject="${s}" data-quarter="${q}"><li data-lesson data-ready="false">1</li><li data-lesson data-ready="true">2</li><p data-empty hidden></p></section>`)).join('');
  const dom = new JSDOM(`<div data-root><div data-plan-controls hidden>${['algebra','geometry'].map(s=>`<button data-subject-button="${s}"></button>`).join('')}${[1,2,3,4].map(q=>`<button data-quarter-button="${q}"><span data-count></span></button>`).join('')}<input type="checkbox" data-ready-only></div><p data-plan-status></p>${panes}</div>`, {url:'https://matshag.ru/klass/7/?subject=geometry&quarter=3&ready=1'});
  const root = dom.window.document.querySelector('[data-root]');
  initLessonPlan(root, new Date(2026, 9, 24));
  const visible = () => [...root.querySelectorAll('[data-plan-pane]')].filter(p=>!p.hidden);
  assert.equal(visible().length,1);
  assert.equal(visible()[0].dataset.subject,'geometry');
  assert.equal(visible()[0].dataset.quarter,'3');
  assert.deepEqual([...visible()[0].querySelectorAll('[data-lesson]')].filter(r=>!r.hidden).map(r=>r.textContent),['2']);
  root.querySelector('[data-quarter-button="2"]').click();
  assert.equal(visible()[0].dataset.quarter,'2');
  assert.equal(new URL(dom.window.location.href).searchParams.get('quarter'),'2');
  const ready = root.querySelector('[data-ready-only]');
  ready.checked=false;ready.dispatchEvent(new dom.window.Event('change'));
  assert.equal(visible()[0].querySelectorAll('[data-lesson]:not([hidden])').length,2);
  dom.window.history.pushState(null,'','?subject=bad&quarter=99');
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  assert.equal(visible()[0].dataset.subject,'algebra');
  assert.equal(visible()[0].dataset.quarter,'1', 'без четверти в адресе — текущая по дате (24 октября — 1-я)');
  dom.window.close();
});

test('Текущая четверть по дате', () => {
  const q = (m, d) => currentQuarter(new Date(2026, m - 1, d));
  assert.equal(q(9, 1), 1); assert.equal(q(10, 24), 1);
  assert.equal(q(11, 5), 2); assert.equal(q(12, 28), 2);
  assert.equal(q(1, 12), 3); assert.equal(q(3, 20), 3);
  assert.equal(q(4, 1), 4); assert.equal(q(5, 25), 4);
  assert.equal(q(7, 15), 1);
});

test('Номера уроков темы за год: диапазоны и повторы', () => {
  assert.equal(lessonRanges([44,45,46,47,48,49,50]), '44–50');
  assert.equal(lessonRanges([52]), '52');
  assert.equal(lessonRanges([150,92,93,94,145]), '92–94, 145, 150');
});

test('«Сложение дробей» привязано к 5 классу: там по плану сложение и вычитание обыкновенных дробей', () => {
  const card = parse(readFileSync(new URL('../src/content/items/slozhenie-drobei.md', import.meta.url), 'utf8').split('---')[1]);
  assert.ok(card.grades.includes(5));
  const p5 = plans.find(p => p.grade === 5 && p.subject === 'math');
  const ref = card.planLessons.find(r => r.grade === 5);
  for (const n of ref.lessons) assert.equal(p5.lessons[n - 1], 'Сложение и вычитание обыкновенных дробей');
});

test('Материалы темы: основные — кнопками один раз в четверти, остальное — ссылкой «подходит»', () => {
  const item = (id, main, rel = []) => ({ id, data: { planLessons: [{ grade: 8, lessons: main }], planRelated: rel.length ? [{ grade: 8, lessons: rel }] : [] } });
  const koren = item('koren', [20, 26, 27], [22, 23, 25]);
  const own = item('own', [22]);   // материал, сделанный именно для урока 22
  const topics = [{ annualNumbers: [20] }, { annualNumbers: [21] }, { annualNumbers: [22, 23] }];
  const r = topicMaterials(topics, [koren, own], 8).map(t => ({ main: t.materials.map(i => i.id), rel: t.related.map(i => i.id) }));
  assert.deepEqual(r, [
    { main: ['koren'], rel: [] },
    { main: [], rel: [] },
    { main: ['own'], rel: ['koren'] },   // свой материал — кнопками, общий — ссылкой
  ]);
  // основной у двух тем одной четверти — у второй уже ссылка
  const q2 = topicMaterials([{ annualNumbers: [25] }, { annualNumbers: [26] }, { annualNumbers: [27] }], [koren], 8)
    .map(t => [t.materials.length, t.related.length]);
  assert.deepEqual(q2, [[0, 1], [1, 0], [0, 1]]);
  // другой класс — привязки не действуют
  assert.equal(topicMaterials(topics, [koren], 7).every(t => !t.materials.length && !t.related.length), true);
});
