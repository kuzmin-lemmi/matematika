# Техника материалов

Как сделать то, что требуют `AGENTS.md` и `docs/FORMATS.md`, в одном HTML-файле без библиотек.
Код ниже — образцы; общий шаблон материала собирается вместе с первым пилотом (`docs/ROADMAP.md`, этап 1).

## Адрес и режимы

```js
const P = new URLSearchParams(location.search);
const MODE = ['board', 'print', 'home'].includes(P.get('mode')) ? P.get('mode') : null;   // null — стартовый экран
const PREVIEW = P.get('preview') === '1';   // превью на сайте: без звука, без фокуса, доска показывает движение сама
```

Скачанный файл открывают без параметров — тогда стартовый экран. Страница `/zapusk/<slug>/` передаёт
материалу свои параметры (`?mode=…`) — см. `src/pages/zapusk/[id].astro`.

## Генератор и номер варианта

Задания генерируются только из зерна — **никакого `Math.random()` внутри генераторов**, иначе номер варианта
перестанет восстанавливать вариант. `Math.random()` допустим только для выбора нового номера.

```js
// mulberry32: быстрый генератор псевдослучайных чисел по зерну (тот же, что в «Инфошаге», контрольная 5 класса)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// задание i варианта n: своё зерно на каждое задание, чтобы смена одного типа не сдвигала остальные
const taskRnd = (n, i) => mulberry32(GEN_VERSION * 1000003 + n * 7919 + i * 104729 + 1);

// генерация с отсевом вырожденных случаев: bad() описывает, что не годится
function generate(type, rnd, tries = 500) {
  for (let k = 0; k < tries; k++) {
    const t = T[type].gen(rnd);
    if (!T[type].bad?.(t)) return t;
  }
  throw new Error('Генератор не нашёл задание: ' + type);
}
```

Номер варианта на листе — `«2-4817»`: версия генератора и число 1000–9999. При изменении генератора
версию увеличиваем, а старую ветку оставляем, пока на неё есть напечатанные листы.

## Точная арифметика

- **Обыкновенные дроби — только пары целых**, никаких десятичных приближений:

```js
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const add = (x, y) => frac(x.n * y.d + y.n * x.d, x.d * y.d);
const mul = (x, y) => frac(x.n * y.n, x.d * y.d);
```

- **Десятичные дроби** — в целых долях (сотых, тысячных), чтобы не получить `0.1 + 0.2 = 0.30000000000000004`.
  Для вывода — округление до нужного разряда.
- **Запись по-русски:** десятичная запятая, минус `−` (U+2212), умножение `·`.

```js
const fmt = x => String(x).replace('.', ',').replace('-', '−');
// ввод: запятая или точка, любой минус, пробелы внутри — допустимы
const parseNum = s => {
  const t = String(s).replace(/\s+/g, '').replace(',', '.').replace(/[−–]/g, '-');
  return t === '' || isNaN(+t) ? null : +t;
};
```

## Запись формул без библиотек

```html
<span class="frac" aria-label="3/4"><span>3</span><span>4</span></span>
```

```css
.frac{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.1;margin:0 .12em}
.frac > :last-child{border-top:.08em solid currentColor;padding:0 .15em;align-self:stretch;text-align:center}
.var{font-style:italic}
.root{border-top:.08em solid currentColor;padding-left:.1em}   /* √<span class="root">a + b</span> */
```

- Степени — `<sup>`, смешанное число — целая часть и `.frac` рядом.
- Поле ввода дроби — два `<input inputmode="numeric">` этажом в той же разметке `.frac`.
- **Шрифт:** проверить, что в выбранном шрифте есть `∠ △ ∥ ⊥ − · ² ³ √ π °`; запасные — `'Cambria Math', 'Segoe UI Symbol'`.
  На школьных компьютерах Windows смотреть особенно внимательно.

## Проверка выражений (пошаговый ввод в алгебре)

Две записи равносильны, если совпадают в нескольких случайных точках:

1. Свой маленький разборщик: числа (с запятой), переменные из одной латинской буквы, `+ − · * / ^`, скобки,
   неявное умножение (`2x`, `3(x + 1)`, `(a + b)(a − b)`). Результат — дерево выражения.
2. Вычислить обе записи в 6–8 точках: переменным — «неудобные» значения (например, 1,37 и −2,61), чтобы совпадения
   не были случайными. Сравнение с относительной погрешностью 1e-9.
