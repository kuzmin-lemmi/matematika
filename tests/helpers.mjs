import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

// Внешние ресурсы не загружаются: проверяем только локальный код материала.
export function loadHtml(html, { query = '', beforeParse, slug = 'test' } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  virtualConsole.on('error', (...args) => errors.push(new Error(args.map(String).join(' '))));
  const dom = new JSDOM(html, {
    url: `https://example.test/materials/${slug}.html${query}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse,
  });
  return { window: dom.window, errors, close: () => dom.window.close() };
}

export function loadMaterial(slug, options = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Укажи slug материала: латиница, цифры и дефисы.');
  }
  const file = new URL(`../public/materials/${slug}.html`, import.meta.url);
  return loadHtml(readFileSync(file, 'utf8'), { ...options, slug });
}
