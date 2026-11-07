// Автотест темы «Сложение, вычитание, умножение многочленов» на сайте. Общие проверки (режимы,
// 30 вариантов, доска, тренажёр) делает тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение:
// коэффициенты пересчитываются вручную, произведения — «в лоб» по степеням.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'deistviya-s-mnogochlenami';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));

// многочлен — { степень: коэффициент }; умножаем почленно
const P = (...terms) => Object.fromEntries(terms);
const pmul = (u, v) => {
  const r = {};
  for (const [p, a] of Object.entries(u)) for (const [q, b] of Object.entries(v)) r[+p + +q] = (r[+p + +q] || 0) + a * b;
  return r;
};
const coefAt = (u, m) => u[m] || 0;

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'add': return { value: 'add:ok', key: `add:${t.P.c2},${t.P.c1},${t.P.c0}+${t.Q.c2},${t.Q.c1},${t.Q.c0}` };
    case 'sub': return { value: 'sub:ok', key: `sub:${t.P.c2},${t.P.c1},${t.P.c0}-${t.Q.c2},${t.Q.c1},${t.Q.c0}` };
    case 'mul2': return { value: 'mul2:ok', key: `mul2:${t.a},${t.b}` };
    case 'prod': return { value: 'prod:ok', key: `prod:${t.a},${t.b},${t.c},${t.d}` };
    case 'check': { const s = t.v === 'add' ? 'да' : 'нет'; return { value: s, key: s }; }
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
      if (type === 'add' || type === 'sub') {
        // ответ считаем вручную по коэффициентам
        const s = type === 'add' ? 1 : -1;
        const exp = [task.P.c2 + s * task.Q.c2, task.P.c1 + s * task.Q.c1, task.P.c0 + s * task.Q.c0];
        assert.ok(exp.every(c => c !== 0), 'в ответе нет нулевых коэффициентов');
        if (Math.abs(exp[0]) !== 1) assert.ok(T.keyHTML(task).includes(String(Math.abs(exp[0]))), 'старший коэффициент в ответе');
      }
      if (type === 'mul2') {
        // (x+a)(x+b) «в лоб»
        const prod = pmul({ 1: 1, 0: task.a }, { 1: 1, 0: task.b });
        assert.equal(coefAt(prod, 2), 1);
        assert.equal(coefAt(prod, 1), task.a + task.b, 'средний член — сумма');
        assert.equal(coefAt(prod, 0), task.a * task.b);
        assert.notEqual(task.a + task.b, 0, 'средний член не нулевой');
      }
      if (type === 'prod') {
        // (ax+b)(cx+d) «в лоб»
        const prod = pmul({ 1: task.a, 0: task.b }, { 1: task.c, 0: task.d });
        assert.equal(coefAt(prod, 2), task.a * task.c, 'старший коэффициент умножается');
        assert.equal(coefAt(prod, 1), task.a * task.d + task.b * task.c);
        assert.equal(coefAt(prod, 0), task.b * task.d);
      }
      if (type === 'check') {
        assert.equal(T.ans(task), task.v === 'add' ? 'да' : 'нет');
      }
    }
    assert.ok(seen.size >= 15, `${type}: задания разнообразны (${seen.size})`);
  }
});

test('раздатка: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.tasks.map(x => x.type)], ['add', 'sub', 'mul2', 'prod', 'check']);
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

// Типичные ошибки называются по имени. Подставляем задание вручную.
function ask(w, level, task, answer) {
  const h = w.APP.home;
  h.start({ level, seed: 1 });
  Object.assign(h.state, { task, wait: false, taskDone: false });
  return h.check(answer);
}
const T3 = (c2, c1, c0) => ({ c2, c1, c0 });
test('тренажёр: вторую скобку прибавил вместо вычитания — «sign»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'sub', P: T3(5, 2, 1), Q: T3(3, -1, 4), o: 1 };
  const r = ask(w, 0, task, 'sub:t1');
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'sign');
});
test('тренажёр: потерял средний член — «middle»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'mul2', a: 2, b: 3, o: 1 };
  const r = ask(w, 1, task, 'mul2:t1');
  assert.equal(r.cat, 'middle');
  assert.match(r.msg, /5/);
});
test('тренажёр: поверил неверному равенству — «trust»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'check', a: 2, b: 3, c: 1, d: 4, v: 'mul' };
  const r = ask(w, 2, task, 'да');
  assert.equal(r.cat, 'trust');
});
