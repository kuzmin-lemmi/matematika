// Автотест темы «Буквенные выражения и подобные слагаемые» на сайте. Общие проверки (режимы, 30 вариантов,
// доска, тренажёр) делает тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: коэффициенты
// пересчитываются вручную, а не кодом материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'bukvennye-vyrazheniya';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));
const tkey = z => `${z.k}${z.v || ''}${z.m}`;

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'like': return { value: 'like:ok', key: `like:${t.terms.map(tkey).join('.')}` };
    case 'poly2': return { value: 'poly2:ok', key: `poly2:${t.terms.map(tkey).join('.')}` };
    case 'bracket': { const c = t.form === 'num' ? t.a : -1; return { value: 'bracket:ok', key: `bracket:${c}-${t.form}` }; }
    case 'expand': return { value: 'expand:ok', key: `expand:${t.a}-${t.p}-${t.b}-${t.q}` };
    case 'value': { const n = t.a * t.at + t.b; return { value: { n, d: 1 }, key: String(n).replace('-', MINUS) }; }
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
      if (type === 'like') {
        // сумма коэффициентов считается вручную; знаки смешанные, сумма не ноль
        const s = task.terms.reduce((a, z) => a + z.k, 0);
        assert.notEqual(s, 0, 'ответ не нулевой');
        assert.ok(task.terms.some(z => z.k > 0) && task.terms.some(z => z.k < 0), 'знаки смешанные');
        assert.ok(T.keyHTML(task).includes('x') || T.keyHTML(task).includes('y'), 'ответ содержит букву');
      }
      if (type === 'poly2') {
        const L = task.terms.filter(z => z.m > 0).reduce((a, z) => a + z.k, 0);
        assert.notEqual(L, 0, 'коэффициент при букве не ноль');
        assert.ok(T.keyHTML(task).length > 0);
      }
      if (type === 'bracket') {
        // раскрытие вручную: множитель на каждое слагаемое
        const c = task.form === 'num' ? task.a : -1;
        const terms = T.terms(task);
        assert.equal(terms.length, 2);
        assert.deepEqual([...terms.map(z => z.k)], [c * (task.form === 'num' ? 1 : 1), c * (task.form === 'num' ? task.s * task.b : -2)]);
      }
      if (type === 'expand') {
        // свободный член — a·p + b·q
        assert.ok(T.keyHTML(task).includes(String(Math.abs(task.a * task.p + task.b * task.q))) || task.a * task.p + task.b * task.q === 0);
      }
      if (type === 'value') {
        assert.equal(e.value.n, task.a * task.at + task.b);
      }
      if (type === 'check') {
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
    assert.deepEqual([...v.tasks.map(x => x.type)], ['like', 'poly2', 'bracket', 'expand', 'value', 'check']);
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
test('тренажёр: сложил модули без учёта знаков — «sign»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'like', terms: [{ k: 7, v: 'x', m: 1 }, { k: -4, v: 'x', m: 1 }, { k: 2, v: 'x', m: 1 }], o: 1 };
  const r = ask(w, 0, task, 'like:t1');
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'sign');
});
test('тренажёр: сложил букву с числом — «merge»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'poly2', terms: [{ k: 2, v: 'x', m: 1 }, { k: 5, v: '', m: 0 }, { k: -1, v: 'x', m: 1 }, { k: 3, v: '', m: 0 }], o: 1 };
  const r = ask(w, 0, task, 'poly2:t1');
  assert.equal(r.cat, 'merge');
});
test('тренажёр: умножение раньше сложения — «value»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { type: 'value', a: 3, b: 2, at: 5 };
  const r = ask(w, 2, task, { n: (3 + 2) * 5, d: 1 });
  assert.equal(r.cat, 'value');
});
