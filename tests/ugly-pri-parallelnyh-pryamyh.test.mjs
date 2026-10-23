import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMaterial } from './helpers.mjs';

const SLUG = 'ugly-pri-parallelnyh-pryamyh';
const open = (t, query = '') => { const m = loadMaterial(SLUG, { query }); t.after(m.close); return m; };

// Независимая проверка по координатам модели (jsdom не считает раскладку):
// угол между лучами из вершины V к точкам P и Q, в градусах
const angleAt = (V, P, Q) => {
  const a = Math.atan2(-(P.y - V.y), P.x - V.x), b = Math.atan2(-(Q.y - V.y), Q.x - V.x);
  let d = Math.abs(a - b) * 180 / Math.PI;
  return d > 180 ? 360 - d : d;
};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);

test('материал открывается без ошибок: стартовый экран, доска, превью', t => {
  for (const q of ['', '?mode=board', '?mode=board&preview=1']) {
    const m = open(t, q);
    assert.deepEqual(m.errors, [], q);
    assert.ok(m.window.APP, q);
  }
  assert.equal(open(t, '').window.APP.screen, 'start');
  assert.equal(open(t, '?mode=board').window.APP.screen, 'board');
});

test('модель: B на секущей, углы совпадают с геометрией чертежа', t => {
  const { APP } = open(t, '?mode=board').window;
  for (const phi of [0, -15, 10, 25]) for (let th = 30; th <= 150; th += 5) {
    APP.M.phi = phi; APP.M.theta = th;
    if (th - phi < 20 || th - phi > 160) continue;
    const g = APP.geom(), ang = APP.angles();
    // B лежит на секущей: векторы AB и направление секущей коллинеарны
    const cross = (g.B.x - g.A.x) * g.ds.y - (g.B.y - g.A.y) * g.ds.x;
    assert.ok(Math.abs(cross) < 1e-6, 'B на секущей');
    // ∠1: между лучом прямой a вправо и секущей вверх; ∠5: между лучом b вправо и секущей вверх от B
    const up = (V, k) => ({ x: V.x + k * g.ds.x, y: V.y + k * g.ds.y });
    near(ang[0], angleAt(g.A, { x: g.A.x + 100, y: g.A.y }, up(g.A, 100)), `∠1 при θ=${th}, φ=${phi}`);
    near(ang[4], angleAt(g.B, { x: g.B.x + 100 * g.db.x, y: g.B.y + 100 * g.db.y }, up(g.B, 100)), `∠5 при θ=${th}, φ=${phi}`);
    // при каждой вершине углы в сумме 360°, смежные — 180°
    near(ang.slice(0, 4).reduce((s, x) => s + x, 0), 360, 'углы при A');
    near(ang.slice(4).reduce((s, x) => s + x, 0), 360, 'углы при B');
    // сектор угла имеет ту же величину, что и угол
    for (let k = 1; k <= 8; k++) { const [s, e] = APP.sector(k); near(e - s, ang[k - 1], `сектор ∠${k}`); }
  }
});

test('при a ∥ b: накрест лежащие и соответственные равны, сумма односторонних 180°', t => {
  const { APP } = open(t, '?mode=board').window;
  APP.M.phi = 0;
  for (let th = 30; th <= 150; th += 5) {
    APP.M.theta = th;
    const a = APP.angles();
    for (const [i, j, k] of APP.PAIRS) {
      if (k === 'k3') near(a[i - 1] + a[j - 1], 180, `односторонние ${i} и ${j}`);
      else near(a[i - 1], a[j - 1], `${APP.KIND[k]} ${i} и ${j}`);
    }
  }
  // без параллельности равенства пропадают
  APP.M.phi = -15; APP.M.theta = 65;
  const a = APP.angles();
  assert.notEqual(a[2], a[4], '∠3 ≠ ∠5');
  assert.notEqual(a[3] + a[4], 180, '∠4 + ∠5 ≠ 180°');
});

test('пары углов названы как в учебнике', t => {
  const { APP } = open(t).window;
  const names = Array.from(APP.PAIRS, ([i, j, k]) => `${i}-${j}:${APP.KIND[k]}`);
  assert.deepEqual(names, [
    '3-5:накрест лежащие', '4-6:накрест лежащие', '4-5:односторонние', '3-6:односторонние',
    '1-5:соответственные', '2-6:соответственные', '3-7:соответственные', '4-8:соответственные',
  ]);
});

