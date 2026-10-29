// Записи поиска: материалы и темы рабочих программ. Собираются при сборке в /poisk.json (src/pages/poisk.json.ts),
// страница /poisk/ скачивает их при первом запросе.
import { getCollection } from 'astro:content';
import { SUBJECTS } from './config';
import { isReady, pageHref, gradeLabel } from './lib';
import { quarterTopics } from './lesson-plan';
import type { SearchEntry } from './scripts/site-search';
import plans from './data/lesson-plans.json';

export async function searchEntries(): Promise<SearchEntry[]> {
  const base = import.meta.env.BASE_URL;
  const items = (await getCollection('items')).sort((a, b) => a.data.order - b.data.order);
  const materials: SearchEntry[] = items.map(item => {
    const d = item.data;
    const subject = d.subject ? SUBJECTS[d.subject].label : '';
    const grades = gradeLabel(d.grades);
    return {
      kind: 'material', title: d.title, href: pageHref(item.id), grades: d.grades, subject: d.subject ?? '',
      text: [d.title, d.topic ?? '', d.summary, d.textbook ?? '', subject, grades, ...d.tags].join(' '),
      detail: [subject, grades].filter(Boolean).join(' · ') || 'Материал',
      ready: isReady(d), status: isReady(d) ? 'Материал доступен' : 'Скоро',
    };
  });
  const topics: SearchEntry[] = plans.flatMap(plan => [1, 2, 3, 4].flatMap(quarter => quarterTopics(plan, quarter).map(topic => {
    const subject = SUBJECTS[plan.subject as keyof typeof SUBJECTS].label;
    const linked = items.filter(item => isReady(item.data) && item.data.type === 'lesson'
      && item.data.subject === plan.subject && item.data.grades.includes(plan.grade)
      && [...item.data.planLessons, ...item.data.planRelated].some(ref => ref.grade === plan.grade
        && ref.lessons.some(number => topic.annualNumbers.includes(number))));
    return {
      kind: 'topic' as const, title: topic.title,
      href: `${base}klass/${plan.grade}/?subject=${plan.subject}&quarter=${quarter}#topic-${plan.subject}-${quarter}-${topic.annualNumbers[0]}`,
      grades: [plan.grade], subject: plan.subject,
      text: [topic.title, subject, `${plan.grade} класс`, ...linked.flatMap(item => [item.data.title, ...item.data.tags])].join(' '),
      detail: `${plan.grade} класс · ${subject} · ${quarter} четверть`,
      ready: linked.length > 0, status: linked.length ? 'Есть материал' : 'Материалов пока нет',
    };
  })));
  return [...materials, ...topics];
}
