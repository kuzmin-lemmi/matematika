import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'instrumenty-doski';
const open = (t, query = '') => { const m = loadMaterial(SLUG, { query }); t.after(m.close); return m; };
// повторяемые «случайные» числа для проверки выбора и деления
const seq = list => { let i = 0; return () => list[i++ % list.length]; };

test('открывается без ошибок: каждая вкладка, адрес ?tool=…, превью', t => {
  const { window: w, errors } = open(t);
  for (const name of w.APP.TOOLS) {
    w.APP.show(name);
    assert.equal(w.APP.tool, name);
    assert.equal(w.document.getElementById('t-' + name).hidden, false, name);
    assert.doesNotMatch(w.document.getElementById('t-' + name).innerHTML, /NaN|undefined/, name);
  }
  assert.deepEqual(errors, []);
  assert.equal(open(t, '?tool=coord').window.APP.tool, 'coord');
  assert.equal(open(t, '?tool=nonsense').window.APP.tool, 'timer');
  const pv = open(t, '?preview=1');
  assert.equal(pv.window.APP.tool, 'timer');
  assert.equal(pv.window.APP.timer.state.run, true, 'в превью идёт таймер');
  assert.deepEqual(pv.errors, []);
});

test('таймер: идёт по часам, пауза, конец, ±30 секунд, секундомер', t => {
  const { window: w } = open(t);
  const T = w.APP.timer;
  T.set(1);
  assert.equal(T.text(), '01:00');
  T.start(1000);
  T.tick(1000 + 15500);
  assert.equal(T.text(), '00:45', 'округление вверх: 44,5 с — это ещё 45');
  T.pause(1000 + 20000);
  assert.equal(T.state.run, false);
  assert.equal(T.text(), '00:40');
  T.start(50000);
  T.tick(50000 + 41000);
  assert.equal(T.state.left, 0);
  assert.equal(T.state.done, true);
  assert.equal(T.state.run, false, 'в конце таймер останавливается');
  T.reset(); T.add(30);
  assert.equal(T.text(), '01:30');
  T.add(-120);
  assert.equal(T.state.left, 0, 'не уходит в минус');
  T.mode('up');
  T.start(0); T.tick(65000);
  assert.equal(T.text(), '01:05');
  T.reset();
  assert.equal(T.text(), '00:00');
});

test('кто отвечает: без повторов, отсутствующие не выпадают, потом «все уже отвечали»', t => {
  const { window: w } = open(t, '?tool=pick');
  const doc = w.document, K = w.APP.pick;
  doc.getElementById('clN').value = '6';
  doc.getElementById('clAbsent').value = '2, 5, 99, x';
  K.readClass();
  assert.deepEqual([...K.state.absent], [2, 5], 'номера больше числа учеников и мусор отброшены');
  const rand = seq([0, .99, .5, .3]);
  const got = [];
  for (let i = 0; i < 4; i++) got.push(K.choose(rand));
  assert.deepEqual([...got].sort(), [1, 3, 4, 6], 'каждый присутствующий — ровно один раз');
  assert.equal(K.choose(rand), null, 'больше некого');
  K.reset();
  assert.equal(K.pool().length, 4);
  // с повторами пул не уменьшается
  doc.getElementById('pkNoRepeat').checked = false;
  K.choose(rand); K.choose(rand);
  assert.equal(K.pool().length, 4);
});

