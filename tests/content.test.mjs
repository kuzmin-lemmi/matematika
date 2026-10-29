// Карточки материалов: ссылки на файлы и картинки живые, order в полосе своего класса,
// кнопки на сайте обещают только то, что материал умеет. Привязки к плану уроков проверяет lesson-plan.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const dir = new URL('../src/content/items/', import.meta.url);
const pub = new URL('../public/', import.meta.url);
const cards = readdirSync(dir).filter(f => f.endsWith('.md')).map(file => ({
  slug: file.replace(/\.md$/, ''),
  data: parse(readFileSync(new URL(file, dir), 'utf8').split('---')[1]),
}));
const local = url => !/^https?:\/\//.test(url);

test('файлы материалов, картинки и ролики из карточек существуют', () => {
  for (const { slug, data } of cards) {
    if (local(data.url)) assert.ok(existsSync(new URL(data.url, pub)), `${slug}: нет файла public/${data.url}`);
    if (data.poster) {
      assert.ok(existsSync(new URL(data.poster, pub)), `${slug}: нет картинки public/${data.poster}`);
      const dark = data.poster.replace(/(\.\w+)$/, '-dark$1');
      assert.ok(existsSync(new URL(dark, pub)), `${slug}: нет тёмной картинки public/${dark}`);
    }
    if (data.video) assert.ok(existsSync(new URL(data.video, pub)), `${slug}: нет ролика public/${data.video}`);
  }
});

test('order в полосе своего класса, курсы и приложения — 900+', () => {
  for (const { slug, data } of cards) {
    if (data.order === undefined) continue;
    if (data.type === 'lesson') assert.ok(data.grades.includes(Math.floor(data.order / 100) + 4), `${slug}: order ${data.order} не в полосе классов ${data.grades}`);
    else assert.ok(data.order >= 900, `${slug}: у ${data.type} order должен быть 900+`);
  }
});

test('у урока есть предмет, файл материала совпадает со slug', () => {
  for (const { slug, data } of cards) {
    if (data.type === 'lesson') assert.ok(data.subject, `${slug}: у материала к уроку не указан subject`);
    if (local(data.url)) assert.equal(data.url, `materials/${slug}.html`, `${slug}: url не совпадает с именем карточки`);
  }
});

test('кнопки карточки есть в самом материале: листы раздатки и ссылка для учеников', () => {
  for (const { slug, data } of cards) {
    if (!local(data.url)) continue;
    const html = readFileSync(new URL(data.url, pub), 'utf8');
    for (const { kind } of data.sheets ?? []) assert.match(html, new RegExp(`['"]${kind}['"]`), `${slug}: материал не знает лист kind=${kind}`);
    if ((data.parts ?? []).includes('home')) assert.match(html, /\bSTUDENT\b/, `${slug}: есть режим «Дома», но материал не читает ?student=1`);
  }
});
