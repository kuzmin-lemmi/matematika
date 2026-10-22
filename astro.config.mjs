import { defineConfig } from 'astro/config';

// Пока своего домена нет, сайт живёт на GitHub Pages по адресу kuzmin-lemmi.github.io/matematika/.
// Когда автор купит домен: site — 'https://домен.ru', base — '/' (или переменные окружения SITE_URL и BASE).
export default defineConfig({
  site: process.env.SITE_URL || 'https://kuzmin-lemmi.github.io',
  base: process.env.BASE || '/matematika/',
  trailingSlash: 'always',
});
