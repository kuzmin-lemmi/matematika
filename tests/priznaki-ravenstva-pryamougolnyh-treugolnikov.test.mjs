// Автотест темы «Признаки равенства прямоугольных треугольников» на сайте. Общие проверки (режимы, 30 вариантов,
// доска, тренажёр) делает тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: ответ считает сам тест,
// а не код материала, иначе тест повторит ошибку материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'priznaki-ravenstva-pryamougolnyh-treugolnikov';
const WORD = { legs: 'катеты', legang: 'катет и угол', hypleg: 'гипотенуза и катет' };
const OPPOSITE = { A: 'BC', B: 'AC', C: 'AB' };
const n = x => ({ value: { n: x, d: 1 }, key: String(x) });
const plain = x => JSON.parse(JSON.stringify(x));

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе раздатки
function expected(t) {
  switch (t.type) {
    case 'which': return { value: t.kind, key: WORD[t.kind] };
    case 'trap': return { value: 'none', key: 'не доказано' };
    case 'hyp': return { value: OPPOSITE[t.v], key: OPPOSITE[t.v] };
    case 'corr': return n({ AB: t.ab, BC: t.bc, AC: t.ac }[t.ask]);
    case 'perim': return n(t.ac + t.bc + t.ab);
    case 'height': return n(t.form === 'mid' ? t.m : t.d);
  }
  throw new Error('Нет независимого решения для типа ' + t.type);
}

function open(t, query = '') {
  const m = loadMaterial(SLUG, { query });
  t.after(m.close);
  return m;
}

test('прямоугольные: независимое решение совпадает с ответом материала', t => {
  const { APP } = open(t).window;
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 977);
    for (let i = 0; i < 200; i++) {
      const task = APP.generate(type, rnd), e = expected(task);
      assert.ok(APP.TYPES[type].same(task, e.value), `${type}: ${JSON.stringify(task)}`);
      assert.equal(APP.TYPES[type].key(task), e.key, `${type}: запись ответа`);
    }
  }
});

test('прямоугольные: числа на чертежах — настоящие прямоугольные треугольники', t => {
  const { APP } = open(t).window;
  for (const type of ['corr', 'perim']) {
    const rnd = APP.mulberry32(41);
    for (let i = 0; i < 200; i++) {
      const s = APP.generate(type, rnd);
      assert.equal(s.ac * s.ac + s.bc * s.bc, s.ab * s.ab, `${type}: ${s.ac}, ${s.bc}, ${s.ab} — катеты и гипотенуза`);
    }
  }
});

test('прямоугольные: раздатка — ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const v = APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => expected(x).key));
    assert.equal(new Set(v.answers).size, v.answers.length, 'ответы варианта различны');
  }
});

test('прямоугольные: тренажёр принимает независимый ответ в каждом разделе', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let level = 0; level < w.APP.SECTIONS.length; level++) {
    h.start({ level, seed: 7 + level });
    for (let k = 0; k < 10; k++) {
      const r = h.check(expected(h.state.task).value);
      assert.ok(r.ok, `раздел ${level + 1}: ${r.msg}`);
      h.next();
    }
  }
  assert.deepEqual(errors, []);
});

test('прямоугольные: типичные ошибки называются', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  const tryAnswer = (task, value) => {
    h.start({ level: 0, seed: 1 });
    Object.assign(h.state, { task: { ...task }, wait: false, taskDone: false });
    return h.check(value);
  };
  // «равны острые углы — значит, треугольники равны»
  assert.equal(tryAnswer({ type: 'trap', kind: 'ang' }, 'legang').cat, 'none');
  // катет вместо гипотенузы
  assert.equal(tryAnswer({ type: 'hyp', v: 'C' }, 'AC').cat, 'hyp');
  // взяли не соответственную сторону
  assert.equal(tryAnswer({ type: 'corr', kind: 'legs', ac: 6, bc: 8, ab: 10, ask: 'AB' }, { n: 8, d: 1 }).cat, 'pair');
  // в периметре забыли третью сторону, которую даёт равенство
  assert.equal(tryAnswer({ type: 'perim', ac: 6, bc: 8, ab: 10 }, { n: 16, d: 1 }).cat, 'per');
  // AD = AC, а не половина
  assert.equal(tryAnswer({ type: 'height', form: 'iso', d: 5, m: 9, h: 7 }, { n: 10, d: 1 }).cat, 'pair');
});

