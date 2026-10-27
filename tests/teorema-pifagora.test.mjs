import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';
const SLUG = 'teorema-pifagora';
const plain = x => JSON.parse(JSON.stringify(x));
const open = (t, query = '') => { const m = loadMaterial(SLUG, { query }); t.after(m.close); return m; };
const integerRoot = n => { let i = 0; while (i * i < n) i++; return i * i === n ? i : null; };
function expected(t) {
  if (t.type === 'apply') return { value: { right: 'yes', oblique: 'no', unknown: 'unknown' }[t.form], key: { right: 'да', oblique: 'нет', unknown: 'недостаточно' }[t.form] };
  if (t.type === 'mistake') { const value = { sum: '1', noRoot: '3', legAdd: '1', calc: '2' }[t.form]; return { value, key: value }; }
  if (t.type === 'radical') { const n = t.form === 'hyp' ? t.x ** 2 + t.y ** 2 : t.y ** 2 - t.x ** 2; return { value: { m: n, s: 1 }, key: '√' + n }; }
  const n = ['leg', 'ladder'].includes(t.type) ? t.c ** 2 - t.a ** 2 : t.a ** 2 + t.b ** 2;
  const r = integerRoot(n); assert.notEqual(r, null, 'целый корень независимо найден перебором');
  const value = t.type === 'path' ? t.a + t.b - r : r;
  return { value: { n: value, d: 1 }, key: String(value) };
}
const area = ps => Math.abs(ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
function intersect(subject, clip) {
  let output = subject;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], edge = sub(b, a), input = output; output = [];
    if (!input.length) break;
    const inside = p => cross(edge, sub(p, a)) >= -1e-9;
    const meet = (p, q) => { const d = sub(q, p), k = cross(sub(a, p), edge) / cross(d, edge); return { x: p.x + k * d.x, y: p.y + k * d.y }; };
    let p = input[input.length - 1];
    for (const q of input) { if (inside(q)) { if (!inside(p)) output.push(meet(p, q)); output.push(q); } else if (inside(p)) output.push(meet(p, q)); p = q; }
  }
  return output;
}
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

