import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'svojstva-kvadratnogo-korena';
const MINUS = '−';
const plain = x => JSON.parse(JSON.stringify(x));

// ================= Независимое решение =================
// Ответы ключа не берём из кода материала: считаем сами тем же правилом свойства корня.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const sqrtInt = n => { const r = Math.round(Math.sqrt(n)); return n >= 0 && r * r === n ? r : null; };
function dec(x) {
  for (let k = 0; k <= 6; k++) {
    if ((x.n * 10 ** k) % x.d) continue;
    const s = String(Math.abs(x.n * 10 ** k / x.d)).padStart(k + 1, '0');
    return (x.n < 0 ? MINUS : '') + (k ? s.slice(0, -k) + ',' + s.slice(-k) : s);
  }
  return null;
}
const mixed = x => { const w = Math.floor(x.n / x.d), n = x.n - w * x.d; return x.d === 1 ? String(x.n) : (w ? w + ' ' : '') + n + '/' + x.d; };
const text = html => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, '');
// число, записанное как k√m или √m, — по его квадрату k²·m
function squareOf(html) {
  const s = text(html).replace(MINUS, '-');
  const m = s.match(/^(\d*)(?:√(\d+))?$/);
  assert.ok(m, `число записано как k√m: «${s}»`);
  const k = m[1] ? +m[1] : 1;
  return m[2] ? k * k * +m[2] : k * k;
}

// value — что вводит ученик, key — запись в ключе
function expected(t) {
  switch (t.type) {
    case 'prod': {
      const under = t.form === 'sq' ? t.a * t.a * t.b * t.b : t.a * t.b;
      const r = sqrtInt(under);
      assert.ok(r != null, 'корень из произведения извлекается');
      return { value: R(r), key: String(r) };
    }
    case 'quot': {
      const v = t.form === 'divide' ? R(sqrtInt(t.a / t.b)) : R(t.p, t.q);
      return { value: v, key: dec(v) ?? mixed(v) };
    }
    case 'out': {
      // наибольший квадратный множитель — перебором, без OUTQ из материала
      let k = 1;
      for (let j = 1; j * j <= t.n; j++) if (t.n % (j * j) === 0) k = j;
      return { value: { k, m: t.n / (k * k) }, key: `${k}√${t.n / (k * k)}` };
    }
    case 'in': {
      const under = t.form === 'fold' ? t.k * t.k * t.m : t.a * t.b;
      return { value: R(under), key: String(under) };
    }
    case 'simpl': {
      const k = t.k1 + t.k2;
      return { value: { k, m: t.m }, key: `${k}√${t.m}` };
    }
    case 'cmp': {
      const s = squareOf(t.L.v) < squareOf(t.R.v) ? '<' : '>';
      return { value: s, key: s };
    }
  }
  throw new Error('Нет решения для ' + t.type);
}

function expectedOGE(x) {
  switch (x.kind) {
    case 'prodF':
    case 'prodS':
    case 'quotD': return expected(x.t).key;
    case 'quotR': return dec(R(x.t.p, x.t.q));
    case 'coef': return String(x.t.k * x.t.m);
    case 'maxBig': return String(x.t.sqs.indexOf(Math.max(...x.t.sqs)) + 1);
    case 'maxSmall': return String(x.t.sqs.indexOf(Math.min(...x.t.sqs)) + 1);
    case 'prodDec': return dec(R(x.t.j * x.t.m, 10));
  }
  throw new Error('Нет решения для ' + x.kind);
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
      assert.equal(T.key(task), e.key, `${type}: запись ответа`);
      assert.doesNotMatch(T.text(task), /undefined|NaN/, type);
      if (type === 'prod' && task.form === 'sq') assert.notEqual(task.a, task.b, 'два разных квадрата');
      if (type === 'prod' && task.form === 'fold') assert.equal(sqrtInt(task.a), null, 'первый множитель — не квадрат');
      if (type === 'quot' && task.form === 'reduce') assert.ok(task.p * task.p * task.b === task.q * task.q * task.a, 'дробь сокращена верно');
      if (type === 'out') assert.equal(sqrtInt(task.m), null, 'под корнем остаётся неквадрат');
      if (type === 'out') assert.ok(e.value.k > 1, 'множитель вынесен');
      if (type === 'in' && task.form === 'fold') assert.ok(task.k * task.k * task.m <= 600, 'не слишком большое подкоренное');
      if (type === 'simpl') assert.notEqual(task.k1, task.k2, 'коэффициенты различны');
      if (type === 'cmp') assert.notEqual(squareOf(task.L.v), squareOf(task.R.v), 'числа не равны');
    }
    assert.ok(seen.size >= 12, `${type}: задания разнообразны (${seen.size})`);
  }
  // все формы типов встречаются
  const rnd = APP.mulberry32(5), forms = new Set();
  for (let i = 0; i < 300; i++) { forms.add('prod:' + APP.generate('prod', rnd).form); forms.add('in:' + APP.generate('in', rnd).form); }
  assert.deepEqual([...forms].sort(), ['in:fold', 'in:irr', 'prod:fold', 'prod:sq']);
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
    assert.deepEqual([...v.tasks.map(x => x.type)], ['prod', 'prod', 'quot', 'quot', 'out', 'in', 'simpl', 'cmp']);
    assert.equal(new Set(v.word).size, 8, 'буквы слова не повторяются');
    const answers = [...v.tasks].map(x => expected(x).key);
    assert.deepEqual([...v.answers], answers, 'ключ совпадает с независимым решением');
    assert.equal(new Set(answers).size, 8, 'ответы заданий различны');
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
  doc.getElementById('pSpace').checked = false; doc.getElementById('pTwo').checked = true;
  w.APP.print.draw();
  assert.equal(doc.querySelectorAll('.page.half').length, 2);
  const p = w.APP.parseNums('1-4817, 1234; 2-1111 abc 1234');
  assert.deepEqual([...p.nums], [4817, 1234]);
  assert.deepEqual([...p.bad], ['2-1111', 'abc']);
  assert.deepEqual(errors, []);
});

