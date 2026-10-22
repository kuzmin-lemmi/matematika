import { defineConfig } from 'astro/config';

// Сайт живёт на своём домене matshag.ru (GitHub Pages, домен куплен на Beget).
// Для временной публикации по другому адресу — переменные окружения SITE_URL и BASE.
export default defineConfig({
  site: process.env.SITE_URL || 'https://matshag.ru',
  base: process.env.BASE || '/',
  trailingSlash: 'always',
});
