import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'arifmeticheskii-kvadratnyi-koren';
const MINUS = '−';

// Независимое решение: ответы ключа не берём из кода материала
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const add = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x, y) => R(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x, y) => R(x.n * y.n, x.d * y.d);
const sqrtInt = n => { const r = Math.round(Math.sqrt(n)); return n >= 0 && r * r === n ? r : null; };
const sqrtR = x => { const a = sqrtInt(x.n), b = sqrtInt(x.d); return a == null || b == null ? null : R(a, b); };
// запись числа как в ключе: десятичная дробь с запятой или «2 1/3»
function dec(x) {
  for (let k = 0; k <= 6; k++) {
    if ((x.n * 10 ** k) % x.d) continue;
    const s = String(Math.abs(x.n * 10 ** k / x.d)).padStart(k + 1, '0');
    return (x.n < 0 ? MINUS : '') + (k ? s.slice(0, -k) + ',' + s.slice(-k) : s);
  }
  return null;
}
const plain = x => JSON.parse(JSON.stringify(x));
const mixed = x => { const w = Math.floor(x.n / x.d), n = x.n - w * x.d; return x.d === 1 ? String(x.n) : (w ? w + ' ' : '') + n + '/' + x.d; };

// Ответ задания: value — что ввести в тренажёр, key — запись в ключе
function expected(t) {
  switch (t.type) {
    case 'table': return { value: R(t.k), key: String(t.k) };
    case 'dec': { const r = R(t.k, 10 ** t.m); return { value: r, key: dec(r) }; }
    case 'fraction': { const r = R(t.p, t.q); return { value: r, key: mixed(r) }; }
    case 'square': { const v = R({ A: t.a, B: t.a, C: t.k * t.k * t.b, D: t.m }[t.form]); return { value: v, key: String(v.n) }; }
    case 'expr': {
      const v = (t.op === '+' ? add : sub)(mul(t.c1, t.s1), mul(t.c2, t.s2));
      return { value: v, key: dec(v) };
    }
    case 'sum': { const v = R(t.minus ? sqrtInt(t.c * t.c - t.a * t.a) : sqrtInt(t.a * t.a + t.b * t.b)); return { value: v, key: String(v.n) }; }
    case 'meaning': {
      const u = { neg: -t.m, out: t.m, sqneg: t.m * t.m, negsq: -t.m * t.m, diff: t.p - t.q }[t.form];
      return { value: u >= 0 ? 'yes' : 'no' };
    }
    case 'eq': {
      const a = t.a, fmt = x => t.form === 'frac' ? mixed(x) : (dec(x) ?? mixed(x));
      if (a.n < 0) return { value: { roots: [] }, key: 'нет корней' };
      if (a.n === 0) return { value: { roots: [{ q: R(0) }] }, key: '0' };
      const s = sqrtR(a);
      if (s) return { value: { roots: [{ q: R(-s.n, s.d) }, { q: s }] }, key: '±' + fmt(s) };
      return { value: { roots: [{ m: a.n, s: -1 }, { m: a.n, s: 1 }] }, key: '±√' + a.n };
    }
    case 'est': { let lo = 1; while ((lo + 1) ** 2 <= t.a) lo++; return { value: { lo, hi: lo + 1 }, key: `${lo} и ${lo + 1}` }; }
    case 'cmp': { const c = sub(t.L.sq, t.R.sq).n; const s = c < 0 ? '<' : '>'; return { value: s, key: s }; }
  }
  throw new Error('Нет решения для ' + t.type);
}

function open(t, query = '', options = {}) {
  const m = loadMaterial(SLUG, { query, ...options });
  t.after(m.close);
  return m;
}

test('материал открывается во всех режимах без ошибок', t => {
  for (const q of ['', '?mode=board', '?mode=print', '?mode=home', '?mode=board&preview=1']) {
    const m = open(t, q);
    assert.deepEqual(m.errors, [], q);
    assert.ok(m.window.APP, q);
  }
  assert.equal(open(t, '?mode=print').window.APP.screen, 'print');
  assert.equal(open(t, '').window.APP.screen, 'start');
});

