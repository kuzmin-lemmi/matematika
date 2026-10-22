// Общие настройки сайта — меняйте здесь
export const SITE = {
  name: 'Матшаг',
  short: 'Матшаг',
  tagline: 'Наглядные чертежи для доски, раздатки с ключами и тренажёры для дома по математике 5–8 классов',
  sub: '5–6 класс — Виленкин · 7–8 класс — алгебра Макарычева и геометрия Мерзляка',
  author: 'Антон Кузьмин',
  github: 'https://github.com/kuzmin-lemmi/matematika',
  // классы сайта: страницы и пункты меню есть у всех, даже если материалов пока нет
  grades: [5, 6, 7, 8],
  vk: '',          // ссылка на сообщество ВК, когда появится витрина
};

// Предметы: в 5–6 классе — математика, в 7–8 — алгебра и геометрия
export const SUBJECTS = {
  math:     { label: 'Математика', textbook: 'Виленкин' },
  algebra:  { label: 'Алгебра',    textbook: 'Макарычев' },
  geometry: { label: 'Геометрия',  textbook: 'Мерзляк' },
} as const;

// Режимы внутри материала: одна тема — доска, раздатка и тренажёр для дома (docs/FORMATS.md)
export const PARTS = {
  board: { label: 'На доске', icon: '🖥' },
  print: { label: 'Раздатка', icon: '🖨' },
  home:  { label: 'Дома',     icon: '🏠' },
} as const;

export const TYPES = {
  lesson: { label: 'Материал к уроку', plural: 'Материалы к урокам' },
  course: { label: 'Курс',             plural: 'Курсы' },
  app:    { label: 'Программа',        plural: 'Программы и сервисы' },
} as const;

export const ACCESS = {
  free:     'Бесплатно',
  paid:     'По подписке',
  external: 'На внешней площадке',
  soon:     'Скоро',
} as const;
