// Картинка для превью ссылки (ВК, мессенджеры) — 1200×630, собирается при сборке для каждого материала
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { SITE, TYPES, ACCESS } from '../../config';
import { gradeLabel, subjectLabel } from '../../lib';

export async function getStaticPaths() {
  const items = await getCollection('items');
  return items.map(item => ({ params: { id: item.id }, props: { item } }));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// перенос по словам: не длиннее max символов в строке, не больше lines строк
function wrap(text: string, max: number, lines: number) {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/[\s,.;:—-]*$/, '') + '…'; }
  return out;
}

// ширина текста — с запасом под самый широкий из запасных шрифтов (DejaVu Sans на сервере сборки)
const W = 660, EM_TITLE = .66, EM_TOPIC = .7, EM_TAG = .62;
const FONT = "'Golos Text','Segoe UI','DejaVu Sans','Liberation Sans',Arial,sans-serif";

export const GET: APIRoute = async ({ props }) => {
  const d = (props as any).item.data;
  const logo = (await readFile(join(process.cwd(), 'public/favicon.svg'))).toString('base64');
  const title = wrap(d.title, 18, 2);
  const topic = wrap(d.topic ?? d.summary, Math.floor(W / (32 * EM_TOPIC)), 2);
  const fs = Math.min(78, Math.floor(W / (Math.max(...title.map(l => l.length)) * EM_TITLE)));
  const tag = [d.subject ? subjectLabel(d.subject) : TYPES[d.type as keyof typeof TYPES].label, gradeLabel(d.grades), ACCESS[d.access as keyof typeof ACCESS]].filter(Boolean).join(' · ');
  const ty = title.length > 1 ? 250 : 300;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F3EB"/><stop offset="1" stop-color="#E8EEDF"/></linearGradient>
    <radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="330" r="300" fill="${d.color}"/>
  <circle cx="1060" cy="330" r="300" fill="url(#g)"/>
  <circle cx="1060" cy="330" r="210" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="18"/>
  <circle cx="1060" cy="330" r="120" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="14"/>
  <path d="M0 560H140L180 520H360" fill="none" stroke="#256449" stroke-opacity=".35" stroke-width="4"/>
  <circle cx="366" cy="520" r="8" fill="#256449" fill-opacity=".45"/>
  <image x="70" y="56" width="84" height="84" href="data:image/svg+xml;base64,${logo}"/>
  <text x="170" y="114" font-family="${FONT}" font-size="40" font-weight="800" fill="#203B31">${esc(SITE.name)}</text>
  ${title.map((l, i) => `<text x="70" y="${ty + i * 86}" font-family="${FONT}" font-size="${fs}" font-weight="800" fill="#203B31">${esc(l)}</text>`).join('')}
  ${topic.map((l, i) => `<text x="72" y="${ty + (title.length - 1) * 86 + 70 + i * 42}" font-family="${FONT}" font-size="32" font-weight="600" fill="#5C7065">${esc(l)}</text>`).join('')}
  <rect x="70" y="490" width="${Math.ceil(tag.length * 30 * EM_TAG) + 56}" height="64" rx="32" fill="#256449"/>
  <text x="98" y="532" font-family="${FONT}" font-size="30" font-weight="700" fill="#fff">${esc(tag)}</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
