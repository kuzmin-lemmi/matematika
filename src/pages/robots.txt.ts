// Правила для поисковиков: индексировать страницы, но не сами файлы материалов —
// наружу уходят /item/ и /zapusk/, а не прямые ссылки на materials/*.html. Карта сайта — sitemap.xml
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(import.meta.env.BASE_URL + 'sitemap.xml', site);
  const materials = import.meta.env.BASE_URL + 'materials/';
  return new Response(`User-agent: *\nAllow: /\nDisallow: ${materials}\n\nSitemap: ${sitemap}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
