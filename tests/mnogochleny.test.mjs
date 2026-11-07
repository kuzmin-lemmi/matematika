// Автотест темы «Многочлены» на сайте. Общие проверки (режимы, 30 вариантов, доска, тренажёр) делает
// тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: степени и коэффициенты пересчитываются
// вручную, а не кодом материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'mnogochleny';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'std': return { value: 'std:ok', key: `std:${t.terms.map(z => `${z.k}x${z.m}`).join('.')}` };
    case 'degree': { const d = Math.max(...t.terms.map(z => z.m)); return { value: { n: d, d: 1 }, key: `deg:${d}` }; }
    case 'free': { const f = t.terms[t.terms.length - 1].k; return { value: { n: f, d: 1 }, key: `free:${f}` }; }
    case 'terms': return { value: 'terms:ok', key: `terms:${t.terms.length}-${t.terms.map(z => `${z.k}x${z.m}`).join('.')}` };
    case 'check': { const s = t.v === 'mono' || t.v === 'zero' ? 'да' : 'нет'; return { value: s, key: s }; }
  }
  throw new Error('Нет независимого решения для типа ' + t.type);
}

function open(t, query = '') {
  const m = loadMaterial(SLUG, { query });
  t.after(m.close);
  return m;
}

test('генератор: задания математически корректны, ответ принимается', t => {
  const { APP } = open(t).window;
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 977);
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const task = plain(APP.generate(type, rnd)), e = expected(task), T = APP.TYPES[type];
      seen.add(JSON.stringify(task));
      assert.ok(T.same(task, e.value), `${type}: ${JSON.stringify(task)}`);
      assert.equal(T.key(task), e.key, `${type}: запись ответа`);
      assert.doesNotMatch(T.text(task), /undefined|NaN|\[object/, type);
      if (type === 'std') {
        // правильный ответ действительно в стандартном виде: степени строго убывают, показатели разные
        const degs = task.terms.map(z => z.m);
        assert.equal(new Set(degs).size, degs.length, 'показатели разные — подобные приведены');
      }
      if (type === 'degree') {
        assert.ok(e.value.n >= 0 && e.value.n <= 4);
        assert.ok(task.terms.some(z => z.m === e.value.n), 'степень-ответ встречается среди членов');
      }
      if (type === 'free') {
        assert.equal(task.terms[task.terms.length - 1].m, 0, 'последний член — без буквы');
      }
      if (type === 'terms') {
        assert.ok(task.terms.length >= 2 && task.terms.length <= 4);
      }
      if (type === 'check') {
        assert.equal(T.ans(task), (task.v === 'mono' || task.v === 'zero') ? 'да' : 'нет');
      }
    }
    assert.ok(seen.size >= 15, `${type}: задания разнообразны (${seen.size})`);
  }
});

test('раздатка: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.tasks.map(x => x.type)], ['std', 'degree', 'free', 'terms', 'check']);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => expected(plain(x)).key));
  }
});

test('тренажёр: независимый ответ принимается в каждом разделе', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let level = 0; level < w.APP.SECTIONS.length; level++) {
    h.start({ level, seed: 7 + level });
    for (let k = 0; k < 10; k++) {
      const r = h.check(expected(plain(h.state.task)).value);
      assert.ok(r.ok, `раздел ${level + 1}: ${r.msg}`);
      h.next();
    }
  }
  assert.deepEqual(errors, []);
});

// Типичные ошибки называются по имени
function ask(w, level, task, answer) {
  const h = w.APP.home;
  h.start({ level, seed: 1 });
  Object.assign(h.state, { task, wait: false, taskDone: false });
  return h.check(answer);
}
test('тренажёр: степени сложили — «degsum»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'degree', terms: [{ k: 2, v: 'x', m: 3 }, { k: 1, v: 'x', m: 1 }] };
  const r = ask(w, 1, task, { n: 4, d: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'degsum');
});
test('тренажёр: назвал коэффициент вместо свободного члена — «free»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'free', terms: [{ k: 4, v: 'x', m: 2 }, { k: -7, v: '', m: 0 }] };
  const r = ask(w, 1, task, { n: 4, d: 1 });
  assert.equal(r.cat, 'free');
});
test('тренажёр: поверил неверному утверждению — «trust»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'check', a: 3, b: 5, v: 'power' };
  const r = ask(w, 2, task, 'да');
  assert.equal(r.cat, 'trust');
});