test('группы: все присутствующие, без повторов, размеры отличаются не больше чем на 1', t => {
  const { APP } = open(t).window;
  const people = Array.from({ length: 23 }, (_, i) => i + 1).filter(x => x !== 7);
  for (const [by, k, count] of [['count', 4, 4], ['count', 5, 5], ['size', 3, 8], ['size', 4, 6], ['count', 30, 22]]) {
    const g = APP.groups.split(people, by, k, seq([.1, .7, .4, .9, .2]));
    assert.equal(g.length, count, `${by} ${k}`);
    const all = Array.from(g.flat()).sort((a, b) => a - b);
    assert.deepEqual(all, people, 'никто не потерян и не повторён');
    const sizes = g.map(x => x.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${by} ${k}: ${sizes}`);
  }
});

test('клетка: линии рисуются, отменяются, стираются ластиком', t => {
  const { window: w, errors } = open(t, '?tool=grid');
  const G = w.APP.grid, svg = () => w.document.getElementById('gdSvg');
  G.begin({ x: 100, y: 100 }); G.move({ x: 200, y: 150 }); G.move({ x: 300, y: 120 });
  G.begin({ x: 800, y: 500 }); G.move({ x: 900, y: 520 });
  w.APP.show('grid');
  assert.equal(svg().querySelectorAll('path.stroke').length, 2);
  G.undo();
  assert.equal(G.state.strokes.length, 1);
  G.erase({ x: 205, y: 152 });
  assert.equal(G.state.strokes.length, 0, 'ластик рядом с линией стирает её');
  G.begin({ x: 1, y: 1 }); G.clear();
  assert.equal(G.state.strokes.length, 0);
  assert.deepEqual(errors, []);
});

test('числовая прямая: точки «прилипают» к делениям, буквы по порядку, прямая масштабируется', t => {
  const { window: w } = open(t, '?tool=line');
  const L = w.APP.line;
  L.state.sub = 4;
  assert.equal(L.add(1.3).v, 1.25);
  assert.equal(L.add(-2.9).v, -3);
  assert.equal(L.add(1.26), null, 'в ту же точку вторую не ставим');
  assert.deepEqual(Array.from(L.state.points, p => p.name), ['A', 'B']);
  // экран и число переводятся друг в друга
  for (const v of [-5, -1.5, 0, 3.25, 5]) assert.ok(Math.abs(L.v(L.x(v)) - v) < 1e-9);
  L.cmd('zoomin');
  assert.deepEqual([L.state.from, L.state.to], [-3, 3], 'приближение симметрично');
  L.cmd('right');
  assert.ok(L.state.from > -3);
  L.range(4, 4);
  assert.ok(L.state.to - L.state.from >= 2, 'диапазон не схлопывается');
  L.range(-5, 5);
  w.document.getElementById('nlShow').click();
  assert.equal(L.state.show, false);
  assert.match(w.document.getElementById('nlStage').textContent, /A/);
  assert.doesNotMatch(w.document.getElementById('nlStage').textContent, /1,25/, 'координаты скрыты');
});

test('координаты: узлы сетки, через 0,5, соединение точек и возврат в первую точку', t => {
  const { window: w } = open(t, '?tool=coord');
  const C = w.APP.coord;
  assert.deepEqual({ ...C.add(2.4, -3.6) }, { x: 2, y: -4, name: 'A' });
  assert.equal(C.add(2.2, -4.1), null, 'повтор без соединения не ставится');
  C.state.half = true;
  const b = C.add(1.3, 0.8);
  assert.deepEqual([b.x, b.y], [1.5, 1]);
  assert.equal(C.add(40, -40).x, C.state.r, 'за границей — на краю');
  C.state.link = true;
  const back = C.add(2, -4);
  assert.equal(back.dup, true);
  assert.equal(back.name, 'A', 'возврат в A — та же буква');
  C.render();
  const text = w.document.getElementById('cpStage').textContent;
  assert.equal((text.match(/A\(/g) || []).length, 1, 'подпись A одна');
  assert.match(text, /A\(2; −4\)/, 'координаты через точку с запятой, минус — длинный');
  w.APP.poster();
  assert.equal(C.state.points.length, 6);
  assert.ok(w.document.querySelector('#cpStage polyline'));
});

test('транспортир: угол «прилипает» к шагу, от 0 до 180', t => {
  const { window: w } = open(t, '?tool=prot');
  const R = w.APP.prot;
  R.set(62); assert.equal(R.state.angle, 60);
  w.document.getElementById('prSnap').value = '1';
  w.document.getElementById('prSnap').dispatchEvent(new w.Event('change'));
  R.set(62.4); assert.equal(R.state.angle, 62);
  R.set(-30); assert.equal(R.state.angle, 0);
  R.set(250); assert.equal(R.state.angle, 180);
  R.set(73);
  assert.match(w.document.getElementById('prStage').textContent, /73°/);
  w.document.getElementById('prVal').click();
  assert.doesNotMatch(w.document.getElementById('prStage').textContent, /73°/, 'величину можно скрыть');
});

test('«На сайт» ведёт на страницу инструментов, имена учеников не хранятся', t => {
  const { window: w } = open(t);
  const a = w.document.getElementById('toSite');
  assert.equal(a.hidden, false);
  assert.equal(a.getAttribute('href'), `https://example.test/item/${SLUG}/`);
  // в хранилище — только число учеников и номера отсутствующих
  w.document.getElementById('clAbsent').value = '4';
  w.document.getElementById('clAbsent').dispatchEvent(new w.Event('change'));
  const keys = Object.keys(w.localStorage).filter(k => k.startsWith('matshag:tools:'));
  for (const k of keys) assert.doesNotMatch(w.localStorage.getItem(k), /[А-Яа-я]{3,}/, k);
});
