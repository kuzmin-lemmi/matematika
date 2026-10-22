import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadHtml } from './helpers.mjs';

// Шаблон должен оставаться рабочим: с него начинается каждый новый материал
const html = readFileSync(new URL('../templates/material.html', import.meta.url), 'utf8');

test('шаблон открывается во всех режимах без ошибок', t => {
  for (const query of ['', '?mode=board', '?mode=print', '?mode=home', '?mode=board&preview=1']) {
    const m = loadHtml(html, { query, slug: 'template' });
    t.after(m.close);
    assert.deepEqual(m.errors, [], query);
    assert.ok(m.window.APP, query);
  }
});

test('шаблон: ссылка для учеников открывает только тренажёр', t => {
  const m = loadHtml(html, { query: '?mode=home&student=1', slug: 'template' });
  t.after(m.close);
  const { APP } = m.window;
  assert.equal(APP.screen, 'home');
  APP.show('print'); APP.show('start');
  assert.equal(APP.screen, 'home');
  assert.deepEqual(m.errors, []);
});

test('шаблон: раздатка, доска и тренажёр связаны одним генератором', t => {
  const m = loadHtml(html, { query: '?mode=home', slug: 'template' });
  t.after(m.close);
  const { APP } = m.window;
  assert.equal(JSON.stringify(APP.makeVariant(4817)), JSON.stringify(APP.makeVariant(4817)));
  const v = APP.makeVariant(4817);
  v.tasks.forEach((task, i) => assert.equal(v.answers[i], task.a + task.b));
  while (!(APP.board.i === APP.board.steps.length - 1 && APP.board.phase === 1)) APP.board.next();
  APP.home.start({ seed: 1 });
  const task = APP.home.state.task;
  assert.equal(APP.home.check(task.a + task.b - 10).cat, 'carry');
  APP.home.next();
  const t2 = APP.home.state.task;
  assert.equal(APP.home.check(t2.a + t2.b).ok, true);
  assert.equal(APP.parseNum('2,5'), 2.5);
  assert.equal(APP.parseNum('−3'), -3);
  assert.deepEqual(m.errors, []);
});