test('бланк ОГЭ: 30 вариантов различны, ответы — числа для клеточек, ключ верный', t => {
  const { APP } = open(t, '?mode=print').window;
  const seen = new Set(), kinds = new Set();
  for (let i = 0; i < 30; i++) {
    const n = 1000 + i * 293, v = APP.makeVariantOGE(n);
    assert.equal(JSON.stringify(v), JSON.stringify(APP.makeVariantOGE(n)), 'один номер — один вариант');
    const sig = JSON.stringify(v.answers) + JSON.stringify(v.tasks.map(x => x.t));
    assert.ok(!seen.has(sig), 'варианты различны'); seen.add(sig);
    assert.equal(v.label, `1-${n}`);
    assert.deepEqual([...v.tasks.map(x => x.kind)], ['prodF', 'prodS', 'quotD', 'quotR', 'coef', 'maxBig', 'maxSmall', 'prodDec']);
    assert.deepEqual([...v.answers], [...v.tasks].map(expectedOGE), 'ключ совпадает с независимым решением');
    for (const a of v.answers) {
      assert.match(a, /^−?\d+(,\d+)?$/, `ответ «${a}» — целое число или десятичная дробь`);
      assert.ok(a.length <= 10, `ответ «${a}» помещается в 10 клеточек`);
    }
    for (const x of v.tasks) { assert.doesNotMatch(x.ask, /undefined|NaN/); kinds.add(x.kind); }
  }
  assert.equal(kinds.size, 8);
  const mx = APP.makeVariantOGE(4242).tasks[5].t.sqs;
  assert.equal(new Set(mx).size, 4, 'в задании 6 четыре разных числа');
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
  assert.doesNotMatch(doc.getElementById('pSheets').innerHTML, /undefined|NaN/);
  assert.equal(w.localStorage.getItem(`matshag:${SLUG}:printKind`), 'oge');
  doc.getElementById('pSpace').checked = false; doc.getElementById('pTwo').checked = true;
  w.APP.print.draw();
  assert.equal(doc.querySelectorAll('.page.half .sheet.oge').length, 2);
  assert.deepEqual(errors, []);
});

test('бланк ОГЭ виден: кнопка на стартовом экране, переключатель в панели, ссылка ?kind=oge', t => {
  const { window: w, errors } = open(t, '');
  const doc = w.document;
  doc.querySelector('#start [data-kind="oge"]').click();
  assert.equal(w.APP.screen, 'print');
  assert.ok(doc.querySelector('.sheet.oge'), 'со стартового экрана открылся бланк');
  assert.equal(doc.querySelector('[data-kind-set="oge"]').getAttribute('aria-pressed'), 'true');
  doc.querySelector('[data-kind-set="word"]').click();
  assert.ok(!doc.querySelector('.sheet.oge') && doc.querySelector('.sheet .bank'), 'переключатель возвращает кодовое слово');
  w.APP.show('start');
  doc.querySelector('#start [data-kind="oge"]').click();
  assert.ok(doc.querySelector('.sheet.oge'), 'повторный выбор бланка на стартовом экране работает');
  assert.deepEqual(errors, []);
  const m = open(t, '?mode=print&kind=oge');
  assert.ok(m.window.document.querySelector('.sheet.oge'), 'ссылка сразу на бланк');
});

