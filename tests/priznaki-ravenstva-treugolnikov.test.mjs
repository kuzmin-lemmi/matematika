// Ответы считаются независимо от функций ans, enoughRight и таблицы PROOFS материала.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'priznaki-ravenstva-treugolnikov';
const plain = x => JSON.parse(JSON.stringify(x));
const sides = ['AB', 'AC', 'BC'];
const vertices = ['A', 'B', 'C'];
const words = ['не доказано', 'первый', 'второй', 'третий'];

// Перебираем все прямые применения формулировки указанного признака.
function missing(t) {
  const given = new Set([...t.sides, ...t.angs.map(v => '∠' + v)]);
  const requirements = t.p === 1 ? vertices.map(v => [...sides.filter(s => s.includes(v)), '∠' + v])
    : t.p === 2 ? sides.map(s => [s, ...[...s].map(v => '∠' + v)]) : [sides];
  const possible = requirements.filter(r => [...given].every(g => r.includes(g)))
    .map(r => r.filter(g => !given.has(g))).filter(r => r.length === 1);
  assert.equal(possible.length, 1, 'недостающее равенство единственно');
  const element = possible[0][0];
  return `${element} = ${element.replace(/[ABC]/g, v => v + '1')}`;
}

function expected(t, document) {
  if (t.type === 'which') {
    // Считаем штрихи и дужки на самом чертеже, а не читаем код признака из задания.
    const box = document.createElement('div');
    box.innerHTML = document.defaultView.APP.TYPES.which.ask(t);
    const ticks = box.querySelectorAll('line.tick').length;
    const arcs = box.querySelectorAll('path.arc').length;
    const sign = ticks === 12 && arcs === 0 ? 3 : ticks === 2 && arcs === 6 ? 2 : ticks === 6 && arcs === 2 ? 1 : 0;
    assert.notEqual(sign, 0, 'изображение содержит один из трёх признаков');
    return { value: String(sign), key: words[sign] };
  }
  if (t.type === 'trap') return { value: 'none', key: 'не доказано' };
  if (t.type === 'enough') { const value = missing(t); return { value, key: value }; }
  if (t.type === 'proof') {
    const value = { common: 'common', cross: 'vertical', second: 'second', third: 'third' }[t.form];
    assert.ok(value);
    return { value, key: value };
  }
  if (t.type === 'correspond') {
    const value = correspondenceFromDrawing(t, document);
    return { value, key: value };
  }
  if (t.type === 'certainty') {
    const value = t.kind === 's1' ? 'yes' : t.kind === 'different' ? 'no' : 'unknown';
    return { value, key: value };
  }
  if (t.type === 'reasoning') {
    const value = t.form === 'cross' ? { fact: '∠AOB = ∠COD', reason: 'vertical', sign: '1', conclusion: 'AOB=COD' }
      : { fact: t.form === 'second' ? '∠BAD = ∠BCD' : 'BD = BD', reason: t.form === 'second' ? 'given' : 'common',
        sign: t.form === 'second' ? '2' : t.form === 'third' ? '3' : '1', conclusion: 'ABD=CBD' };
    return { value, key: JSON.stringify(value) };
  }
  if (t.type === 'xside' || t.type === 'perv') {
    const perimeter = t.type === 'xside' ? t.p : [t.a1, t.a2, t.d].reduce((sum, side) => sum + side, 0);
    const n = t.type === 'xside' ? perimeter - [t.a1, t.a2].reduce((sum, side) => sum + side, 0) : perimeter;
    assert.equal(n > 0, true);
    return { value: { n, d: 1 }, key: String(n) };
  }
  throw new Error('Неизвестный тип: ' + t.type);
}

// Находим соответствие по инцидентности сторон со штрихами, читая фактический SVG.
function correspondenceFromDrawing(t, document) {
  const box = document.createElement('div');
  box.innerHTML = document.defaultView.APP.TYPES.correspond.ask(t);
  const paths = [...box.querySelectorAll('path.side')];
  const points = paths[1].getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  const ps = [0, 2, 4].map(i => ({ x: points[i], y: points[i + 1] }));
  const edges = [[0, 1], [1, 2], [2, 0]], counts = [0, 0, 0];
  const distance = (p, a, b) => {
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2)));
    return Math.hypot(p.x - a.x - f * (b.x - a.x), p.y - a.y - f * (b.y - a.y));
  };
  for (const line of box.querySelectorAll('line.tick')) {
    const p = { x: (+line.getAttribute('x1') + +line.getAttribute('x2')) / 2, y: (+line.getAttribute('y1') + +line.getAttribute('y2')) / 2 };
    if (p.x < 330) continue;
    const ds = edges.map(([a, b]) => distance(p, ps[a], ps[b]));
    counts[ds.indexOf(Math.min(...ds))]++;
  }
  const labels = ps.map(p => [...box.querySelectorAll('text')].filter(e => +e.getAttribute('x') > 330)
    .sort((a, b) => Math.hypot(+a.getAttribute('x') - p.x, +a.getAttribute('y') - p.y) - Math.hypot(+b.getAttribute('x') - p.x, +b.getAttribute('y') - p.y))[0].textContent);
  return [[1, 3], [1, 2], [2, 3]].map(pair => {
    const sides = pair.map(n => edges[counts.indexOf(n)]);
    const vertex = sides[0].find(i => sides[1].includes(i));
    return labels[vertex];
  }).join('');
}

