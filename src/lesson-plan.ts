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

export const PLAN_SOURCES: Record<string, string> = {
  math: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/4._matematika_5_6_pod.pdf',
  algebra: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/5._algebra_7_9_podp.pdf',
  geometry: 'https://gim87-sar.gosuslugi.ru/netcat_files/30/69/6._geometriya_7_9_podp.pdf',
};
