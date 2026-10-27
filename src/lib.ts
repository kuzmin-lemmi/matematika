import { SUBJECTS } from './config';

// Ссылка на сам материал: файл на сайте или внешний адрес
export const openHref = (url: string) => /^https?:\/\//.test(url) ? url : import.meta.env.BASE_URL + url;
export const pageHref = (id: string) => `${import.meta.env.BASE_URL}item/${id}/`;
// Материал лежит на сайте одним HTML-файлом — такой открываем через постоянный адрес /zapusk/<slug>/
export const isLocalFile = (url: string) => !/^https?:\/\//.test(url) && url.endsWith('.html');
// Материал можно открыть: он уже опубликован (не «скоро») и есть файл или внешний адрес
export const isReady = (d: { url: string; access: string }) => d.access !== 'soon';
// Ссылка «Открыть»: для файлов на сайте — /zapusk/<slug>/ (не прямой файл), для внешних — их адрес.
// mode — сразу открыть режим материала: board | print | home
export const openPageHref = (item: { id: string; data: { url: string } }, mode?: string) =>
  isLocalFile(item.data.url)
    ? `${import.meta.env.BASE_URL}zapusk/${item.id}/${mode ? `?mode=${mode}` : ''}`
    : openHref(item.data.url);
// Другой вид листа раздатки (поле sheets карточки): режим «Раздатка» сразу с нужным листом
export const sheetHref = (item: { id: string; data: { url: string } }, kind: string) => `${openPageHref(item, 'print')}&kind=${kind}`;
// Ссылка для учеников — в чат класса: тренажёр «Дома» на весь экран, закрытый (student=1):
// без выхода на сайт и к доске и раздатке. Пусто, если у материала нет режима «Дома».
export const studentHref = (item: { id: string; data: { url: string; access: string; parts: string[] } }, site?: URL) =>
  isReady(item.data) && isLocalFile(item.data.url) && item.data.parts.includes('home')
    ? new URL(`${openPageHref(item, 'home')}&student=1`, site).toString()
    : '';
export const klassHref = (g: number) => `${import.meta.env.BASE_URL}klass/${g}/`;
export const klassName = (g: number) => `${g} класс`;
// подряд идущие классы — диапазоном: [5, 6, 7, 8, 9] → «5–9 классы», [7] → «7 класс»
export const gradeLabel = (g: number[]) => {
  if (!g.length) return '';
  const s = [...g].sort((a, b) => a - b);
  if (s.length === 1) return `${s[0]} класс`;
  const run = s.every((x, i) => i === 0 || x === s[i - 1] + 1);
  return run ? `${s[0]}–${s[s.length - 1]} классы` : s.map(x => `${x} класс`).join(', ');
};
export const subjectLabel = (s?: keyof typeof SUBJECTS) => s ? SUBJECTS[s].label : '';
// Предметы класса по программе: 5–6 — математика, 7–9 — алгебра и геометрия
export const gradeSubjects = (g: number): (keyof typeof SUBJECTS)[] => g <= 6 ? ['math'] : ['algebra', 'geometry'];
// Скачивание одним HTML-файлом — только для опубликованных бесплатных материалов, лежащих на сайте
export const downloadHref = (d: { url: string; access: string }) =>
  d.access === 'free' && isLocalFile(d.url) ? openHref(d.url) : '';
export const downloadName = (url: string) => url.split('/').pop() ?? url;
// Цвет материала → читаемые варианты (контраст ≥ 4.6:1, WCAG AA с запасом):
// --cb — для кнопок и текста на светлой бумаге (затемняем), --cd — для текста на тёмном листе (осветляем)
const channel = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const toRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const shift = (hex: string, against: number[]) => {
  const from = toRgb(hex), to = against[0] > 127 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1; t += 0.02) {
    const c = from.map((v, i) => v + (to[i] - v) * t);
    if (contrast(c, against) >= 4.6) return toHex(c);
  }
  return toHex(to);
};
export const colorVars = (hex: string) =>
  `--c:${hex};--cb:${shift(hex, [255, 253, 248])};--cd:${shift(hex, [32, 51, 43])}`;
// Картинка превью ссылки — карточка с названием материала, собранная при сборке (src/pages/og/[id].png.ts)
export const ogImage = (item: { id: string }) => `og/${item.id}.png`;