test('Пифагор: две раскладки без зазоров и наложений, размеры деталей сохранены', t => {
  const { window: w } = open(t);
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) {
    const m = w.paperModel(a, b), signature = [a * a, b * b, a * a + b * b].sort((x, y) => x - y);
    for (const tiles of [m.trianglesC, m.trianglesAB]) for (const p of tiles) {
      assert.deepEqual([d2(p[0], p[1]), d2(p[1], p[2]), d2(p[2], p[0])].sort((x, y) => x - y), signature);
      assert.equal(area(p), a * b / 2);
    }
    assert.equal(area(m.holeC), a * a + b * b); assert.equal(area(m.holeA), a * a); assert.equal(area(m.holeB), b * b);
    for (const polygons of [[...m.trianglesC, m.holeC], [...m.trianglesAB, m.holeA, m.holeB]]) {
      assert.equal(polygons.reduce((s, p) => s + area(p), 0), (a + b) ** 2);
      for (const ps of polygons) for (const p of ps) assert.ok(p.x >= 0 && p.y >= 0 && p.x <= m.L && p.y <= m.L, 'детали остаются в рамке');
      for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) assert.ok(area(intersect(polygons[i], polygons[j])) < 1e-7, 'площади деталей не перекрываются');
    }
    const c = m.holeC; assert.equal(d2(c[0], c[1]), d2(c[1], c[2]));
    assert.equal((c[1].x - c[0].x) * (c[2].x - c[1].x) + (c[1].y - c[0].y) * (c[2].y - c[1].y), 0, 'угол центрального квадрата прямой');
  }
});
test('Пифагор: площади квадратов совпадают с квадратами реальных сторон', t => {
  const { window: w } = open(t);
  for (const angle of [60, 90, 120]) for (const [a, b] of [[3, 4], [2, 12], [12, 2], [7, 9]]) {
    const m = w.squareModel(a, b, angle);
    assert.ok(Math.abs(d2(m.A, m.B) - m.c2) < 1e-8);
    assert.ok(Math.abs(area(m.squares[1]) - d2(m.A, m.B)) < 1e-8);
    assert.equal(angle === 90, Math.abs(m.c2 - a * a - b * b) < 1e-8);
  }
});
test('Пифагор: независимые ответы всех типов, допустимые данные и объяснения', t => {
  const { window: w, errors } = open(t);
  for (const [type, T] of Object.entries(w.APP.TYPES)) {
    const rnd = w.APP.mulberry32(type.length * 1831);
    for (let i = 0; i < 350; i++) {
      const task = w.APP.generate(type, rnd), e = expected(task);
      assert.ok(T.same(task, e.value), `${type}: ${JSON.stringify(task)}`); assert.equal(T.key(task), e.key);
      if (task.c != null) { assert.equal(task.a ** 2 + task.b ** 2, task.c ** 2); assert.ok(task.c > Math.max(task.a, task.b)); }
      assert.doesNotMatch([T.ask(task), T.ok(task), ...T.hints(task), ...T.traps(task).map(x => x.html)].join(' '), /NaN|undefined|Infinity/);
    }
  }
  assert.deepEqual(errors, []);
});
test('Пифагор: ключи 30 вариантов раздатки и бланка независимо решаются', t => {
  const { window: w } = open(t, '?mode=print');
  for (let i = 0; i < 30; i++) {
    const n = 1000 + 293 * i, v = w.APP.makeVariant(n), oge = w.APP.makeVariantOGE(n);
    assert.deepEqual([...v.answers], [...v.tasks].map(task => expected(task).key));
    assert.deepEqual([...oge.answers], [...oge.tasks].map(x => expected(x.t).key));
    assert.equal(v.tasks.filter(x => w.APP.TYPES[x.type].input === 'choice').length, 1);
  }
});
test('Пифагор: тренажёр принимает независимые ответы, включая корни', t => {
  const { window: w, errors } = open(t, '?mode=home'); const h = w.APP.home;
  for (let level = 0; level < 4; level++) { h.start({ level, seed: 57 + level }); for (let i = 0; i < 10; i++) { assert.ok(h.check(expected(h.state.task).value).ok); h.next(); } assert.ok(h.state.finished); }
  const T = w.APP.TYPES.radical;
  assert.ok(T.same({ n: 12 }, w.APP.parseVal('2√3'))); assert.ok(T.same({ n: 12 }, w.APP.parseVal('√12')));
  assert.equal(T.same({ n: 12 }, w.APP.parseVal('−2√3')), false); assert.equal(T.same({ n: 12 }, w.APP.parseVal('12')), false);
  assert.deepEqual(errors, []);
});
test('Пифагор: типичные ошибки распознаются', t => {
  const { window: w } = open(t); const T = w.APP.TYPES, ex = { a: 3, b: 4, c: 5 };
  assert.equal(T.hyp.wrong(ex, { n: 7, d: 1 }).cat, 'sum');
  assert.equal(T.hyp.wrong(ex, { n: 25, d: 1 }).cat, 'root');
  assert.equal(T.leg.wrong(ex, { n: 34, d: 1 }).cat, 'legSum');
  assert.equal(T.hyp.wrong(ex, { n: -5, d: 1 }).cat, 'negative');
  assert.equal(T.path.wrong(ex, { n: 5, d: 1 }).cat, 'question');
  assert.match(T.apply.wrong({ form: 'unknown', a: 3, b: 4 }, 'yes').msg, /недостаточно/);
});
test('Пифагор: реальные элементы управления меняют модель и сохраняют шаг', t => {
  const { window: w, errors } = open(t, '?mode=board'); const A = w.APP;
  assert.equal(A.board.steps.length, 12); A.board.go(4, 0);
  w.document.querySelector('[data-py-act="arrange"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(A.board.phase, 1); assert.equal(A.board.e.proofSplit, true);
  w.document.querySelector('[data-py-act="arrange"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(A.board.e.proofSplit, false);
  w.document.getElementById('pyControlsBtn').click(); const input = w.document.getElementById('pyA'); input.value = '7'; input.dispatchEvent(new w.Event('change'));
  assert.equal(A.board.e.a, 7); assert.equal(A.board.i, 4);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(w.document.getElementById('pyControls').hidden, true); assert.equal(A.screen, 'board');
  A.board.go(8, 1); w.document.querySelector('[data-py-act="angle"][data-value="60"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(A.board.e.angle, 60); assert.match(w.document.getElementById('bA').textContent, /Равенства нет/);
  w.document.getElementById('pyLarge').checked = true; w.document.getElementById('pyLarge').dispatchEvent(new w.Event('change'));
  assert.equal(w.document.querySelectorAll('#bStage .paper-book').length, 0);
  assert.deepEqual(errors, []);
});
