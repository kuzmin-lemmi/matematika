export interface Plan {
  grade: number;
  subject: string;
  quarterEnds: number[];
  lessons: string[];
}

export function quarterLessons(plan: Plan, quarter: number) {
  const start = plan.quarterEnds[quarter - 2] ?? 0;
  return plan.lessons.slice(start, plan.quarterEnds[quarter - 1]).map((title, index) => ({
    title, number: index + 1, annualNumber: start + index + 1,
  }));
}

export function quarterTopics(plan: Plan, quarter: number) {
  const topics = new Map<string, { title: string; number: number; annualNumbers: number[] }>();
  for (const lesson of quarterLessons(plan, quarter)) {
    const key = lesson.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
    const topic = topics.get(key);
    if (topic) topic.annualNumbers.push(lesson.annualNumber);
    else topics.set(key, { title: lesson.title, number: topics.size + 1, annualNumbers: [lesson.annualNumber] });
  }
  return [...topics.values()];
}

// Номера уроков за год одной строкой: «44–50» или «92–98, 145–150» (тема могла повторяться в четверти)
export function lessonRanges(numbers: number[]) {
  const parts: string[] = [];
  [...numbers].sort((x, y) => x - y).forEach((n, i, all) => {
    if (i > 0 && n === all[i - 1] + 1) parts[parts.length - 1] = parts[parts.length - 1].replace(/–\d+$/, '') + `–${n}`;
    else parts.push(String(n));
  });
  return parts.join(', ');
}

interface PlanRef { grade: number; lessons: number[] }
interface Bound { id: string; data: { planLessons: PlanRef[]; planRelated: PlanRef[] } }

// Материалы тем одной четверти: основные — полные кнопки, «подходит» — короткая ссылка на материал.
// Основной материал показывается кнопками только у первой своей темы в четверти, у следующих — ссылкой,
// чтобы один материал не выглядел несколькими разными.
export function topicMaterials<T extends Bound, L extends { annualNumbers: number[] }>(topics: L[], items: T[], grade: number) {
  const shown = new Set<string>();
  const hits = (refs: PlanRef[], numbers: number[]) => refs.some(r => r.grade === grade && r.lessons.some(n => numbers.includes(n)));
  return topics.map(topic => {
    const materials = items.filter(i => hits(i.data.planLessons, topic.annualNumbers) && !shown.has(i.id));
    const related = items.filter(i => !materials.includes(i)
      && (hits(i.data.planRelated, topic.annualNumbers) || hits(i.data.planLessons, topic.annualNumbers)));
    materials.forEach(i => shown.add(i.id));
    return { ...topic, materials, related };
  });
}

export const PLAN_SOURCES: Record<string, string> = {
  math: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/4._matematika_5_6_pod.pdf',
  algebra: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/5._algebra_7_9_podp.pdf',
  geometry: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/6._geometriya_7_9_podp.pdf',
};