// Живая доска: геометрия проверяется независимо — по координатам ручек и модели
const U = 32, C = { x: 150, y: 318 };
// сколько точек луча из C под углом γ к CA лежит на окружности (A, c): квадратное уравнение по t > 0
function rayPoints(a, c, gamma) {
  const g = gamma * Math.PI / 180, A = a * U, R = c * U;
  // |C + t·(cos γ, sin γ) − A|² = R², A = (A, 0): t² − 2At·cos γ + A² − R² = 0
  const b = -2 * A * Math.cos(g), q = A * A - R * R, disc = b * b - 4 * q;
  if (disc < -1e-6) return 0;
  const s = Math.sqrt(Math.max(0, disc));
  return [(-b - s) / 2, (-b + s) / 2].filter((t, i, arr) => t > 1 && (i === 0 || Math.abs(t - arr[0]) > 1e-6)).length;
}

test('прямоугольные: доска — гипотенуза и катет дают одну точку, острый угол — может дать две', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  const hypStep = B.steps.findIndex(s => s.live?.handles && /Циркулем/.test(String(typeof s.q === 'function' ? s.q(B.model) : s.q)));
  const ctrStep = B.steps.findIndex(s => /угол C не прямой/.test(String(s.q)));
  assert.ok(hypStep >= 0 && ctrStep >= 0, 'есть шаги с циркулем и с контрпримером');
  // гипотенуза и катет: при c > a вершина B лежит на перпендикуляре к CA, |AB| = c
  B.go(hypStep, 1);
  for (const [a, c] of [[7, 10], [4, 9.5], [9, 9.5], [5, 6]]) {
    B.set('a', a); B.set('c', c);
    const m = plain(B.model);
    assert.equal(m.a, a); assert.equal(m.c, c);
    const text = w.document.getElementById('bStage').textContent;
    assert.match(text, c > a ? /одна точка B/ : /треугольника нет/);
  }
  B.set('a', 8); B.set('c', 7);
  assert.match(w.document.getElementById('bStage').textContent, /треугольника нет/, 'гипотенуза короче катета — треугольника нет');
  // контрпример: число треугольников совпадает с независимым подсчётом
  B.go(ctrStep, 0);
  for (const gamma of [30, 40, 50, 60, 75, 90]) for (const c of [5, 6, 7, 9, 12]) {
    B.set('gamma', gamma); B.set('c', c);
    const k = rayPoints(B.model.a, c, gamma), text = w.document.getElementById('bStage').textContent;
    assert.match(text, k === 2 ? /два разных/ : k === 1 ? /одна точка/ : /точек нет/, `∠C = ${gamma}°, AB = ${c}: точек ${k}`);
  }
  // при прямом угле двух треугольников не бывает
  B.set('gamma', 90);
  for (const c of [3, 5, 8, 9, 11, 13]) { B.set('c', c); assert.doesNotMatch(w.document.getElementById('bStage').textContent, /два разных/); }
  assert.deepEqual(errors, []);
});

test('прямоугольные: доска — катет и угол: вершина B на перпендикуляре, угол A совпадает с измеренным', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  const step = B.steps.findIndex(s => s.live?.handles && /Где окажется вершина B\? Можно ли/.test(String(typeof s.q === 'function' ? s.q(B.model) : s.q)));
  assert.ok(step >= 0);
  B.go(step, 0);
  for (const a of [4, 6, 9]) for (const alpha of [20, 35, 45, 60]) {
    B.set('a', a); B.set('alpha', alpha);
    const m = plain(B.model), h = B.handles.find(x => x.id === 'b');
    assert.ok(Math.abs(h.at.x - C.x) < 1e-6, 'B на перпендикуляре к CA в точке C');
    assert.ok(h.at.y >= 0, 'B на чертеже');
    const measured = Math.atan2(C.y - h.at.y, m.a * U) * 180 / Math.PI;
    assert.ok(Math.abs(measured - m.alpha) < 1e-6, `угол A: ${measured} и ${m.alpha}`);
  }
  assert.deepEqual(errors, []);
});
