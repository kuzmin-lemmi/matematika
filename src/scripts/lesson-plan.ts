export function initLessonPlan(root: HTMLElement) {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const subjects = [...root.querySelectorAll<HTMLButtonElement>('[data-subject-button]')];
  const quarters = [...root.querySelectorAll<HTMLButtonElement>('[data-quarter-button]')];
  const ready = root.querySelector<HTMLInputElement>('[data-ready-only]')!;
  const panes = [...root.querySelectorAll<HTMLElement>('[data-plan-pane]')];
  const live = root.querySelector<HTMLElement>('[data-plan-status]')!;
  const rails = [...root.querySelectorAll<HTMLElement>('[data-materials]')];
  let subject = subjects[0].dataset.subjectButton!;
  let quarter = '1';
  function updateRails() {
    rails.forEach(group => {
      const rail = group.querySelector<HTMLElement>('[data-rail]')!;
      const controls = group.querySelector<HTMLElement>('[data-rail-controls]')!;
      controls.hidden = rail.clientWidth === 0 || rail.scrollWidth <= rail.clientWidth + 1;
      group.querySelectorAll<HTMLButtonElement>('[data-scroll]').forEach(button => {
        button.disabled = button.dataset.scroll === '-1' ? rail.scrollLeft < 1 : rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
      });
    });
  }
  function render(writeURL = false) {
    subjects.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.subjectButton === subject)));
    quarters.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.quarterButton === quarter));
      const pane = panes.find(p => p.dataset.subject === subject && p.dataset.quarter === button.dataset.quarterButton)!;
      const count = pane.querySelectorAll('[data-lesson][data-ready="true"]').length;
      button.querySelector<HTMLElement>('[data-count]')!.textContent = count ? ` · ${count}` : '';
      button.setAttribute('aria-label', `${button.dataset.quarterButton} четверть, тем с материалами: ${count}`);
    });
    let count = 0;
    panes.forEach(pane => {
      pane.hidden = pane.dataset.subject !== subject || pane.dataset.quarter !== quarter;
      let visible = 0;
      pane.querySelectorAll<HTMLElement>('[data-lesson]').forEach(row => {
        row.hidden = ready.checked && row.dataset.ready !== 'true';
        if (!row.hidden) visible++;
      });
      pane.querySelector<HTMLElement>('[data-empty]')!.hidden = visible > 0;
      if (!pane.hidden) count = visible;
    });
    root.querySelectorAll<HTMLElement>('[data-unplaced]').forEach(section => section.hidden = section.dataset.unplaced !== subject);
    live.textContent = `${quarter} четверть. Показано тем: ${count}.`;
    if (writeURL) {
      const url = new URL(win.location.href);
      url.searchParams.set('subject', subject);
      url.searchParams.set('quarter', quarter);
      if (ready.checked) url.searchParams.set('ready', '1'); else url.searchParams.delete('ready');
      win.history.replaceState(null, '', url);
    }
    updateRails();
  }
  function readURL() {
    const params = new URL(win.location.href).searchParams;
    subject = subjects.some(b => b.dataset.subjectButton === params.get('subject')) ? params.get('subject')! : subjects[0].dataset.subjectButton!;
    quarter = ['1','2','3','4'].includes(params.get('quarter') ?? '') ? params.get('quarter')! : '1';
    ready.checked = params.get('ready') === '1';
    render();
  }
  root.querySelectorAll<HTMLElement>('[data-plan-controls]').forEach(el => el.hidden = false);
  subjects.forEach(button => button.addEventListener('click', () => { subject = button.dataset.subjectButton!; render(true); }));
  quarters.forEach(button => button.addEventListener('click', () => { quarter = button.dataset.quarterButton!; render(true); }));
  ready.addEventListener('change', () => render(true));
  rails.forEach(group => {
    const rail = group.querySelector<HTMLElement>('[data-rail]')!;
    group.querySelectorAll<HTMLButtonElement>('[data-scroll]').forEach(button => button.addEventListener('click', () => rail.scrollBy({left: Number(button.dataset.scroll) * Math.max(140, rail.clientWidth * .8), behavior: 'auto'})));
    rail.addEventListener('scroll', updateRails, {passive:true});
  });
  win.addEventListener('popstate', readURL);
  win.addEventListener('resize', updateRails);
  readURL();
}