test('генератор: задания каждого типа корректны и не вырождены', t => {
  const { APP } = open(t).window;
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 977);
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const task = APP.generate(type, rnd), e = expected(task), T = APP.TYPES[type];
      seen.add(JSON.stringify(task));
      assert.ok(T.same(task, e.value), `${type}: независимый ответ принят ${JSON.stringify(task)}`);
      if (e.key) assert.equal(T.key(task), e.key, `${type}: запись ответа`);
      assert.doesNotMatch(T.text(task), /undefined|NaN/, type);
      if (type === 'dec') assert.notEqual(e.value.d, 1, 'корень из десятичной дроби — не целое число');
      if (type === 'fraction') assert.notEqual(e.value.d, 1, 'корень из дроби — не целое число');
      if (type === 'expr') {
        assert.ok(e.value.n > 0, 'значение выражения положительно');
        assert.equal(100 % e.value.d, 0, 'не больше двух знаков после запятой');
        assert.ok(task.s1.d > 1 || task.s2.d > 1, 'хотя бы один корень из десятичной дроби');
      }
      if (type === 'square' && task.form !== 'D') assert.equal(sqrtInt(task.form === 'C' ? task.b : task.a), null, 'под корнем не точный квадрат');
      if (type === 'est') assert.equal(sqrtInt(task.a), null, 'оцениваем корень, который не извлекается нацело');
      if (type === 'cmp') assert.notEqual(sub(task.L.sq, task.R.sq).n, 0, 'числа не равны');
      if (type === 'eq' && task.form === 'irr') assert.equal(sqrtInt(task.a.n), null);
      if (type === 'eq' && task.form === 'frac') assert.ok(task.a.n < task.a.d, 'правильная дробь');
    }
    assert.ok(seen.size >= 15, `${type}: задания разнообразны (${seen.size})`);
  }
  // все формы уравнения встречаются
  const rnd = APP.mulberry32(3), forms = new Set();
  for (let i = 0; i < 300; i++) forms.add(APP.generate('eq', rnd).form);
  assert.deepEqual([...forms].sort(), ['dec', 'frac', 'irr', 'neg', 'shift', 'sq', 'zero']);
});

test('раздатка: 30 вариантов различны, номер восстанавливает вариант, ключ верный', t => {
  const { APP } = open(t, '?mode=print').window;
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const n = 1000 + i * 293, v = APP.makeVariant(n);
    assert.equal(JSON.stringify(v), JSON.stringify(APP.makeVariant(n)), 'один номер — один вариант');
    const sig = JSON.stringify(v.tasks);
    assert.ok(!seen.has(sig), 'варианты различны'); seen.add(sig);
    assert.equal(v.label, `1-${n}`);
    assert.deepEqual([...v.tasks.map(x => x.type)], ['dec', 'fraction', 'expr', 'square', 'eq', 'eq', 'est', 'cmp']);
    assert.ok(v.tasks[1].mixed, 'задание 2 — корень из смешанного числа');
    assert.ok(['sq', 'dec', 'frac'].includes(v.tasks[4].form));
    assert.ok(['neg', 'irr', 'shift'].includes(v.tasks[5].form));
    assert.equal(new Set(v.word).size, 8, 'буквы слова не повторяются');
    const answers = [...v.tasks].map(x => expected(x).key);
    assert.deepEqual([...v.answers], answers, 'ключ совпадает с независимым решением');
    assert.equal(new Set(answers).size, 8, 'ответы заданий различны');
    // таблица букв: верный ответ задания i даёт i-ю букву слова, все буквы различны
    const bank = new Map(v.bank.map(x => [x.key, x.letter]));
    assert.equal(bank.size, v.bank.length);
    answers.forEach((a, k) => assert.equal(bank.get(a), v.word[k]));
    assert.equal(new Set(v.bank.map(x => x.letter)).size, v.bank.length, 'буквы в таблице различны');
    assert.ok(v.bank.length >= 14, 'в таблице есть ловушки');
    for (const x of v.bank) assert.doesNotMatch(x.html, /undefined|NaN/);
  }
});

