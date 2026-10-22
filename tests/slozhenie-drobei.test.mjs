import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'slozhenie-drobei';
const MINUS = '−';

// Независимое решение: ответы ключа не берём из кода материала
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
function expected(t) {
  const L = lcm(t.a.d, t.b.d);
  const x = t.a.n * (L / t.a.d), y = t.b.n * (L / t.b.d);
  const N = t.op === '+' ? x + y : x - y;
  const g = gcd(N, L), n = N / g, d = L / g;
  return { L, ka: L / t.a.d, kb: L / t.b.d, N, g, red: { n, d }, mixed: { w: Math.floor(n / d), n: n % d, d } };
}
const key = m => (m.w ? m.w + ' ' : '') + (m.n ? m.n + '/' + m.d : '');

function open(t, query = '') {
  const m = loadMaterial(SLUG, { query });
  t.after(m.close);
  return m;
}

test('материал открывается во всех режимах без ошибок', t => {
  for (const q of ['', '?mode=board', '?mode=print', '?mode=home', '?mode=board&preview=1']) {
    const m = open(t, q);
    assert.deepEqual(m.errors, [], q);
    assert.ok(m.window.APP, q);
  }
  const m = open(t, '?mode=print');
  assert.equal(m.window.APP.screen, 'print');
  assert.equal(open(t, '').window.APP.screen, 'start');
});

test('генератор: задания каждого типа корректны и не вырождены', t => {
  const { APP } = open(t).window;
  for (const [kind, spec] of Object.entries(APP.SPECS)) {
    const rnd = APP.mulberry32(kind.length * 7777);
    for (let i = 0; i < 300; i++) {
      const task = APP.genTask(rnd, spec);
      const { a, b, op } = task, e = expected(task);
      for (const f of [a, b]) {
        assert.ok(f.n >= 1 && f.n < f.d, `${kind}: правильная дробь`);
        assert.equal(gcd(f.n, f.d), 1, `${kind}: несократимое слагаемое`);
        assert.ok(f.d <= APP.CONFIG.maxDen);
      }
      assert.notEqual(a.d, b.d, `${kind}: разные знаменатели`);
      assert.ok(e.L <= APP.CONFIG.maxLcm);
      assert.ok(e.N > 0, `${kind}: ответ положительный`);
      assert.notEqual(e.red.d, 1, `${kind}: ответ не целое число`);
      assert.equal(op, spec.op);
      const g = gcd(a.d, b.d), isMult = a.d % b.d === 0 || b.d % a.d === 0;
      if (spec.den === 'mult') assert.ok(isMult);
      if (spec.den === 'coprime') assert.equal(g, 1);
      if (spec.den === 'common') assert.ok(g > 1 && !isMult);
      if (spec.den === 'shared') assert.ok(g > 1);
      const improper = e.red.n > e.red.d;
      if (spec.need === 'none') assert.ok(!improper && e.g === 1, `${kind}: ответ без сокращения и целой части`);
      if (spec.need === 'reduce') assert.ok(!improper && e.g > 1, `${kind}: ответ сокращается`);
      if (spec.need === 'whole') assert.ok(improper, `${kind}: ответ больше 1`);
      // решение материала совпадает с независимым
      assert.equal(key(APP.solve(task).mixed), key(e.mixed));
    }
  }
});

test('ловушки: типичные ошибки, не совпадают с верным ответом', t => {
  const { APP } = open(t).window;
  const task = { a: { n: 2, d: 3 }, b: { n: 3, d: 4 }, op: '+' };
  const tr = APP.traps(task).map(x => [key(x.m), x.why]);
  assert.deepEqual(tr[0], ['17/12', 'whole']);       // не выделил целую часть
  assert.ok(tr.some(([k, w]) => k === '5/7' && w === 'naive'));   // сложил числители и знаменатели
  const rnd = APP.mulberry32(5);
  for (let i = 0; i < 300; i++) {
    const t2 = APP.genTask(rnd, APP.SPECS[APP.KINDS_V1[i % 6]]);
    const right = key(expected(t2).mixed);
    for (const x of APP.traps(t2)) assert.notEqual(key(x.m), right);
  }
});

