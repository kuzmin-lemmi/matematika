import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHtml, loadMaterial } from './helpers.mjs';

test('загрузчик выполняет скрипт с параметрами режима и превью', t => {
  const material = loadHtml(`<script>
    const params = new URLSearchParams(location.search);
    window.APP = { mode: params.get('mode'), preview: params.get('preview') === '1' };
  </script>`, { query: '?mode=board&preview=1' });
  t.after(material.close);
  assert.equal(material.window.APP.mode, 'board');
  assert.equal(material.window.APP.preview, true);
  assert.deepEqual(material.errors, []);
});

test('загрузчик собирает исключения и ошибки консоли', t => {
  const material = loadHtml(`<script>console.error('Ошибка материала');</script>
    <script>throw new Error('Ошибка запуска');</script>`);
  t.after(material.close);
  assert.equal(material.errors.length, 2);
  assert.match(material.errors[0].message, /Ошибка материала/);
  assert.match(material.errors[1].message, /Ошибка запуска/);
});

test('можно проверить работу без localStorage', t => {
  const material = loadHtml(`<script>
    try { localStorage.setItem('record', '10'); } catch {}
    window.APP = { ready: true };
  </script>`, {
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new Error('Хранилище недоступно'); },
      });
    },
  });
  t.after(material.close);
  assert.equal(material.window.APP.ready, true);
  assert.deepEqual(material.errors, []);
});

test('загрузчик материала отклоняет путь вместо slug', () => {
  assert.throws(() => loadMaterial('../README'), /slug/);
});