test('раздатка: листы и ключ собираются, номера разбираются', t => {
  const { window: w, errors } = open(t, '?mode=print');
  w.APP.print.nums = [4817, 1234, 5555];
  assert.equal(w.APP.print.draw().length, 3);
  const doc = w.document;
  assert.equal(doc.querySelectorAll('.page.key').length, 1);
  assert.equal(doc.querySelectorAll('.page:not(.key) .sheet').length, 3);
  assert.equal(doc.querySelectorAll('table.key tr').length, 4);
  assert.equal(doc.querySelectorAll('.sheet')[0].querySelectorAll('.task').length, 8);
  assert.match(doc.querySelector('.sheet .vn').textContent, /1-4817/);
  assert.doesNotMatch(doc.getElementById('pSheets').innerHTML, /undefined|NaN/);
  // два варианта на листе — без сетки
  doc.getElementById('pSpace').checked = false; doc.getElementById('pTwo').checked = true;
  w.APP.print.draw();
  assert.equal(doc.querySelectorAll('.page.half').length, 2);
  const p = w.APP.parseNums('1-4817, 1234; 2-1111 abc 1234');
  assert.deepEqual([...p.nums], [4817, 1234]);
  assert.deepEqual([...p.bad], ['2-1111', 'abc']);
  assert.deepEqual(errors, []);
});

// ответ задания бланка ОГЭ — независимо от кода материала
function expectedOGE(x) {
  if (['dec', 'expr', 'square'].includes(x.kind)) return expected(x.t).key;
  if (x.kind === 'fraction') return dec(R(x.t.p, x.t.q));
  if (x.kind === 'eq' || x.kind === 'eqShift') { const s = sqrtR(x.t.a); return dec(x.big ? s : R(-s.n, s.d)); }
  if (x.kind === 'est') return String(expected(x.t).value.lo);
  if (x.kind === 'max') return String(x.t.sqs.indexOf(Math.max(...x.t.sqs)) + 1);
  throw new Error('Нет решения для ' + x.kind);
}

test('бланк ОГЭ: 30 вариантов различны, ответы — числа для клеточек, ключ верный', t => {
  const { APP } = open(t, '?mode=print').window;
  const seen = new Set(), bigs = new Set();
  for (let i = 0; i < 30; i++) {
    const n = 1000 + i * 293, v = APP.makeVariantOGE(n);
    assert.equal(JSON.stringify(v), JSON.stringify(APP.makeVariantOGE(n)), 'один номер — один вариант');
    const sig = JSON.stringify(v.answers) + JSON.stringify(v.tasks.map(x => x.t));
    assert.ok(!seen.has(sig), 'варианты различны'); seen.add(sig);
    assert.equal(v.label, `1-${n}`);
    assert.deepEqual([...v.tasks.map(x => x.kind)], ['dec', 'fraction', 'expr', 'square', 'eq', 'eqShift', 'est', 'max']);
    const word = APP.makeVariant(n).tasks;
    assert.ok([0, 1, 2, 3].some(k => JSON.stringify(v.tasks[k].t) !== JSON.stringify(word[k])), 'бланк и кодовое слово — разные задания');
    assert.deepEqual([...v.answers], [...v.tasks].map(expectedOGE), 'ключ совпадает с независимым решением');
    for (const a of v.answers) {
      assert.match(a, /^−?\d+(,\d+)?$/, `ответ «${a}» — целое число или десятичная дробь`);
      assert.ok(a.length <= 10, `ответ «${a}» помещается в 10 клеточек`);
    }
    assert.ok(v.tasks[1].t.mixed, 'задание 2 — корень из смешанного числа');
    const mx = v.tasks[7].t.sqs;
    assert.equal(new Set(mx).size, 4, 'в задании 8 четыре разных числа');
    assert.equal(sqrtInt(Math.max(...mx)), null, 'наибольшее — корень, а не целое число');
    for (const x of v.tasks) { assert.doesNotMatch(x.ask, /undefined|NaN/); if ('big' in x) bigs.add(x.big); }
  }
  assert.deepEqual([...bigs].sort(), [false, true], 'встречается и «больший», и «меньший» корень');
});