test('раздатка: 30 вариантов различны, номер восстанавливает вариант, ключ верный', t => {
  const { APP } = open(t, '?mode=print').window;
  const nums = Array.from({ length: 30 }, (_, i) => 1000 + i * 293);
  const seen = new Set();
  for (const n of nums) {
    const v = APP.makeVariant(n);
    assert.equal(JSON.stringify(v), JSON.stringify(APP.makeVariant(n)), 'один номер — один вариант');
    const sig = JSON.stringify(v.tasks);
    assert.ok(!seen.has(sig), 'варианты различны'); seen.add(sig);
    assert.equal(v.label, `1-${n}`);
    assert.equal(v.tasks.length, 6);
    assert.equal(new Set(v.word).size, v.word.length, 'буквы слова не повторяются');
    const answers = v.tasks.map(task => key(expected(task).mixed));
    assert.deepEqual(v.answers.map(key), answers, 'ключ совпадает с независимым решением');
    assert.equal(new Set(answers).size, 6, 'ответы заданий различны');
    assert.equal(v.tasks.at(-1).op, MINUS, 'последнее задание — вычитание');
    // таблица букв: верный ответ задания i даёт i-ю букву слова, все буквы различны
    const bank = new Map(v.bank.map(x => [key(x.m), x.letter]));
    assert.equal(bank.size, v.bank.length);
    answers.forEach((a, i) => assert.equal(bank.get(a), v.word[i]));
    assert.equal(new Set(v.bank.map(x => x.letter)).size, v.bank.length, 'буквы в таблице различны');
    assert.ok(v.bank.length > 6, 'в таблице есть ловушки');
  }
});

test('раздатка: листы и ключ собираются, номера разбираются', t => {
  const { window: w, errors } = open(t, '?mode=print');
  w.APP.print.nums = [4817, 1234, 5555];
  const vs = w.APP.print.draw();
  assert.equal(vs.length, 3);
  const doc = w.document;
  assert.equal(doc.querySelectorAll('.page.key').length, 1);
  assert.equal(doc.querySelectorAll('.page:not(.key) .sheet').length, 3);
  assert.equal(doc.querySelectorAll('table.key tr').length, 4);
  assert.match(doc.querySelector('.sheet .vn').textContent, /1-4817/);
  const p = w.APP.parseNums('1-4817, 1234; 2-1111 abc 1234');
  assert.deepEqual([...p.nums], [4817, 1234]);
  assert.deepEqual([...p.bad], ['2-1111', 'abc']);
  assert.deepEqual(errors, []);
});

test('доска: все шаги вперёд и назад без ошибок, на разных числах', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  for (let round = 0; round < 25; round++) {
    if (round) B.numbers(true);
    const n = B.steps.length;
    assert.ok(n >= 9, 'не меньше 9 шагов');
    let guard = 0;
    while (!(B.i === n - 1 && B.phase === 1) && guard++ < 100) {
      B.next();
      assert.ok(w.document.querySelector('#bStage svg'), 'полоски нарисованы');
    }
    assert.equal(B.i, n - 1);
    while (!(B.i === 0 && B.phase === 0) && guard++ < 200) B.prev();
    assert.equal(B.i, 0);
    assert.doesNotMatch(w.document.getElementById('board').innerHTML, /undefined|NaN/);
  }
  assert.deepEqual(errors, []);
});

test('доска: первый пример 2/3 + 3/4 показывает ловушку 5/7 и ответ 1 5/12', t => {
  const { window: w } = open(t, '?mode=board');
  const text = () => w.document.querySelector('.btext').textContent.replace(/\s+/g, '');
  w.APP.board.go(1, 1);
  assert.match(text(), /57меньше,чем34/);
  w.APP.board.go(6, 1);
  assert.match(text(), /1712=1512/);
});

// значения шага, посчитанные независимо (с наименьшим общим знаменателем)
function stepValues(step, task) {
  const e = expected(task);
  return {
    den: { v: e.L }, mult: { a: e.ka, b: e.kb }, num: { v: e.N },
    reduce: { n: e.red.n, d: e.red.d }, whole: { ...e.mixed },
  }[step];
}
function expectedSteps(task) {
  const e = expected(task), s = ['den', 'mult', 'num'];
  if (e.g > 1) s.push('reduce');
  if (e.red.n > e.red.d) s.push('whole');
  return s;
}

