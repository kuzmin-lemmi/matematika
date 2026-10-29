// Общие настройки сайта — меняйте здесь
export const SITE = {
  name: 'Матшаг',
  short: 'Матшаг',
  tagline: 'Наглядные чертежи для доски, раздатки с ключами и тренажёры для дома по математике 5–9 классов',
  sub: '5–6 класс — Виленкин · 7–9 класс — алгебра Макарычева и геометрия Мерзляка',
  author: 'Антон Кузьмин',
  // классы сайта: страницы и пункты меню есть у всех, даже если материалов пока нет
  grades: [5, 6, 7, 8, 9],
  vk: '',          // ссылка на сообщество ВК, когда появится витрина
  // обратная связь (решение автора 2026-10-29, docs/STRATEGY.md): группа учителей в Максе и Яндекс Форма
  max: 'https://max.ru/join/NQ9stXivPfFP7kUOL6kAmalJS7x-A3O1lmNOv8q6SOs',
  form: 'https://forms.yandex.ru/cloud/6ae2fde21f1eb573303ea34f/',   // форма «ошибка или предложение»; скрытый вопрос material — адрес материала
};

// Предметы: в 5–6 классе — математика, в 7–9 — алгебра и геометрия
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
  app:    { label: 'Для любого урока', plural: 'Для любого урока' },
} as const;

export const ACCESS = {
  free:     'Бесплатно',
  paid:     'По подписке',
  external: 'На внешней площадке',
  soon:     'Скоро',
} as const;
