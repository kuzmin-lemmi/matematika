// Автотест темы «Вписанные и центральные углы» на сайте. Общие проверки (режимы, 30 вариантов, доска, тренажёр) делает
// тест-контракт конструктора; здесь — НЕЗАВИСИМОЕ решение: ответ считает сам тест по условию задачи,
// а чертёж проверяется измерением: угол между отрезками на SVG должен совпасть с ответом.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'vpisannye-i-centralnye-ugly';
const KIND = { cen: 'центральный', ins: 'вписанный', no: 'ни тот, ни другой' };

// Ответ по данным условия: value — что ввести в тренажёр, key — запись в ключе раздатки
function solve(t) {
  const x = t.x;
  const n = {
    ins: () => x,                                   // вписанный = ½ центрального 2x
    cen: () => 2 * x,                               // центральный = 2 · вписанный
    arc: () => t.form === 'toIns' ? t.arc / 2 : t.arc,
    same: () => x,                                  // на одну дугу — равны
    opp: () => 180 - x,                             // по разные стороны хорды — в сумме 180°
    diam: () => 180 - 90 - x,                       // угол C = 90°, сумма углов треугольника
    iso: () => (180 - 2 * x) / 2,                   // AOB = 2x, треугольник AOB равнобедренный
    diam2: () => 180 - 2 * x,                       // AOD смежный с AOB = 2x
    tan: () => x,                                   // касательная и хорда — половина дуги 2x
  }[t.type];
  if (t.type === 'kind') return { value: t.form, key: KIND[t.form] };
  if (!n) throw new Error('Нет независимого решения для типа ' + t.type);
  return { value: { n: n(), d: 1 }, key: String(n()) };
}
// какой угол на чертеже — ответ: [вершина, точка, точка, множитель]
const MEASURE = {
  ins: ['C', 'A', 'B', 1], cen: ['O', 'A', 'B', 1], same: ['D', 'A', 'B', 1], opp: ['D', 'A', 'B', 1],
  diam: ['A', 'B', 'C', 1], iso: ['A', 'O', 'B', 1], diam2: ['O', 'A', 'D', 1], tan: ['A', 'K', 'B', 1],
};

// Точки чертежа: подпись (text.va-v) → ближайшая точка (circle.va-p)
function figurePoints(w, html) {
  const box = w.document.createElement('div');
  box.innerHTML = html;
  const dots = [...box.querySelectorAll('circle.va-p')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
  const pts = {};
  for (const tx of box.querySelectorAll('text.va-v')) {
    const p = { x: +tx.getAttribute('x'), y: +tx.getAttribute('y') };
    pts[tx.textContent.trim()] = dots.reduce((a, b) => Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b);
  }
  return pts;
}
function angle(V, A, B) {
  const a = Math.atan2(A.y - V.y, A.x - V.x), b = Math.atan2(B.y - V.y, B.x - V.x);
  let d = Math.abs(a - b) * 180 / Math.PI;
  return d > 180 ? 360 - d : d;
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
    for (let i = 0; i < 300; i++) {
      const task = APP.generate(type, rnd), e = solve(task);
      assert.ok(APP.TYPES[type].same(task, e.value), `${type}: ${JSON.stringify(task)}`);
      assert.equal(APP.TYPES[type].key(task), e.key, `${type}: запись ответа`);
      if (e.value.n != null) assert.ok(Number.isInteger(e.value.n) && e.value.n > 0 && e.value.n < (type === "arc" ? 360 : 180), `${type}: ответ — целое число градусов`);
      for (const trap of APP.TYPES[type].traps(task)) assert.notEqual(trap.key, e.key, `${type}: ловушка не совпадает с ответом`);
    }
  }
});

