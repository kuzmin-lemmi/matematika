// Индекс поиска отдельным файлом: страница /poisk/ скачивает его только при первом запросе
import type { APIRoute } from 'astro';
import { searchEntries } from '../search-index';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await searchEntries()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