test('доска: все шаги вперёд и назад без ошибок, на разных числах', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  for (let round = 0; round < 25; round++) {
    if (round) B.numbers(true);
    const n = B.steps.length;
    assert.equal(n, 12);
    let guard = 0;
    while (!(B.i === n - 1 && B.phase === 1) && guard++ < 100) B.next();
    assert.equal(B.i, n - 1);
    while (!(B.i === 0 && B.phase === 0) && guard++ < 200) B.prev();
    assert.equal(B.i, 0);
    assert.doesNotMatch(w.document.getElementById('board').innerHTML, /undefined|NaN|Infinity/);
    // живые шаги всегда показывают то число, о котором спрашивают
    for (const i of [1, 8, 9, 10]) {
      B.go(i, 1);
      const q = w.document.getElementById('bQ').textContent.replace(/\s+/g, '');
      const m = B.model;
      if (i === 8) assert.ok(q.includes(`√${m.kk * m.kk * m.mm}`), `шаг 9: вопрос про ${m.kk}²·${m.mm}`);
      if (i === 9) assert.ok(q.includes(`Внесимножитель`), 'шаг 10: внесение');
      if (i === 10) assert.ok(q.includes('√' + m.nn), 'шаг 11: сравниваем с √n');
      assert.doesNotMatch(q, /undefined|NaN/);
    }
  }
  assert.deepEqual(errors, []);
});

test('доска: первый пример — квадраты 9 и 4, вынесение √72 = 6√2, внесение 3√8, сравнение 2√7 < √30', t => {
  const { window: w } = open(t, '?mode=board');
  const text = () => w.document.querySelector('.btext').textContent.replace(/\s+/g, '');
  const rec = () => w.document.getElementById('bRec').textContent.replace(/\s+/g, '');
  w.APP.board.go(0, 1);
  assert.match(text(), /6·6=36,значитсторонаквадрата6/);
  assert.match(rec(), /√36=6/);
  w.APP.board.go(1, 1);
  assert.match(rec(), /√9·4=√9·√4=3·2=6/);
  w.APP.board.go(8, 1);
  assert.match(rec(), /√72=√36·2=6√2/);
  w.APP.board.go(9, 1);
  assert.match(rec(), /3√8=√9·8=√72/);
  w.APP.board.go(10, 1);
  assert.match(rec(), /2√7=√28/);
  assert.match(rec(), /28<30/);
  assert.equal(w.document.getElementById('bNote').hidden, true);
  w.document.querySelector('[data-act="notes"]').click();
  assert.equal(w.document.getElementById('bNote').hidden, false);
  assert.ok(w.document.getElementById('bNote').textContent.length > 30);
});

test('доска: на живой доске ручки и ползунки меняют модель, знак сравнения считается заново', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board;
  // шаг 2: стороны малых квадратов
  B.go(1, 0);
  assert.deepEqual([...B.handles.map(h => h.id)].sort(), ['a', 'b']);
  assert.deepEqual([B.model.a, B.model.b], [3, 2]);
  B.drag('a', { x: 190, y: 20 });            // сильно вправо-вверх — сторона выросла до предела
  assert.equal(B.model.a, 6);
  B.key('b', 1, 0);
  assert.equal(B.model.b, 3);
  B.reset();
  assert.deepEqual([B.model.a, B.model.b, B.model.go], [3, 2, 0]);
  // шаг 9: число клеток вдоль стороны
  B.go(8, 0);
  assert.deepEqual([...B.handles.map(h => h.id)], ['kk']);
  B.set('kk', 6);
  assert.equal(B.model.kk, 6);
  assert.match(text(), /√72/);
  // шаг 11: второй квадрат догоняет первый — знак меняется
  B.go(10, 1);
  const rec = () => w.document.getElementById('bRec').textContent.replace(/\s+/g, '');
  assert.match(rec(), /28<30/);
  B.set('nn', 28);
  assert.match(rec(), /28=28/, 'при n = 28 площади равны');
  B.set('nn', 40);
  assert.match(rec(), /28<40/, 'при n = 40 второе число больше');
  B.set('kk', 3);
  assert.match(rec(), /63>40/, 'первое число стало больше');
  B.reset();
  assert.equal(B.model.nn, 30, 'сброс возвращает пример');
  assert.deepEqual(errors, []);
  function text() { return w.document.getElementById('bQ').textContent.replace(/\s+/g, ''); }
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
      solved++;
      h.next();
      if (h.state.finished) h.start({ level, seed: ++seed });
    }
    assert.deepEqual([...types].sort(), [...w.APP.SECTIONS[level].types].sort(), 'встречаются все типы раздела');
  }
  assert.deepEqual(errors, []);
});

