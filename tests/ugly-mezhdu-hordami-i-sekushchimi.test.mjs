// Ответы и геометрия проверяются независимо от функций решения материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';
const SLUG = 'ugly-mezhdu-hordami-i-sekushchimi';
const open = (t, query = '', options = {}) => { const m = loadMaterial(SLUG, { query, ...options }); t.after(m.close); return m; };
const plain = x => JSON.parse(JSON.stringify(x));
function solve(t) {
  if (t.type === 'arcs') return t.adj ? 'bcda' : 'abcd';
  const angle = t.mode === 'inside' ? (t.a + t.b) / 2 : (t.a - t.b) / 2;
  const n = { inside: angle, outside: angle, insideArc: 2 * angle - t.a,
    outsideArc: t.form === 'near' ? t.a - 2 * angle : 2 * angle + t.b,
    adjacent: 180 - angle, threeArcs: (360 - t.gap - (360 - t.a - t.b - t.gap)) / 2 }[t.type];
  assert.ok(Number.isFinite(n), `есть решение для ${t.type}`);
  return { n, d: 1 };
}
function points(root) {
  return Object.fromEntries([...root.querySelectorAll('[data-point]')].map(c => [c.dataset.point, { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }]));
}
function angle(P, A, B) {
  const u = [A.x - P.x, A.y - P.y], v = [B.x - P.x, B.y - P.y];
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / Math.hypot(...u) / Math.hypot(...v)))) * 180 / Math.PI;
}
function checkFigure(root, task) {
  const p = points(root), circle = root.querySelector('.hs-circle');
  const O = { x: +circle.getAttribute('cx'), y: +circle.getAttribute('cy') }, r = +circle.getAttribute('r');
  for (const k of ['A', 'B', 'C', 'D']) assert.ok(Math.abs(Math.hypot(p[k].x - O.x, p[k].y - O.y) - r) < .2, `${k} на окружности`);
  const direction = k => Math.atan2(O.y - p[k].y, p[k].x - O.x) * 180 / Math.PI;
  const sweep = (a, b) => (direction(b) - direction(a) + 360) % 360;
  const arc1 = task.mode === 'inside' ? sweep('A', 'B') : sweep('D', 'C');
  const arc2 = task.mode === 'inside' ? sweep('C', 'D') : sweep('A', 'B');
  // GEO округляет координаты SVG до 0,1: у каждого радиус-вектора ошибка до √2 · 0,1.
  // Допуск вычисляем из радиуса чертежа, а не из ответа или наблюдаемого расхождения.
  const arcTolerance = 2 * Math.asin(Math.SQRT2 * .1 / (r - Math.SQRT2 * .1)) * 180 / Math.PI + .001;
  assert.ok(Math.abs(arc1 - task.a) < arcTolerance && Math.abs(arc2 - task.b) < arcTolerance, 'каждая подписанная дуга соответствует реальной геометрии');
  const d = Math.hypot(p.P.x - O.x, p.P.y - O.y);
  assert.ok(task.mode === 'inside' ? d < r : d > r, 'положение вершины');
  const expected = task.mode === 'inside' ? (task.a + task.b) / 2 : (task.a - task.b) / 2;
  assert.ok(Math.abs(angle(p.P, p.A, p.B) - expected) < .25, 'измеренный угол APB');
  assert.ok(Math.abs(angle(p.P, p.B, p.C) + expected - 180) < .25 || task.mode === 'outside', 'смежный угол');
  const collinear = (A, B, C) => Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / Math.hypot(C.x - B.x, C.y - B.y);
  assert.ok(collinear(p.P, p.A, p.C) < .25 && collinear(p.P, p.B, p.D) < .25, 'P — пересечение нужных прямых');
  if (task.mode === 'outside') for (const [near, far] of [['A', 'C'], ['B', 'D']]) {
    assert.ok(Math.hypot(p[near].x - p.P.x, p[near].y - p.P.y) < Math.hypot(p[far].x - p.P.x, p[far].y - p.P.y), 'порядок точек на секущей');
  }
  assert.doesNotMatch(root.textContent, /null|NaN|undefined/);
}
test('хорды и секущие: независимые ответы, чертежи и ловушки каждого типа', t => {
  const { window: w, errors } = open(t), A = w.APP;
  for (const type of Object.keys(A.TYPES)) {
    const rnd = A.mulberry32(type.length * 931 + 17);
    for (let i = 0; i < 180; i++) {
      const task = A.generate(type, rnd), T = A.TYPES[type], value = solve(task);
      assert.ok(T.same(task, value), JSON.stringify(task));
      const box = w.document.createElement('div'); box.innerHTML = T.ask(task);
      checkFigure(box, task);
      if (type !== 'arcs') { assert.equal(T.key(task), String(value.n)); assert.ok(value.n > 0 && value.n < 360); }
      for (const trap of T.traps(task)) {
        const x = type === 'arcs' ? trap.key : A.parseQ(trap.key);
        assert.ok(!T.same(task, x), 'ловушка отличается от ответа');
        assert.notEqual(T.wrong(task, x).cat, 'calc', 'типичная ошибка распознаётся');
      }
    }
  }
  assert.deepEqual(errors, []);
});
test('хорды и секущие: самостоятельная — 30 воспроизводимых вариантов, независимый ключ, 10 баллов', t => {
  const { window: w } = open(t, '?mode=print'), A = w.APP, seen = new Set();
  assert.equal(w.document.getElementById('pKind').value, 'test');
  assert.deepEqual([...w.document.querySelectorAll('#start [data-go="print"]')].map(b => b.dataset.kind), ['test']);
  for (let i = 0; i < 30; i++) {
    const v = A.printVariant(1000 + i * 293, 'test');
    assert.equal(JSON.stringify(v), JSON.stringify(A.printVariant(v.num, 'test')));
    seen.add(JSON.stringify(v.tasks)); assert.equal(v.tasks.length, 6);
    assert.equal(v.points.reduce((s, n) => s + n, 0), 10);
    v.tasks.forEach((task, j) => assert.equal(v.answers[j], String(solve(task).n)));
  }
  assert.equal(seen.size, 30);
  A.print.nums = [4817, 1234]; A.print.draw();
  assert.equal(w.document.querySelectorAll('.test-work table.ans').length, 2);
  const key = w.document.querySelector('.page.key').textContent;
  assert.match(key, /«5» — от 9 баллов/); assert.match(key, /«4» — от 7/); assert.match(key, /«3» — от 5/);
});
test('хорды и секущие: тренажёр принимает независимые ответы и объясняет неверные', t => {
  const { window: w, errors } = open(t, '?mode=home'), A = w.APP;
  for (let level = 0; level < 3; level++) for (let run = 0; run < 4; run++) {
    A.home.start({ level, seed: 170 + level * 73 + run });
    for (let i = 0; i < A.CONFIG.home.round; i++) {
      const task = A.home.state.task;
      assert.equal(A.home.check(solve(task)).ok, true); A.home.next();
    }
    assert.equal(A.home.state.finished, true);
  }
  for (const type of Object.keys(A.TYPES)) {
    const task = A.generate(type, A.mulberry32(41)), T = A.TYPES[type];
    const wrong = type === 'arcs' ? 'acbd' : A.Q(999);
    assert.ok(T.wrong(task, wrong).msg.length > 40);
    assert.ok(T.hints(task).length >= 2);
  }
  assert.deepEqual(errors, []);
});
test('хорды и секущие: движение, границы, сброс и независимое измерение живой модели', t => {
  const { window: w, errors } = open(t, '?mode=board'), B = w.APP.board;
  const check = () => checkFigure(w.document.getElementById('bStage'), B.model);
  for (const step of [0, 2, 4, 5, 6, 7, 9, 11]) {
    B.go(step, 1); check();
    for (const h of B.handles) {
      B.key(h.id, 1, 0); check(); B.key(h.id, -1, 0); check();
      for (const pos of [{ x: 8, y: 8 }, { x: 972, y: 392 }, { x: 400, y: 200 }]) { B.drag(h.id, pos); check(); }
      B.reset(); check();
    }
    const before = JSON.stringify(B.model); B.reset(); assert.equal(JSON.stringify(B.model), before);
  }
  B.go(5, 1); B.set('adj', true); check(); assert.equal(B.model.adj, true);
  B.go(10, 1); B.set('mode', 'outside'); check(); B.set('mode', 'inside'); check();
  for (let n = 0; n < 8; n++) {
    B.numbers(true);
    for (let i = 0; i < 12; i++) { B.go(i, 1); check(); }
  }
  assert.deepEqual(errors, []);
});
test('хорды и секущие: опыты сохраняют сумму или разность, reduced-motion завершает опыт', t => {
  const { window: w } = open(t, '?mode=board', { beforeParse(w) { w.matchMedia = q => ({ matches: q.includes('reduced-motion'), addEventListener() {}, removeEventListener() {} }); } });
  const B = w.APP.board;
  for (const step of [3, 8]) {
    B.go(step, 0); const before = plain(B.model), invariant = m => step === 3 ? m.a + m.b : m.a - m.b;
    B.next(); assert.equal(B.animating, false); assert.equal(invariant(B.model), invariant(before));
    for (const v of [B.controls[0].min, B.controls[0].max]) { B.set('a', v); assert.equal(invariant(B.model), invariant(before)); checkFigure(w.document.getElementById('bStage'), B.model); }
    B.reset(); const result = plain(B.model); B.again(); assert.deepEqual(plain(B.model), result);
  }
});
