// Автотест темы «Разложение многочленов на множители» на сайте. Общие проверки (режимы, 30 вариантов, доска,
// тренажёр) делает тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: многочлены перемножаются
// «в лоб» по степеням, а не по формулам, чтобы тест не повторил ошибку материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'razlozhenie-na-mnozhiteli';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));

// многочлен — { степень: коэффициент }; умножаем почленно
const P = (...terms) => Object.fromEntries(terms);
const pmul = (u, v) => {
  const r = {};
  for (const [p, a] of Object.entries(u)) for (const [q, b] of Object.entries(v)) r[+p + +q] = (r[+p + +q] || 0) + a * b;
  return r;
};
const padd = (u, v) => {
  const r = { ...u };
  for (const [p, a] of Object.entries(v)) r[p] = (r[p] || 0) + a;
  return r;
};
const neg = u => Object.fromEntries(Object.entries(u).map(([p, a]) => [p, -a]));
const mon = x => P([x.m, x.k]);
const coefAt = (u, m) => u[m] || 0;

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'common': return { value: 'common:ok', key: `common:${t.C.k}x${t.C.m}` };
    case 'group': return { value: 'group:ok', key: `group:${t.a}+${t.b}` };
    case 'diffsq': return { value: 'diffsq:ok', key: `diffsq:${t.A.k}x${t.A.m}-${t.B.k}x${t.B.m}` };
    case 'square': return { value: 'square:ok', key: `square:${t.A.k}x${t.A.m}${t.sign > 0 ? '+' : '-'}${t.B.k}x${t.B.m}` };
    case 'combo': return { value: 'combo:ok', key: `combo:${t.c}-${t.b}` };
    case 'check': { const s = t.v === 'ok' ? 'да' : 'нет'; return { value: s, key: s }; }
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
      if (type === 'common') {
        // слагаемые — это C·P и C·Q, посчитанные «в лоб»
        const p1 = pmul(mon(task.C), mon(task.P)), p2 = pmul(mon(task.C), mon(task.Q));
        assert.equal(coefAt(p1, task.C.m + task.P.m), task.C.k * task.P.k);
        assert.equal(coefAt(p2, task.C.m), task.C.k * task.Q.k);
        const terms = T.terms(task);
        assert.deepEqual([terms[0].k, terms[0].m], [task.C.k * task.P.k, task.C.m + task.P.m]);
        assert.deepEqual([terms[1].k, terms[1].m], [task.C.k * task.Q.k, task.C.m]);
        assert.notEqual(terms[0].m, terms[1].m, 'степени слагаемых разные');
      }
      if (type === 'group') {
        assert.notEqual(task.a, task.b, 'коэффициенты групп разные');
        assert.deepEqual([...T.terms(task).map(x => x.k)], [task.a, task.a, task.b, task.b]);
      }
      if (type === 'diffsq') {
        // (A−B)(A+B) «в лоб» даёт A²−B²
        const prod = pmul(padd(mon(task.A), neg(mon(task.B))), padd(mon(task.A), mon(task.B)));
        assert.equal(coefAt(prod, 2 * task.A.m), task.A.k * task.A.k);
        assert.equal(coefAt(prod, 2 * task.B.m), -task.B.k * task.B.k);
        assert.equal(coefAt(prod, task.A.m + task.B.m), 0, 'средний член сокращается');
        assert.notEqual(task.A.m, task.B.m, 'показатели разные');
      }
      if (type === 'square') {
        // (A±B)² «в лоб»
        const s = task.sign > 0 ? 1 : -1;
        const prod = pmul(padd(mon(task.A), P([task.B.m, s * task.B.k])), padd(mon(task.A), P([task.B.m, s * task.B.k])));
        assert.equal(coefAt(prod, task.A.m + task.B.m), 2 * s * task.A.k * task.B.k, 'средний член 2ab');
      }
      if (type === 'combo') {
        // второй член — c·b²
        assert.ok(T.text(task).includes(String(task.c * task.b * task.b)), 'второй член — c·b²');
        const prod = pmul(mon({ k: task.c, m: 0 }), pmul(padd(P([1, 1]), P([0, -task.b])), padd(P([1, 1]), P([0, task.b]))));
        assert.equal(coefAt(prod, 2), task.c);
        assert.equal(coefAt(prod, 0), -task.c * task.b * task.b);
      }
      if (type === 'check') {
        // равенство верно только в варианте ok: (x−a)(x+a) = x²−a²; в остальных средний член или знак не те
        assert.equal(T.ans(task), task.v === 'ok' ? 'да' : 'нет');
      }
    }
    assert.ok(seen.size >= 15, `${type}: задания разнообразны (${seen.size})`);
  }
});

test('раздатка: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.tasks.map(x => x.type)], ['common', 'group', 'diffsq', 'square', 'combo', 'check']);
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
function ask(w, task, answer) {
  const h = w.APP.home;
  h.start({ level: 0, seed: 1 });
  Object.assign(h.state, { task: { type: 'common', ...task }, wait: false, taskDone: false });
  return h.check(answer);
}
test('тренажёр: вынес только число — «part»', t => {
  const { window: w } = open(t, '?mode=home');
  const r = ask(w, { C: { k: 3, m: 1 }, P: { k: 2, m: 1 }, Q: { k: 3, m: 0 }, o: 1 }, 'common:t1');
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'part');
  assert.match(r.msg, /3/);
});
test('тренажёр: внёс множитель внутрь скобок — «combo»', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 2, seed: 1 });
  Object.assign(h.state, { task: { type: 'combo', c: 2, b: 3, o: 1 }, wait: false, taskDone: false });
  const r = h.check('combo:t1');
  assert.equal(r.cat, 'combo');
});
test('тренажёр: поверил неверному равенству — «trust»', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 2, seed: 1 });
  Object.assign(h.state, { task: { type: 'check', a: 5, v: 'sign' }, wait: false, taskDone: false });
  const r = h.check('да');
  assert.equal(r.cat, 'trust');
});
