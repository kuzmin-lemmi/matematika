import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Одна коллекция на всё: материалы к урокам, курсы, программы. Новый тип = новое значение в type.
const items = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/items' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['lesson', 'course', 'app']),
    subject: z.enum(['math', 'algebra', 'geometry']).optional(),   // у материала к уроку указывать всегда
    parts: z.array(z.enum(['board', 'print', 'home'])).default([]), // что внутри: доска, раздатка, дом
    summary: z.string(),
    emoji: z.string().default('✨'),
    color: z.string().default('#2F6FD6'),
    url: z.string(),                          // 'materials/xxx.html' — файл на сайте, или полный адрес https://…
    access: z.enum(['free', 'paid', 'external', 'soon']).default('free'),
    grades: z.array(z.number()).default([]),  // классы: [7], [7, 8]
    topic: z.string().optional(),             // тема школьного курса
    textbook: z.string().optional(),          // учебник и глава — без номеров параграфов, если автор их не дал
    duration: z.string().optional(),          // «5–10 минут на доске»
    tags: z.array(z.string()).default([]),
    repo: z.string().optional(),
    order: z.number().default(1000),          // 5 класс — 100–199, 6 — 200–299, 7 — 300–399, 8 — 400–499, курсы — 900+
    video: z.string().optional(),             // ролик: 'posts/<slug>.mp4' (без звука, 15–30 с)
    poster: z.string().optional(),            // картинка из материала: 'posts/<slug>.jpg' (npm run posters)
    featured: z.boolean().default(false),     // при равных датах added — показать в блоке «Новое» первым
    added: z.coerce.date().optional(),        // дата публикации: самый свежий материал попадает в блок «Новое» на главной
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { items };
