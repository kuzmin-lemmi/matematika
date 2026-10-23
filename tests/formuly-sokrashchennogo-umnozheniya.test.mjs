// Автотест темы «Формулы сокращённого умножения» на сайте. Общие проверки (режимы, 30 вариантов, доска,
// тренажёр) делает тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: многочлены перемножаются
// «в лоб» по степеням, а не по формулам, чтобы тест не повторил ошибку материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'formuly-sokrashchennogo-umnozheniya';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));

// многочлен — { степень: коэффициент }; умножаем почленно
const P = (...terms) => Object.fromEntries(terms);
const pmul = (u, v) => {
  const r = {};
  for (const [p, a] of Object.entries(u)) for (const [q, b] of Object.entries(v)) r[+p + +q] = (r[+p + +q] || 0) + a * b;
  return r;
};
const ppow = (u, n) => Array.from({ length: n - 1 }).reduce(acc => pmul(acc, u), u);
const neg = u => Object.fromEntries(Object.entries(u).map(([p, a]) => [p, -a]));
const padd = (u, v) => {
  const r = { ...u };
  for (const [p, a] of Object.entries(v)) r[p] = (r[p] || 0) + a;
  return r;
};
const mon = x => P([x.m, x.k]);
const coefAt = (u, m) => u[m] || 0;
const key = xs => xs.map(x => `${x.k}x${x.m}`).join(',');

// Ответ раскрытия скобок как список {k, m}: порядок — A², средний член, B² (как на листе)
function expandExpected(t) {
  const A = mon(t.A), B = mon(t.B);
  const prod = t.form === 'sqsum' ? ppow(padd(A, B), 2)
    : t.form === 'sqdif' ? ppow(padd(A, neg(B)), 2)
    : pmul(padd(A, neg(B)), padd(A, B));
  const powers = t.form === 'diff' ? [2 * t.A.m, 2 * t.B.m] : [2 * t.A.m, t.A.m + t.B.m, 2 * t.B.m];
  assert.equal(powers.length, Object.values(prod).filter(c => c !== 0).length, 'подобные слагаемые не сливаются');
  return powers.map(m => ({ k: coefAt(prod, m), m }));
}
// Пропущенный член: берём полный многочлен и вычитаем известные слагаемые
function fillExpected(t) {
  const A = mon(t.A), B = mon(t.B), B1 = t.form === 'sqdif' || (t.form === 'cube' && t.sign < 0) ? neg(B) : B;
  const n = t.form === 'cube' ? 3 : 2;
  const full = ppow(padd(A, B1), n);
  const m = t.form === 'cube' ? 2 * t.A.m + t.B.m : t.A.m + t.B.m;
  return { k: Math.abs(coefAt(full, m)), m };
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function dec(n, d) {   // конечная десятичная дробь n/d с запятой
  for (let k = 0; k <= 6; k++) {
    if ((n * 10 ** k) % d) continue;
    const s = String(Math.abs(n * 10 ** k / d)).padStart(k + 1, '0');
    return (n < 0 ? MINUS : '') + (k ? s.slice(0, -k) + ',' + s.slice(-k) : s);
  }
  return null;
}

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'expand': { const v = expandExpected(t); return { value: v, key: key(v) }; }
    case 'fill': { const v = fillExpected(t); return { value: v, key: key([v]) }; }
    case 'smart': {
      const [x, y] = t.form === 'dec' ? [[t.k, 10], [t.j, 10]] : [[t.a + t.d, 1], [t.a - t.d, 1]];
      const n = x[0] * x[0] * y[1] * y[1] - y[0] * y[0] * x[1] * x[1], d = x[1] * x[1] * y[1] * y[1], g = gcd(n, d);
      return { value: { n: n / g, d: d / g }, key: dec(n, d) };
    }
    case 'value': {
      const n = t.r.n * t.r.n * t.s.d * t.s.d - t.s.n * t.s.n * t.r.d * t.r.d, d = t.r.d * t.r.d * t.s.d * t.s.d, g = gcd(n, d);
      return { value: { n: n / g, d: d / g }, key: dec(n, d) };
    }
    case 'fact': return { value: 'fact:ok', key: 'fact:ok' };
    case 'cube': return { value: 'cube:ok', key: 'cube:ok' };
  }
  throw new Error('Нет независимого решения для типа ' + t.type);
}
// Ответ бланка ОГЭ по параметрам задания t
function expectedOGE(x) {
  const [p, q] = x.t;
  switch (x.kind) {
    case 'dsq': return String(p * p - q * q);
    case 'sdec': return dec(p * p - q * q, 100);
    case 'sq': return String((p + q) ** 2 - q * q);
    case 'cross': return String((p + q) ** 2 - (p - q) ** 2);
    case 'lin': return String(q);
    case 'coef': return String(x.t[4]);
    case 'cube': return String(p ** 3 - 3 * p * p * q + 3 * p * q * q - q ** 3);
    case 'cancel': return String((q - p) ** 2 - q * (q - 2 * p));
  }
  throw new Error('Нет решения для ' + x.kind);
}