test('бланк ОГЭ: листы с клеточками и ключ собираются, вид листа запоминается', t => {
  const { window: w, errors } = open(t, '?mode=print');
  const doc = w.document;
  doc.getElementById('pKind').value = 'oge';
  w.APP.print.nums = [4817, 1234];
  const vs = w.APP.print.draw();
  assert.ok(vs.every(v => v.oge));
  const sheet = doc.querySelector('.page:not(.key) .sheet.oge');
  assert.ok(sheet, 'лист бланка');
  assert.equal(sheet.querySelectorAll('.blank .brow').length, 8, 'в бланке 8 строк');
  assert.equal(sheet.querySelectorAll('.blank .brow')[0].querySelectorAll('i').length, 10, 'по 10 клеточек');
  assert.equal(doc.querySelectorAll('table.key tr').length, 3, 'ключ — строка на вариант');
  assert.match(doc.querySelector('.page.key').textContent, /бланк ответов/);
  assert.doesNotMatch(doc.getElementById('pSheets').innerHTML, /undefined|NaN/);
  assert.equal(w.localStorage.getItem(`matshag:${SLUG}:printKind`), 'oge');
  // два бланка на листе
  doc.getElementById('pSpace').checked = false; doc.getElementById('pTwo').checked = true;
  w.APP.print.draw();
  assert.equal(doc.querySelectorAll('.page.half .sheet.oge').length, 2);
  assert.deepEqual(errors, []);
});

test('доска: все шаги вперёд и назад без ошибок, на разных числах', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  for (let round = 0; round < 25; round++) {
    if (round) B.numbers(true);
    const n = B.steps.length;
    assert.equal(n, 12);
    let guard = 0;
    while (!(B.i === n - 1 && B.phase === 1) && guard++ < 100) {
      B.next();
      assert.equal(!!w.document.querySelector('#bStage svg'), B.i < n - 1, 'чертёж есть на всех шагах, кроме правила');
    }
    assert.equal(B.i, n - 1);
    while (!(B.i === 0 && B.phase === 0) && guard++ < 200) B.prev();
    assert.equal(B.i, 0);
    assert.doesNotMatch(w.document.getElementById('board').innerHTML, /undefined|NaN|Infinity/);
    // числа на доске удобные: квадрат площадью 2 и т. п. — не точный квадрат
    assert.equal(sqrtInt(B.e.approx), null);
    assert.notEqual(B.e.side, B.e.trap);
  }
  assert.deepEqual(errors, []);
});

test('доска: первый пример — сторона 5, ловушки √16 = ±4, 0,06 и √(9 + 16) = 7', t => {
  const { window: w } = open(t, '?mode=board');
  const text = () => w.document.querySelector('.btext').textContent.replace(/\s+/g, '');
  const rec = () => w.document.getElementById('bRec').textContent.replace(/\s+/g, '');
  w.APP.board.go(0, 1);
  assert.match(text(), /5,потомучто5²=25/);
  w.APP.board.go(3, 1);
  assert.match(text(), /√16=±4\.Верно\?Нет:√16=4/);
  assert.match(rec(), /x=4илиx=−4/);
  w.APP.board.go(5, 1);
  assert.match(text(), /0,06или0,6/);
  assert.match(rec(), /√0,36=0,6/);
  w.APP.board.go(6, 1);
  assert.match(rec(), /=53=123/);
  w.APP.board.go(8, 1);
  assert.match(rec(), /1,4<√2<1,5,1,41<√2<1,42/);
  w.APP.board.go(9, 1);
  assert.match(text(), /√9\+16=3\+4=7\?Нет:√9\+16=√25=5/);
  // подсказка учителю спрятана, пока её не включат
  assert.equal(w.document.getElementById('bNote').hidden, true);
  w.document.querySelector('[data-act="notes"]').click();
  assert.equal(w.document.getElementById('bNote').hidden, false);
  assert.ok(w.document.getElementById('bNote').textContent.length > 30);
});