function put(h, task) { Object.assign(h.state, { task, wait: false, taskDone: false, hints: 0, hintLevel: 0, eqCount: null }); }

test('тренажёр: типичные ошибки называются', t => {
  const { window: w } = open(t, '?mode=home');
  const { APP } = w, h = APP.home, Q = APP.Q;
  h.start({ level: 0, seed: 1 });
  const find = (type, ok, form) => { const rnd = APP.mulberry32(7); for (;;) { const x = APP.generate(type, rnd, form); if (ok(x)) return x; } };
  const cases = [
    [find('prod', () => true, 'fold'), x => Q(x.a + x.b), 'sum', /не равен сумме/],
    [find('prod', x => x.form === 'sq'), x => Q(x.a * x.a * x.b * x.b), 'noRoot', /Это число под корнем/],
    [find('quot', () => true, 'reduce'), x => Q(x.a, x.b), 'quotFrac', /нужен корень|сократить/],
    [find('quot', () => true, 'divide'), x => Q(x.a / x.b), 'noRoot', /Извлеки корень/],
    [find('out', () => true), x => ({ k: 1, m: x.n }), 'out', /Множитель не вынесен/],
    [find('out', () => true), x => ({ k: x.k, m: x.n / x.k }), 'calc', /Проверим возведением/],
    [find('in', () => true, 'fold'), x => Q(x.k * x.m), 'in', /в квадрате/],
    [find('simpl', () => true), x => ({ k: 1, m: x.k1 * x.k1 * x.m + x.k2 * x.k2 * x.m }), 'sumUnder', /сложил числа под корнем/],
    [find('cmp', () => true), x => expected(x).value === '<' ? '>' : '<', 'cmp', /сравни подкоренные/],
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
  assert.doesNotMatch(String(h.state.task && ''), /undefined/);
});

test('тренажёр: любой неверный ответ получает объяснение с вычислением', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const { APP } = w, h = APP.home, Q = APP.Q;
  h.start({ level: 0, seed: 1 });
  for (const type of Object.keys(APP.TYPES)) {
    const rnd = APP.mulberry32(type.length * 13);
    for (let i = 0; i < 30; i++) {
      const task = APP.generate(type, rnd), e = expected(task).value;
      const wrong = typeof e === 'string' ? (e === '<' ? '>' : '<')
        : typeof e === 'object' && 'k' in e ? { k: e.k + 1, m: e.m }
        : Q(e.n + 7, e.d);
      put(h, task);
      const r = h.check(wrong);
      assert.equal(r.ok, false, type);
      assert.ok(r.cat && r.msg.length > 30, `${type}: ${r.msg}`);
      assert.match(r.msg, /\d/, 'в объяснении есть вычисление');
      assert.doesNotMatch(r.msg, /undefined|NaN/);
    }
  }
  assert.deepEqual(errors, []);
});

test('тренажёр: запись ответа 6√2 и число под корнем принимаются с клавиатуры', t => {
  const { window: w, errors } = open(t, '?mode=home');
  const { APP, document: doc } = w, h = APP.home;
  h.start({ level: 1, seed: 4 });
  const set = (k, v) => { doc.querySelector(`#hStep [data-k="${k}"]`).value = v; };
  put(h, { type: 'out', n: 72, k: 6, m: 2 }); h.setCount(null);
  set('k', '6'); set('m', '2');
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, '6√2 принимается');
  put(h, { type: 'in', form: 'fold', k: 3, m: 8 }); h.setCount(null);
  set('v', '72');
  doc.querySelector('#hStep [data-act="check"]').click();
  assert.equal(h.state.last.ok, true, 'внесение: √72');
  put(h, { type: 'cmp', form: 'A', L: { v: '2√7', sq: 28, line: '' }, R: { v: '√30', sq: 30, line: '' } }); h.setCount(null);
  doc.querySelector('[data-choice="<"]').click();
  assert.equal(h.state.last.ok, true, '2√7 < √30');
  assert.deepEqual(plain(APP.parseVal('6√2')), { m: 72, s: 1 });
  assert.deepEqual(plain(APP.parseQ('2 1/2')), { n: 5, d: 2 });
  assert.deepEqual(errors, []);
});

test('подсказка снимает очки, но не ломает серию', t => {
  const { window: w } = open(t, '?mode=home');
  const h = w.APP.home;
  h.start({ level: 0, seed: 11 });
  assert.ok(h.hint().length > 20);
  h.hint();
  h.check(expected(h.state.task).value);
  assert.equal(h.state.gain, w.APP.CONFIG.home.points[0] - h.state.hints * w.APP.CONFIG.home.hintPenalty);
  assert.equal(h.state.streak, 1);
});
