export interface SearchEntry {
  kind: 'material' | 'topic';
  title: string;
  text: string;
  href: string;
  grades: number[];
  subject: string;
  detail: string;
  ready: boolean;
  status: string;
}

// Достаточно основ слов: «дроби» найдёт «дробей», «корень» — «корни».
// Беглую гласную перед последней согласной основы убираем: «угол» и «углы» → «угл», «отрезок» и «отрезки» → «отрезк».
export function searchWords(text: string) {
  return (text.toLocaleLowerCase('ru').replace(/ё/g, 'е').match(/[a-zа-я0-9]+/g) ?? []).map(word => {
    const root = word.replace(/^корен(?=[ьяеюий]|$)/, 'корн');
    if (root.length < 4) return root;
    const shortened = root.replace(/(иями|ями|ами|ого|его|ему|ому|ыми|ими|иях|ий|ый|ой|ая|яя|ое|ее|ые|ие|ых|их|ей|ия|ам|ах|ов|ев|ью|а|я|ы|и|е|о|ь)$/u, '');
    const stem = shortened.length >= 3 ? shortened : root;
    return stem.replace(/(?<=[^аеиоуыэюя])[ое](?=[клнрц]$)/u, '');
  });
}

export function matchesSearch(entry: SearchEntry, query: string, grade: string, subject: string, readyOnly: boolean) {
  const queryWords = searchWords(query);
  if (!queryWords.length) return false;
  if (grade && !entry.grades.includes(Number(grade))) return false;
  if (subject && entry.subject !== subject) return false;
  if (readyOnly && !entry.ready) return false;
  const words = searchWords(entry.text);
  return queryWords.every(queryWord => words.some(word => word.includes(queryWord)));
}

export function initSiteSearch(root: HTMLElement, entries: SearchEntry[]) {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const form = root.querySelector<HTMLFormElement>('[data-search-form]')!;
  const query = root.querySelector<HTMLInputElement>('[data-search-query]')!;
  const grade = root.querySelector<HTMLSelectElement>('[data-search-grade]')!;
  const subject = root.querySelector<HTMLSelectElement>('[data-search-subject]')!;
  const ready = root.querySelector<HTMLInputElement>('[data-search-ready]')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const results = root.querySelector<HTMLElement>('[data-search-results]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-search-more]')!;
  const limitStep = 30;
  let limit = limitStep;

  function updateURL() {
    const url = new URL(win.location.href);
    for (const [key, value] of [['q', query.value.trim()], ['grade', grade.value], ['subject', subject.value], ['ready', ready.checked ? '1' : '']]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    win.history.replaceState(null, '', url);
  }

  function render(writeURL = false) {
    if (writeURL) updateURL();
    results.replaceChildren();
    const search = query.value.trim();
    more.hidden = true;
    if (!searchWords(search).length) {
      status.textContent = 'Введите тему или название материала.';
      return;
    }
    const matches = entries.filter(entry => matchesSearch(entry, search, grade.value, subject.value, ready.checked));
    status.textContent = matches.length ? `Найдено: ${matches.length}.` : 'Ничего не нашлось. Попробуйте другое слово или измените фильтры.';
    for (const kind of ['material', 'topic'] as const) {
      const group = matches.filter(entry => entry.kind === kind);
      if (!group.length) continue;
      const section = doc.createElement('section');
      section.className = 'result-group';
      const heading = doc.createElement('h2');
      heading.textContent = `${kind === 'material' ? 'Материалы' : 'Темы программы'} · ${group.length}`;
      section.append(heading);
      const list = doc.createElement('ul');
      list.className = 'result-list';
      const groupLimit = kind === 'material' ? group.length : limit;
      group.slice(0, groupLimit).forEach(entry => {
        const row = doc.createElement('li');
        row.className = 'result-row';
        const link = doc.createElement('a');
        link.href = entry.href;
        link.className = 'result-title';
        link.textContent = entry.title;
        const info = doc.createElement('p');
        info.className = 'result-detail';
        info.textContent = entry.detail;
        const state = doc.createElement('span');
        state.className = entry.ready ? 'result-status is-ready' : 'result-status';
        state.textContent = entry.status;
        row.append(link, info, state);
        list.append(row);
      });
      section.append(list);
      results.append(section);
      if (kind === 'topic' && group.length > limit) {
        more.hidden = false;
        more.textContent = `Показать ещё темы (${group.length - limit})`;
      }
    }
  }

  function readURL() {
    const params = new URL(win.location.href).searchParams;
    query.value = params.get('q') ?? '';
    grade.value = params.get('grade') ?? '';
    subject.value = params.get('subject') ?? '';
    ready.checked = params.get('ready') === '1';
    limit = limitStep;
    render();
  }
  form.addEventListener('submit', event => { event.preventDefault(); limit = limitStep; render(true); });
  query.addEventListener('input', () => { limit = limitStep; render(true); });
  [grade, subject, ready].forEach(control => control.addEventListener('change', () => { limit = limitStep; render(true); }));
  more.addEventListener('click', () => { limit += limitStep; render(); });
  root.querySelectorAll<HTMLButtonElement>('[data-search-example]').forEach(button => button.addEventListener('click', () => {
    query.value = button.dataset.searchExample ?? '';
    limit = limitStep;
    render(true);
    query.focus();
  }));
  win.addEventListener('popstate', readURL);
  readURL();
}
