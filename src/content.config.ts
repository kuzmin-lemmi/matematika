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
    // другие виды листа раздатки — своя кнопка на сайте, адрес /zapusk/<slug>/?mode=print&kind=<kind>
    sheets: z.array(z.object({
      kind: z.string().regex(/^[a-z0-9-]+$/),
      label: z.string(),            // «Бланк ОГЭ» — коротко, это текст кнопки
      icon: z.string().default('🧾'),
    })).default([]),
    summary: z.string(),
    emoji: z.string().default('✨'),
    color: z.string().default('#2F6FD6'),
    url: z.string(),                          // 'materials/xxx.html' — файл на сайте, или полный адрес https://…
    access: z.enum(['free', 'paid', 'external', 'soon']).default('free'),
    grades: z.array(z.number()).default([]),  // классы: [7], [7, 8]
    // Номера уроков за год из src/data/lesson-plans.json. На странице нумерация внутри четверти.
    planLessons: z.array(z.object({
      grade: z.number().int().min(5).max(9),
      lessons: z.array(z.number().int().positive()).min(1),
    })).default([]),
    topic: z.string().optional(),             // тема школьного курса
    textbook: z.string().optional(),          // учебник и глава — без номеров параграфов, если автор их не дал
    duration: z.string().optional(),          // «5–10 минут на доске»
    tags: z.array(z.string()).default([]),
    repo: z.string().optional(),
    order: z.number().default(1000),          // 5 класс — 100–199, 6 — 200–299, 7 — 300–399, 8 — 400–499, 9 — 500–599, курсы — 900+
    video: z.string().optional(),             // ролик: 'posts/<slug>.mp4' (без звука, 15–30 с)
    poster: z.string().optional(),            // картинка из материала: 'posts/<slug>.jpg' (npm run posters)
    featured: z.boolean().default(false),     // при равных датах added — показать в блоке «Новое» первым
    added: z.coerce.date().optional(),        // дата публикации: самый свежий материал попадает в блок «Новое» на главной
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { items };
