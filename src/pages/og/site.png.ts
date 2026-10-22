import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { SITE } from '../../config';

export const GET: APIRoute = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#D8DFD2" stroke-width="1"/></pattern></defs>
    <rect width="1200" height="630" fill="#F6F3EB"/>
    <rect x="760" width="440" height="630" fill="url(#grid)"/>
    <g stroke="#256449" stroke-width="5" fill="none"><path d="M76 65H105V94H76ZM116 65H145V94H116ZM76 105H105V134H76Z"/><path d="M116 105H145V134H116Z" fill="#256449"/></g>
    <g font-family="'Golos Text','Segoe UI','DejaVu Sans',sans-serif" fill="#203B31">
      <text x="171" y="118" font-size="60" font-weight="700">${SITE.name}</text>
      <text x="72" y="250" font-size="62" font-weight="700">Покажи.</text>
      <text x="72" y="325" font-size="62" font-weight="700">Дай решить.</text>
      <text x="72" y="400" font-size="62" font-weight="700" fill="#256449">Разбери.</text>
      <text x="74" y="492" font-size="28" fill="#5C7065">Математика для урока · 5–9 классы</text>
      <text x="74" y="548" font-size="26" fill="#5C7065">На доске / На бумаге / Дома</text>
    </g>
    <g stroke="#256449" stroke-width="5" fill="none"><path d="M835 170H945V280H835ZM971 170H1081V280H971ZM835 306H945V416H835Z"/><path d="M971 306H1081V416H971Z" fill="#256449"/></g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