test('чертежи: измеренный угол совпадает с ответом, вид угла виден по чертежу', t => {
  const { window: w } = open(t);
  const { APP } = w;
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 31 + 5);
    for (let i = 0; i < 60; i++) {
      const task = APP.generate(type, rnd), T = APP.TYPES[type], P = figurePoints(w, T.sheet(task));
      if (type === 'kind') {
        const V = P[{ cen: 'O', ins: 'C', no: 'K' }[task.form]], r = Math.hypot(P.A.x - P.O.x, P.A.y - P.O.y), d = Math.hypot(V.x - P.O.x, V.y - P.O.y);
        const seen = d < 1 ? 'cen' : Math.abs(d - r) < 1 ? 'ins' : 'no';
        assert.equal(seen, task.form, 'вид угла по чертежу');
        continue;
      }
      const ans = solve(task).value.n;
      if (type === 'arc') {   // вписанный угол ACB на чертеже — половина отмеченной дуги
        const ins = angle(P.C, P.A, P.B);
        assert.ok(Math.abs(ins - task.arc / 2) < .6, `arc: ∠ACB = ${ins}, дуга ${task.arc}`);
        continue;
      }
      const [v, a, b, k] = MEASURE[type], got = angle(P[v], P[a], P[b]) * k;
      assert.ok(Math.abs(got - ans) < .6, `${type}: на чертеже ∠${a}${v}${b} = ${got.toFixed(1)}, ответ ${ans} — ${JSON.stringify(task)}`);
    }
  }
});

test('раздатка и бланк: ключ 30 вариантов совпадает с независимым решением', t => {
  const { APP } = open(t, '?mode=print').window;
  for (let i = 0; i < 30; i++) {
    const n = 1000 + i * 293, v = APP.makeVariant(n), oge = APP.makeVariantOGE(n);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => solve(x).key));
    assert.deepEqual([...oge.answers], [...oge.tasks].map(x => solve(x.t).key));
    assert.equal(new Set(v.answers).size, v.answers.length, 'ответы в варианте различны');
  }
});

test('тренажёр: независимый ответ принимается в каждом разделе', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let level = 0; level < w.APP.SECTIONS.length; level++) {
    h.start({ level, seed: 7 + level });
    for (let k = 0; k < 10; k++) {
      const r = h.check(solve(h.state.task).value);
      assert.ok(r.ok, `раздел ${level + 1}: ${r.msg}`);
      h.next();
    }
  }
  assert.deepEqual(errors, []);
});

test('тренажёр: типичные ошибки называются', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  const ask = (task, n) => {
    h.start({ level: 0, seed: 1 });
    Object.assign(h.state, { task, wait: false, taskDone: false });
    return h.check({ n, d: 1 });
  };
  // вписанный приравняли к центральному
  let r = ask({ type: 'ins', x: 40, rot: 0, j: 20 }, 80);
  assert.equal(r.cat, 'equal'); assert.match(r.msg, /приравнял/);
  // угол на диаметр не учли
  r = ask({ type: 'diam', x: 25, rot: 0, j: 60 }, 155);
  assert.equal(r.cat, 'diam'); assert.match(r.msg, /90°/);
  // в треугольнике AOB нашли центральный угол вместо угла при основании
  r = ask({ type: 'iso', x: 35, rot: 0, j: 20 }, 70);
  assert.equal(r.cat, 'iso');
  // вершины по разные стороны хорды — углы не равны
  r = ask({ type: 'opp', x: 50, rot: 0, j: 0, k: 0 }, 50);
  assert.equal(r.cat, 'arc');
  // касательная: нашли угол OAB
  r = ask({ type: 'tan', x: 40, rot: 0 }, 50);
  assert.equal(r.cat, 'tan'); assert.match(r.msg, /OAB/);
});

test('живая доска: измеренный вписанный угол — половина дуги при любом положении вершины', t => {
  const { window: w } = open(t, '?mode=board');
  const B = w.APP.board;
  B.go(3, 0);   // шаг «вписанный и центральный»
  const read = () => {
    const html = w.document.getElementById('bStage').innerHTML;
    const arc = +html.match(/дуга AB = (\d+)°/)[1], ins = +html.match(/∠ACB = ([\d,]+)°/)[1].replace(',', '.'), cen = +html.match(/∠AOB = ([\d,]+)°/)[1].replace(',', '.');
    return { arc, ins, cen };
  };
  for (const [x, y] of [[300, 40], [160, 120], [420, 150], [200, 330], [390, 300]]) {
    B.drag('c', { x, y });
    const v = read();
    assert.ok(Math.abs(v.ins - v.arc / 2) < .06, `∠ACB = ${v.ins}, дуга ${v.arc}`);
    assert.ok(Math.abs(v.cen - v.arc) < .06, `∠AOB = ${v.cen}, дуга ${v.arc}`);
  }
  for (const [x, y] of [[150, 300], [420, 320], [285, 340]]) {
    B.drag('a', { x, y });
    const v = read();
    if (v.arc <= 180) assert.ok(Math.abs(v.ins - v.cen / 2) < .06, `вписанный ${v.ins} = половина центрального ${v.cen}`);
  }
});