3. Точки, где знаменатель обращается в ноль (`NaN`, `Infinity`), пропускать; если годных точек меньше пяти — взять новые.
4. **Форму** ответа проверять по дереву отдельно: «раскрой скобки» — в ответе нет произведения сумм;
   «разложи на множители» — верхний узел — произведение.

Так система говорит не только «неверно», но и «строка 3 не равна строке 2» — ученик видит, где ошибся.

## Чертежи на SVG

- **Модель отдельно от рисунка:** точки, прямые и углы — в объекте модели в математических координатах;
  отрисовка — функция `render(model)`. Тесты проверяют модель (jsdom не считает размеры).
- Перевод координат: `sx = ox + x * k`, `sy = oy − y * k` (ось y на экране направлена вниз).
- **Перетаскивание** — Pointer Events, работает с мышью, пальцем и пером интерактивной доски:

```js
svg.style.touchAction = 'none';
handle.addEventListener('pointerdown', e => { handle.setPointerCapture(e.pointerId); drag = point; });
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  Object.assign(drag, snap(toModel(p)));   // «прилипание» к удобным значениям
  render(model);
});
svg.addEventListener('pointerup', () => { drag = null; });
```

- **Дужка угла** между лучами VA и VB (в экранных координатах):

```js
function angleArc(V, A, B, r) {
  const a1 = Math.atan2(A.y - V.y, A.x - V.x), a2 = Math.atan2(B.y - V.y, B.x - V.x);
  const p1 = [V.x + r * Math.cos(a1), V.y + r * Math.sin(a1)];
  const p2 = [V.x + r * Math.cos(a2), V.y + r * Math.sin(a2)];
  // направление обхода по знаку векторного произведения — дужка всегда по меньшему углу
  const cross = (A.x - V.x) * (B.y - V.y) - (A.y - V.y) * (B.x - V.x);
  return `M${p1} A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${p2}`;
}
```

- Подпись угла — по биссектрисе: `V + norm(uA + uB) · (r + 14)`, где uA, uB — единичные векторы лучей.
- «Прилипание»: углы — к 5°, длины — к целым, точки — к узлам сетки, если это не мешает показу.

## Доска

- Весь экран: `document.documentElement.requestFullscreen()` в `try/catch`; обёртка `/zapusk/` разрешает его (`allow="fullscreen"`).
- Размеры — через `clamp()` и `vmin`; чертёж — SVG с `viewBox`, он сам масштабируется под проектор.
- Клавиши: `→`, `Пробел`, `PageDown` — «Далее»; `←`, `PageUp` — «Назад»; `F` — весь экран; `Esc` — меню.

## Печать

```css
@page { size: A4; margin: 12mm; }
@media print {
  body { background: #fff; color: #000; font-size: 12pt; }
  .no-print { display: none !important; }
  .task { break-inside: avoid; }
  .sheet { break-after: page; }
  .cells { print-color-adjust: exact; -webkit-print-color-adjust: exact; }   /* сетка «в клетку» */
}
```

- Печать — кнопкой «Печать» (`window.print()`); внутри обёртки `/zapusk/` печатается сам материал — проверить
  в Chrome и Яндекс Браузере.
- Сетка 5 мм для решения: фон `linear-gradient` с шагом `5mm`, светло-серые линии.
- Лист на экране показывать так же, как он выйдет на бумаге (предпросмотр прямо в материале).

## Автотесты (node:test + jsdom)

`jsdom` — dev-зависимость, тесты лежат в `tests/`, запуск — `node --test tests/`.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../public/materials/slozhenie-drobei.html', import.meta.url), 'utf8');
const load = (query = '') => new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://example.test/materials/slozhenie-drobei.html' + query,
}).window;

test('раздатка: один номер — один и тот же вариант', () => {
  const w = load('?mode=print');
  assert.deepEqual(w.APP.makeVariant(4817), w.APP.makeVariant(4817));
});
```

- `const` и `let` верхнего уровня **не видны** как свойства `window` — функции и состояние, нужные тестам,
  собирай в объект `window.APP` (или объявляй через `function`/`var`).
- jsdom не считает раскладку: `getBBox()` нет, размеры — нули. Геометрию проверяй по модели.
- Ответы для ключа в тесте считай **независимо** от кода материала (своей короткой функцией), иначе тест повторит ошибку.

## Превью на сайте

Сайт показывает материал в карточке уменьшенным iframe с `?mode=board&preview=1` и тем же адресом
снимает картинку (`npm run posters`). В режиме превью материал:
- не включает звук и не забирает фокус;
- сразу показывает доску в движении (например, медленно поворачивает секущую), а не стартовый экран.