function open(t, query = '') {
  const m = loadMaterial(SLUG, { query });
  t.after(m.close);
  return m;
}

test('треугольники: независимое решение всех типов и допустимость длин', t => {
  const { window: w, errors } = open(t);
  const A = w.APP, met = new Set();
  for (const [type, T] of Object.entries(A.TYPES)) {
    const rnd = A.mulberry32(type.length * 977);
    for (let i = 0; i < 400; i++) {
      const task = A.generate(type, rnd), e = expected(task, w.document);
      assert.ok(T.same(task, e.value), `${type}: ${JSON.stringify(task)}`);
      assert.equal(T.key(task), e.key);
      const text = [T.ask(task), T.ok(task), T.answer?.(task), ...T.hints(task), ...T.traps(task).map(x => x.html)].join(' ');
      assert.doesNotMatch(text, /NaN|undefined|Infinity/);
      if (type === 'proof') met.add(task.form);
      if (['xside', 'perv'].includes(type)) {
        const lengths = [task.a1, task.a2, e.value.n];
        if (type === 'perv') lengths[2] = task.d;
        for (const side of lengths) assert.ok(side < lengths.reduce((a, b) => a + b) - side, 'неравенство треугольника');
        assert.notEqual(task.a1, task.a2);
      }
    }
  }
  assert.deepEqual([...met].sort(), ['common', 'cross', 'second', 'third']);
  assert.deepEqual(errors, []);
});

test('треугольники: ключ 30 вариантов и запись доказательства на листе', t => {
  const { window: w } = open(t, '?mode=print');
  for (let i = 0; i < 30; i++) {
    const v = w.APP.makeVariant(1000 + i * 293);
    assert.deepEqual([...v.answers], [...v.tasks].map(x => expected(x, w.document).key));
    assert.equal(v.tasks[1].explain, true);
    assert.match(w.APP.TYPES.xside.sheet(v.tasks[1]), /3 равенства и признак/);
    assert.equal(v.tasks.filter(x => w.APP.TYPES[x.type].input === 'choice').length, 1);
  }
});

test('треугольники: тренажёр принимает независимые ответы во всех четырёх разделах', t => {
  const { window: w, errors } = open(t, '?mode=home');
  assert.equal(w.APP.SECTIONS.length, 4);
  const h = w.APP.home;
  for (let level = 0; level < 4; level++) {
    h.start({ level, seed: 7 + level });
    for (let i = 0; i < 10; i++) {
      const r = h.check(expected(h.state.task, w.document).value);
      assert.ok(r.ok, r.msg);
      assert.ok(Number.isFinite(h.state.score) && h.state.score > 0);
      h.next();
    }
    assert.ok(h.state.finished);
  }
  assert.deepEqual(errors, []);
});

test('треугольники: типичные ошибки названы и разъяснены', t => {
  const { window: w } = open(t, '?mode=home');
  const T = w.APP.TYPES;
  const ssa = T.trap.wrong({ kind: 'ssa', v: 'B' }, '1');
  assert.equal(ssa.cat, 'ssa'); assert.match(ssa.msg, /между/);
  const aaa = T.trap.wrong({ kind: 'aaa', v: '' }, '3');
  assert.equal(aaa.cat, 'aaa'); assert.match(aaa.msg, /размер/);
  const per = T.perv.wrong({ a1: 5, a2: 6, d: 7 }, { n: 11, d: 1 });
  assert.equal(per.cat, 'per'); assert.match(per.msg, /только две/);
  const proof = T.proof.wrong({ form: 'cross' }, 'common');
  assert.equal(proof.cat, 'proof'); assert.match(proof.msg, /вертикальные/);
  for (const type of ['enough', 'proof']) {
    const task = w.APP.generate(type, w.APP.mulberry32(123));
    assert.equal(T[type].same(task, T[type].wrongInput(task)), false);
    assert.ok(T[type].wrong(task, T[type].wrongInput(task)).msg.length > 40);
  }
});

test('треугольники: на чертеже недостающего условия различаются пары сторон', t => {
  const { window: w } = open(t);
  const box = w.document.createElement('div');
  box.innerHTML = w.APP.TYPES.enough.ask({ p: 3, sides: ['AB', 'AC'], angs: [] });
  assert.equal(box.querySelectorAll('line.tick').length, 6, 'одна пара — один штрих, другая — два');
});

