// Карта сайта для Яндекса и Google: все опубликованные страницы, кроме 404, картинок превью и материалов «скоро»
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isLocalFile, isReady } from '../lib';
import { SITE } from '../config';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const items = (await getCollection('items')).filter(i => isReady(i.data));
  const lessons = items.filter(i => i.data.type === 'lesson');
  const grades = SITE.grades.filter(g => lessons.some(i => i.data.grades.includes(g)));   // пустые классы в карту не попадают
  const day = (d?: Date) => d?.toISOString().slice(0, 10);
  const urls: [string, string?][] = [
    ['', undefined],
    ['catalog/', undefined],
    ['poisk/', undefined],
    ...grades.map(g => [`klass/${g}/`] as [string]),
    ...items.map(i => [`item/${i.id}/`, day(i.data.updated ?? i.data.added)] as [string, string?]),
    ...items.filter(i => isLocalFile(i.data.url)).map(i => [`zapusk/${i.id}/`, day(i.data.updated ?? i.data.added)] as [string, string?]),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([p, mod]) => `  <url><loc>${new URL(base + p, site)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