function open(t, query = '') {
  const m = loadMaterial(SLUG, { query });
  t.after(m.close);
  return m;
}

test('генератор: независимое решение совпадает с ответом материала', t => {
  const { APP } = open(t).window;
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 977);
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const task = plain(APP.generate(type, rnd)), e = expected(task), T = APP.TYPES[type];
      seen.add(JSON.stringify(task));
      assert.ok(T.same(task, e.value), `${type}: ${JSON.stringify(task)}`);
      assert.equal(T.key(task), e.key, `${type}: запись ответа`);
      assert.doesNotMatch(T.text(task), /undefined|NaN|\[object/, type);
      if (['expand', 'fill', 'fact', 'cube'].includes(type)) assert.notEqual(task.A.m, task.B.m, 'показатели разные');
      if (type === 'smart') assert.ok(e.value.n > 0);
    }
    assert.ok(seen.size >= 15, `${type}: задания разнообразны (${seen.size})`);
  }
});

test('раздатка: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.tasks.map(x => x.type)], ['expand', 'expand', 'expand', 'fill', 'fill', 'smart', 'smart', 'value', 'fact']);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => expected(plain(x)).key));
  }
});

test('бланк ОГЭ: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print&kind=oge').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariantOGE(1000 + i * 293);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => expectedOGE(plain(x))));
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

// Типичные ошибки называются по имени. Подставляем задание вручную: (3x + 2x²)² при m(A) ≠ m(B)
function ask(w, task, answer) {
  const h = w.APP.home;
  h.start({ level: 0, seed: 1 });
  Object.assign(h.state, { task: { type: 'expand', ...task }, wait: false, taskDone: false });
  return h.check(answer);
}
test('тренажёр: потерян средний член — «middle»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { form: 'sqsum', sign: 1, A: { k: 3, m: 1 }, B: { k: 2, m: 2 } };   // (3x + 2x²)² = 9x² + 12x³ + 4x⁴
  const r = ask(w, task, [{ k: 9, m: 2 }, { k: 4, m: 4 }]);
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'middle');
  assert.match(r.msg, /12/);
});
test('тренажёр: знак среднего члена в квадрате разности — «sign»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { form: 'sqdif', sign: -1, A: { k: 3, m: 1 }, B: { k: 2, m: 2 } };   // 9x² − 12x³ + 4x⁴
  const r = ask(w, task, [{ k: 9, m: 2 }, { k: 12, m: 3 }, { k: 4, m: 4 }]);
  assert.equal(r.cat, 'sign');
  assert.equal(ask(w, task, [{ k: 9, m: 2 }, { k: -12, m: 3 }, { k: 4, m: 4 }]).ok, true);
});
test('тренажёр: разность квадратов с тремя слагаемыми — «diff»', t => {
  const { window: w } = open(t, '?mode=home');
  const task = { form: 'diff', sign: 1, A: { k: 3, m: 1 }, B: { k: 2, m: 2 } };   // (3x − 2x²)(3x + 2x²) = 9x² − 4x⁴
  const r = ask(w, task, [{ k: 9, m: 2 }, { k: 12, m: 3 }, { k: 4, m: 4 }]);
  assert.equal(r.cat, 'diff');
});
test('тренажёр: поле ввода принимает знак «−» из списка', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home, doc = w.document;
  h.start({ level: 0, seed: 1 });
  Object.assign(h.state, { task: { type: 'expand', form: 'diff', sign: 1, A: { k: 3, m: 1 }, B: { k: 2, m: 2 } }, wait: false, taskDone: false });
  h.next = h.next;   // перерисовать задание
  w.eval('homeRender()');
  const set = (k, v) => { doc.querySelector(`#hStep [data-k="${k}"]`).value = v; };
  set('k0', '9'); set('m0', '2'); set('s1', MINUS); set('k1', '4'); set('m1', '4');
  assert.deepEqual(plain(h.collect()), [{ k: 9, m: 2 }, { k: -4, m: 4 }]);
  assert.equal(h.check(h.collect()).ok, true);
});