test('тренажёр: в каждом разделе 40 заданий решаются верно', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const h = w.APP.home;
  for (let level = 0; level < w.APP.SECTIONS.length; level++) {
    let seed = 50 + level, solved = 0;
    const types = new Set();
    h.start({ level, seed });
    while (solved < 40) {
      const task = h.state.task;
      types.add(task.type);
      const r = h.check(expected(task).value);
      assert.ok(r.ok, `раздел ${level + 1}, ${task.type}: ${r.msg}`);
      assert.ok(h.state.gain > 0);
      assert.ok(r.msg.length > 10);
      solved++;
      h.next();
      if (h.state.finished) h.start({ level, seed: ++seed });
    }
    assert.deepEqual([...types].sort(), [...w.APP.SECTIONS[level].types].sort(), 'встречаются все типы раздела');
  }
  assert.deepEqual(errors, []);
});

// подставить в тренажёр конкретное задание
function put(h, task) { Object.assign(h.state, { task, wait: false, taskDone: false, hints: 0, hintLevel: 0, eqCount: null }); }

test('тренажёр: типичные ошибки называются', t => {
  const { window: w } = open(t, '?mode=home');
  const { APP } = w, h = APP.home, Q = APP.Q;
  h.start({ level: 0, seed: 1 });
  const find = (type, ok, form) => { const rnd = APP.mulberry32(7); for (;;) { const x = APP.generate(type, rnd, form); if (ok(x)) return x; } };
  const cases = [
    [find('table', () => true), x => Q(-x.k), 'sign', /не бывает отрицательным/],
    [find('dec', () => true), x => Q(x.k, 10 ** (2 * x.m)), 'decimal', /Запятая не на месте/],
    [find('fraction', x => x.mixed && APP.TYPES.fraction.sep(x), 'mixed'), x => APP.TYPES.fraction.sep(x), 'frac', /отдельно из целой части/],
    [find('square', x => x.form === 'C'), x => Q(x.k * x.b), 'square', /тоже нужно возвести в квадрат/],
    [find('square', x => x.form === 'D'), x => Q(-x.m), 'sign', /не бывает отрицательным/],
    [find('sum', x => !x.minus), x => Q(x.a + x.b), 'sumRoot', /не равен сумме корней/],
    [find('meaning', x => x.form === 'negsq'), () => 'yes', 'meaning', /в квадрат возводится только/],
    [find('eq', () => true, 'sq'), x => ({ roots: [{ q: Q(Math.sqrt(x.a.n)) }] }), 'eqTwo', /два корня/],
    [find('eq', () => true, 'neg'), x => ({ roots: [{ m: -x.a.n, s: 1 }, { m: -x.a.n, s: -1 }] }), 'eqNone', /не имеет|неотрицателен/],
    [find('eq', x => x.a.n > 0 && x.alt?.length, 'shift'), x => expected({ type: 'eq', form: 'sq', a: x.alt[0] }).value, 'eqShift', /противоположным знаком/],
    [find('eq', () => true, 'zero'), () => ({ roots: [] }), 'eqCount', /0² = 0/],
    [find('est', () => true), x => { const e = expected(x).value; return { lo: e.lo + 1, hi: e.hi + 1 }; }, 'est', /соседние квадраты/],
    [find('cmp', () => true), x => expected(x).value === '<' ? '>' : '<', 'cmp', /по их квадратам/],
  ];
  for (const [task, wrong, cat, re] of cases) {
    put(h, task);
    const r = h.check(wrong(task));
    assert.equal(r.ok, false, task.type);
    assert.equal(r.cat, cat, `${task.type}: ${r.msg}`);
    assert.match(r.msg.replace(/<[^>]+>/g, ''), re, task.type);
    assert.equal(h.state.gain, 0, 'с ошибкой очков нет');
    assert.equal(h.state.streak, 0);
    h.next();
    if (h.state.finished) h.start({ level: 0, seed: 2 });
    else assert.equal(h.state.task.type, task.type, 'после ошибки — задание того же типа');
  }
});