test('поворот «прилипает» к 5° и не выходит за пределы', t => {
  const { APP } = open(t, '?mode=board').window;
  APP.M.phi = 0;
  APP.setTheta(63); assert.equal(APP.M.theta, 65);
  APP.setTheta(12); assert.equal(APP.M.theta, APP.CONFIG.thetaMin);
  APP.setTheta(175); assert.equal(APP.M.theta, APP.CONFIG.thetaMax);
  APP.setTheta(65);
  APP.setPhi(7); assert.equal(APP.M.phi, 5);
  APP.setPhi(-80); assert.equal(APP.M.phi, -APP.CONFIG.tiltMax);
  // угол при B не вырождается: θ − φ не больше 160°
  APP.setTheta(150); APP.setPhi(-30);
  assert.ok(APP.M.theta - APP.M.phi <= 160);
});

test('доска: все шаги вперёд и назад, чертёж на каждом шаге, без ошибок', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board, doc = w.document;
  for (const th of [65, 40, 120, 145]) {
    w.APP.M.theta = th;
    B.go(0, 0);
    let guard = 0;
    while (!(B.i === B.steps.length - 1 && B.phase === 1) && guard++ < 100) {
      B.next();
      assert.ok(doc.querySelector('#bStage svg line'), 'прямые нарисованы');
      assert.doesNotMatch(doc.getElementById('board').innerHTML, /NaN|undefined|Infinity/);
    }
    assert.equal(B.steps.length, 12);
    while (!(B.i === 0 && B.phase === 0) && guard++ < 200) B.prev();
    assert.equal(B.i, 0);
  }
  assert.deepEqual(errors, []);
});

test('шаг «не параллельны» наклоняет b, шаги со свойствами — возвращают параллельность', t => {
  const { window: w } = open(t, '?mode=board');
  const B = w.APP.board, M = w.APP.M;
  B.go(8, 0);
  assert.notEqual(M.phi, 0, 'b наклонена');
  assert.ok(w.document.querySelector('[data-drag="phi"]'), 'есть ручка наклона');
  // признак: наклоняем, пока ∠3 = ∠5 — появляется «a ∥ b»
  B.go(9, 0);
  w.APP.setPhi(0); B.go(9, 1);
  assert.match(w.document.getElementById('bStage').textContent, /a ∥ b/);
  B.go(10, 0);
  assert.equal(M.phi, 0, 'дальше снова параллельные');
});

test('шаг с вопросом о паре: «другая пара» меняет пару, ответ называет её вид', t => {
  const { window: w } = open(t, '?mode=board');
  const B = w.APP.board;
  B.go(4, 0);
  const before = B.quiz;
  B.shuffle();
  assert.notEqual(B.quiz, before);
  B.go(4, 1);
  const [i, j, k] = w.APP.PAIRS[B.quiz];
  assert.match(w.document.getElementById('bA').textContent, new RegExp(`∠${i} и ∠${j} — ${w.APP.KIND[k]}`));
});

test('задача: ∠6 = 180° − ∠1, запись в тетради с обоснованием', t => {
  const { window: w } = open(t, '?mode=board');
  w.APP.M.theta = 70;
  w.APP.board.go(11, 1);
  assert.match(w.document.getElementById('bA').textContent, /∠6 = 110°/);
  assert.match(w.document.getElementById('bRec').textContent, /соответственные.*смежный/);
});

// В jsdom нет matchMedia — движение сразу приходит в конечное состояние; проверяем, куда оно приводит
test('движение по «Показать ответ» доходит до нужного состояния', t => {
  const { window: w, errors } = open(t, '?mode=board');
  const B = w.APP.board, M = w.APP.M;
  B.go(3, 0); B.next();          // сдвиг прямой a к b
  assert.equal(B.ghost, null, 'копия прямой a убрана после сдвига');
  assert.equal(B.moving, false);
  M.theta = 65;
  B.go(6, 0); B.next();          // секущая покачивается и возвращается
  assert.equal(M.theta, 65, 'после покачивания секущая на месте');
  B.go(7, 0); B.next();          // поворот ∠3 на ∠5
  assert.equal(B.ghost, null);
  B.go(9, 0);
  assert.notEqual(M.phi, 0, 'на шаге с признаком b сначала наклонена');
  B.next();
  assert.equal(M.phi, 0, 'по «Показать ответ» b выпрямляется: a ∥ b');
  B.go(4, 0);                    // «другой угол» на обычном шаге — кратный 5°, не 90°
  B.go(5, 0);
  for (let k = 0; k < 20; k++) {
    B.shuffle();
    assert.equal(M.theta % 5, 0);
    assert.notEqual(M.theta, 90);
  }
  assert.deepEqual(errors, []);
});

test('стартовый экран: ссылка «Назад на сайт», режимы «скоро» неактивны', t => {
  const { window: w } = open(t, '');
  const a = w.document.getElementById('toSite');
  assert.equal(a.hidden, false);
  assert.equal(a.getAttribute('href'), `https://example.test/item/${SLUG}/`);
  assert.equal(w.document.querySelectorAll('.mode[disabled]').length, 2);
});