test('тренажёр: на каждом уровне 40 заданий решаются до конца', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let level = 0; level < 3; level++) {
    let seed = 100 + level, solved = 0;
    h.start({ level, sub: true, seed });
    const kinds = new Set();
    while (solved < 40) {
      const task = h.state.task, steps = [];
      kinds.add(task.op);
      while (true) {
        steps.push(h.step);
        const r = h.check(stepValues(h.step, task));
        assert.ok(r.ok, `уровень ${level + 1}, шаг ${h.step}: ${r.msg}`);
        if (h.state.taskDone) break;
        h.next();
      }
      assert.deepEqual(steps, expectedSteps(task));
      const shown = w.document.getElementById('hDone').textContent;
      assert.equal(/сократили/.test(shown), steps.includes('reduce'), 'в записи решения только пройденные шаги');
      assert.ok(h.state.gain > 0);
      solved++;
      h.next();
      if (h.state.finished) h.start({ level, sub: true, seed: ++seed });
    }
    assert.ok(kinds.has('+') && kinds.has(MINUS), 'есть и сложение, и вычитание');
  }
  assert.deepEqual(errors, []);
});

test('тренажёр: ошибки объясняются и называются', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 1, sub: false, seed: 7 });
  const task = h.state.task, e = expected(task);
  // сложил знаменатели
  let r = h.check({ v: task.a.d + task.b.d });
  assert.equal(r.ok, false);
  assert.equal(r.cat, 'naive');
  assert.match(r.msg, /сложил знаменатели/);
  h.next();
  r = h.check({ a: e.kb, b: e.ka });   // перепутал множители (у взаимно простых они разные)
  assert.equal(r.cat, 'mult');
  h.next();
  r = h.check({ v: task.a.n + task.b.n });
  assert.equal(r.cat, 'onlyDen');
  assert.match(r.msg, /домножили только знаменатели/);
  while (!h.state.taskDone) { h.next(); h.check(stepValues(h.step, task)); }
  assert.equal(h.state.gain, 0, 'с ошибками очков нет');
  assert.equal(h.state.streak, 0);
  assert.deepEqual(Object.keys(h.state.cats).sort(), ['mult', 'naive', 'onlyDen']);
  h.next();
  assert.equal(h.state.task.op, task.op, 'после ошибки — задание того же вида');
  assert.notDeepEqual(h.state.task, task, 'с другими числами');
});

test('тренажёр: неверный ответ на каждом шаге даёт объяснение с вычислением', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let seed = 1; seed <= 30; seed++) {
    h.start({ level: 2, sub: true, seed });
    const task = h.state.task;
    while (true) {
      const right = stepValues(h.step, task);
      const wrong = Object.fromEntries(Object.entries(right).map(([k, v]) => [k, v + 1]));
      const r = h.check(wrong);
      assert.equal(r.ok, false, h.step);
      assert.ok(r.cat && r.msg.length > 30, `${h.step}: ${r.msg}`);
      assert.match(r.msg, /\d/, 'в объяснении есть вычисление');
      if (h.state.taskDone) break;
      h.next();
    }
  }
});

test('тренажёр: неНОК как общий знаменатель принимается, сокращение доходит до конца', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 2, sub: false, seed: 3 });
  const task = h.state.task, D = task.a.d * task.b.d, e = expected(task);
  let r = h.check({ v: D });
  assert.equal(r.ok, true);
  assert.match(r.msg, /наименьший общий знаменатель/);
  h.next();
  h.check({ a: D / task.a.d, b: D / task.b.d }); h.next();
  const N = task.a.n * (D / task.a.d) + task.b.n * (D / task.b.d);
  h.check({ v: N });
  assert.equal(h.step, 'num');
  h.next();
  assert.equal(h.step, 'reduce', 'с произведением знаменателей ответ надо сократить');
  r = h.check({ n: N, d: D });
  assert.equal(r.cat, 'reduce');
  while (!h.state.taskDone) { h.next(); h.check(stepValues(h.step, task)); }
  assert.equal(key(w.APP.solve(task).mixed), key(e.mixed));
});

test('подсказка снимает очки, но не ломает серию', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 0, sub: false, seed: 11 });
  const task = h.state.task;
  assert.match(h.hint(), /\d/);
  while (true) {
    h.check(stepValues(h.step, task));
    if (h.state.taskDone) break;
    h.next();
  }
  assert.equal(h.state.gain, w.APP.CONFIG.home.points[0] - w.APP.CONFIG.home.hintPenalty);
  assert.equal(h.state.streak, 1);
});