test('тренажёр: любой неверный ответ получает объяснение с вычислением', t => {
  const { window: w } = open(t, '?mode=home');
  const { APP } = w, h = APP.home, Q = APP.Q;
  h.start({ level: 0, seed: 1 });
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 13);
    for (let i = 0; i < 30; i++) {
      const task = APP.generate(type, rnd), e = expected(task).value;
      const wrong = typeof e === 'string' ? (e === 'yes' ? 'no' : e === 'no' ? 'yes' : '=')
        : e.roots ? { roots: [{ q: Q(12345) }] }
        : e.lo ? { lo: e.lo + 3, hi: e.hi + 3 } : add(e, Q(7));
      put(h, task);
      const r = h.check(wrong);
      assert.equal(r.ok, false, type);
      assert.ok(r.cat && r.msg.length > 30, `${type}: ${r.msg}`);
      assert.match(r.msg, /\d/, 'в объяснении есть вычисление');
      assert.doesNotMatch(r.msg, /undefined|NaN/);
    }
  }
});

test('тренажёр: ввод с клавиатуры — запятая, дробь, корень, число корней', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const { APP, document: doc } = w, h = APP.home;
  h.start({ level: 0, seed: 4 });
  const set = (k, v) => { doc.querySelector(`#hStep [data-k="${k}"]`).value = v; };
  // десятичная дробь
  put(h, { type: 'dec', k: 3, m: 1 }); h.setCount(null);
  set('v', '0.3');
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, 'точка вместо запятой принимается');
  // дробь: целая часть необязательна
  put(h, { type: 'fraction', mixed: true, p: 5, q: 3 }); h.setCount(null);
  set('n', '5'); set('d', '3');
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, 'неправильная дробь 5/3 принимается');
  // уравнение: сначала число корней, потом корни со знаком √
  put(h, { type: 'eq', form: 'irr', a: APP.Q(7) }); h.setCount(null);
  doc.querySelector('[data-act="check"]')?.click();
  assert.equal(doc.querySelectorAll('#hStep input').length, 0, 'полей нет, пока не выбрано число корней');
  doc.querySelector('[data-count="2"]').click();
  set('r1', '√7'); set('r2', '-√7');
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, 'корни ±√7');
  // уравнение без корней
  put(h, { type: 'eq', form: 'neg', a: APP.Q(-16) }); h.setCount(null);
  doc.querySelector('[data-count="0"]').click();
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, 'корней нет');
  // выбор
  put(h, { type: 'cmp', form: 'A', L: { html: '√50', sq: APP.Q(50) }, R: { html: '7', sq: APP.Q(49) } }); h.setCount(null);
  doc.querySelector('[data-choice=">"]').click();
  assert.equal(h.state.last.ok, true, '√50 > 7');
  // разбор ввода
  assert.deepEqual(plain(APP.parseQ('1 2/3')), { n: 5, d: 3 });
  assert.deepEqual(plain(APP.parseQ('−0,25')), { n: -1, d: 4 });
  assert.equal(APP.parseQ('abc'), null);
  assert.deepEqual(plain(APP.parseVal('2√3')), { m: 12, s: 1 });
  assert.deepEqual(plain(APP.parseVal('−√49')), { q: { n: -7, d: 1 } });
  assert.deepEqual(errors, []);
});