test('треугольники: восемнадцать шагов доски и допустимые числа в новых примерах', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const b = w.APP.board;
  assert.equal(b.steps.length, 18);
  assert.match(b.steps.map(x => x.q + x.a).join(' '), /вертикальные/);
  assert.match(b.steps.map(x => x.q + x.a).join(' '), /общая сторона/);
  for (let i = 0; i < 100; i++) {
    b.numbers(true);
    const e = plain(b.e), lengths = [e.a, e.c, e.p - e.a - e.c];
    assert.ok(2 * Math.max(...lengths) < e.p);
  }
  assert.deepEqual(errors, []);
});

test('треугольники: три дополнительных вывода различаются и ошибка названа', t => {
  const { window: w } = open(t);
  const T = w.APP.TYPES.certainty;
  for (const [kind, answer] of [['s1', 'yes'], ['ssa', 'unknown'], ['aaa', 'unknown'], ['different', 'no']]) {
    assert.ok(T.same({ kind, v: 'B' }, answer));
  }
  const r = T.wrong({ kind: 'ssa', v: 'B' }, 'no');
  assert.equal(r.cat, 'certainty');
  assert.match(r.msg, /«Не доказано» не означает «не равны»/);
});

test('треугольники: сборка доказательства проверяет каждый компонент и ввод из интерфейса', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home, T = w.APP.TYPES.reasoning;
  for (const form of ['common', 'cross', 'second', 'third']) {
    const task = { ...w.APP.generate('reasoning', w.APP.mulberry32(35)), form };
    const right = expected(task, w.document).value;
    assert.ok(T.same(task, right));
    for (const field of Object.keys(right)) assert.equal(T.same(task, { ...right, [field]: 'неверно' }), false, field);
  }
  h.start({ level: 3, seed: 22 });
  const task = w.APP.generate('reasoning', w.APP.mulberry32(40));
  h.state.task = task; w.eval('homeRender()');
  assert.equal(h.collect().empty, true);
  const right = expected(task, w.document).value;
  w.document.querySelector('#hStep [data-k="fact"]').value = right.fact;
  w.document.querySelector('#hStep [data-act="check"]').click();
  assert.equal(w.document.querySelector('#hStep [data-k="fact"]').value, right.fact, 'неполный ответ сохраняется');
  for (const [k, v] of Object.entries(right)) w.document.querySelector(`#hStep [data-k="${k}"]`).value = v;
  assert.deepEqual(plain(h.collect()), right);
  w.document.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true);
  assert.deepEqual(errors, []);
});

test('треугольники: практикум и билет восстанавливаются по номеру, доступны со старта и переключаются', t => {
  for (const kind of ['proofs', 'ticket']) {
    const { window: w, errors } = open(t, '?mode=print&kind=' + kind);
    const seen = new Set();
    for (let i = 0; i < 30; i++) {
      const v = w.makeLessonSheet(1000 + i * 293, kind);
      assert.deepEqual(plain(v), plain(w.makeLessonSheet(v.num, kind)));
      if (kind === 'proofs') {
        assert.deepEqual(v.proofs.map(p => p.sign).join(','), '1,2,3');
        const answer = correspondenceFromDrawing(v.correspondence, w.document);
        assert.equal(answer, v.correspondence.names.join(''));
        v.proofs.forEach(p => assert.match(p.solution, /△/));
      } else {
        assert.equal(w.APP.TYPES.which.key(v.sign), expected(v.sign, w.document).key);
        assert.equal(w.APP.TYPES.trap.ans(v.error), 'none');
      }
      seen.add(JSON.stringify(v));
    }
    assert.ok(seen.size >= 8, 'генерируются разные задания');
    assert.equal(w.document.getElementById('pKind').value, kind);
    const sheets = w.document.getElementById('pSheets');
    assert.ok(sheets.querySelector(kind === 'proofs' ? '.lesson-sheet' : '.ticket-sheet'));
    assert.ok(sheets.querySelector('.lesson-key-row'));
    const toggle = w.document.getElementById('pExtraKey');
    assert.equal(toggle.hidden, false);
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.doesNotMatch(sheets.innerHTML, /undefined|NaN|\[object Object\]/);
    w.document.querySelector('[data-kind-set="word"]').click();
    assert.ok(sheets.querySelector('.bank'));
    w.document.querySelector(`#start [data-kind="${kind}"]`).click();
    assert.equal(w.APP.screen, 'print');
    assert.equal(w.document.getElementById('pKind').value, kind);
    w.document.getElementById('pSpace').checked = true;
    w.document.getElementById('pSpace').dispatchEvent(new w.Event('change'));
    assert.ok(sheets.querySelector(kind === 'proofs' ? '.lesson-sheet' : '.ticket-sheet'));
    assert.deepEqual(errors, []);
  }
});