test('подсказка снимает очки, но не ломает серию', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 0, seed: 11 });
  assert.match(h.hint(), /\d/);
  h.check(expected(h.state.task).value);
  assert.equal(h.state.gain, w.APP.CONFIG.home.points[0] - w.APP.CONFIG.home.hintPenalty);
  assert.equal(h.state.streak, 1);
});

test('тренажёр: ссылка с разделом сразу открывает задания, итоги называют ошибки', t => {
  const { window: w, errors } = open(t, '?mode=home&level=3');
  const h = w.APP.home;
  assert.equal(h.state.level, 2);
  assert.equal(w.document.getElementById('hPlay').hidden, false);
  assert.equal(h.state.task.type, 'eq');
  for (let i = 0; i < 10; i++) { h.check(i === 0 ? { roots: [{ q: w.APP.Q(999) }] } : expected(h.state.task).value); h.next(); }
  assert.equal(h.state.finished, true);
  assert.match(w.document.getElementById('hEnd').textContent, /Над чем поработать/);
  assert.equal(w.document.querySelectorAll('#hEnd .work li').length, 1);
  assert.deepEqual(errors, []);
  // без раздела — выбор раздела, нажатие на карточку сразу начинает
  const m = open(t, '?mode=home');
  assert.equal(m.window.document.getElementById('hSetup').hidden, false);
  m.window.document.querySelector('[data-level="3"]').click();
  assert.equal(m.window.APP.home.state.level, 3);
  assert.ok(['est', 'cmp'].includes(m.window.APP.home.state.task.type));
});

test('ссылка для учеников: только тренажёр, без выхода к доске и раздатке', t => {
  for (const q of ['?mode=home&student=1', '?student=1', '?mode=print&student=1']) {
    const { window: w, errors } = open(t, q);
    const { APP, document: doc } = w;
    assert.equal(APP.STUDENT, true, q);
    assert.equal(APP.screen, 'home', `${q}: открыт тренажёр`);
    APP.show('print'); APP.show('board'); APP.show('start');
    assert.equal(APP.screen, 'home', `${q}: другие режимы недоступны`);
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(APP.screen, 'home', `${q}: Esc не выводит в меню`);
    assert.ok(doc.body.classList.contains('student'), 'меню и ссылки учителя спрятаны');
    assert.deepEqual(errors, []);
  }
  const m = open(t, '?mode=home&level=2&student=1');
  assert.equal(m.window.document.getElementById('hPlay').hidden, false);
  assert.equal(m.window.APP.home.state.level, 1);
});

test('стартовый экран: ссылка «Назад на сайт» ведёт на страницу материала', t => {
  const a = open(t, '').window.document.getElementById('toSite');
  assert.equal(a.hidden, false);
  assert.equal(a.getAttribute('href'), `https://example.test/item/${SLUG}/`);
  assert.equal(a.target, '_top');
  assert.equal(open(t, '?student=1').window.document.getElementById('toSite').hidden, true);
});

test('раздатка: номера вариантов запоминаются между открытиями', t => {
  const m1 = open(t, '?mode=print');
  const nums = m1.window.document.getElementById('pNums').value;
  const saved = m1.window.localStorage.getItem(`matshag:${SLUG}:printNums`);
  assert.ok(saved, 'номера сохранены');
  const m2 = open(t, '?mode=print', { beforeParse(win) { win.localStorage.setItem(`matshag:${SLUG}:printNums`, saved); } });
  assert.equal(m2.window.document.getElementById('pNums').value, nums);
  assert.match(m2.window.document.getElementById('pMsg').textContent, /прошлый раз/);
});

test('без localStorage материал работает', t => {
  const m = open(t, '?mode=print', {
    beforeParse(win) { Object.defineProperty(win, 'localStorage', { get() { throw new Error('Хранилище недоступно'); } }); },
  });
  assert.equal(m.window.APP.screen, 'print');
  assert.deepEqual(m.errors, []);
});
