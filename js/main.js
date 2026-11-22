function renderLogin() {
  const page = element('main', 'login-page');
  const form = element('form', 'login-card');
  const heading = element('h1', '', strings.title);
  const subtitle = element('p', '', strings.login);
  const emailLabel = element('label', '', strings.email);
  emailLabel.htmlFor = 'email';
  const email = element('input');
  email.id = 'email';
  email.type = 'email';
  email.autocomplete = 'username';
  email.value = 'ivan.petrov@zavod.ru';
  const passwordLabel = element('label', '', strings.password);
  passwordLabel.htmlFor = 'password';
  const password = element('input');
  password.id = 'password';
  password.type = 'password';
  password.autocomplete = 'current-password';
  password.value = 'password';
  const submit = button(strings.signIn, 'button button-primary login-button');
  submit.type = 'submit';
  const forgot = button(strings.forgotPassword, 'forgot', () => openModal(strings.forgotPassword));

  form.append(heading, subtitle, emailLabel, email, passwordLabel, password, submit, forgot);
  form.addEventListener('submit', event => {
    event.preventDefault();
    state.loggedIn = true;
    render();
  });
  page.append(form);
  app.replaceChildren(page);
}


function renderDashboard() {
  const role = roles[state.roleIndex];
  const dashboard = element('main', 'dashboard');
  const topbar = element('header', 'topbar');
  topbar.append(button('CONTROL', 'logo', () => {
    state.selectedEvent = events[0];
    render();
  }));
  if (role.id === 'supplier') {
    const company = element('select', 'company-switch');
    ['ООО «Завод»', 'АО «Север»'].forEach(name => {
      const option = element('option', '', name);
      company.append(option);
    });
    topbar.append(company);
  } else {
    topbar.append(element('span', 'company-name', 'ООО «Завод»'));
  }
  topbar.append(button(role.label, `role role-${role.id}`, () => {
    state.roleIndex = (state.roleIndex + 1) % roles.length;
    render();
  }));
  topbar.append(element('div', 'topbar-spacer'));
  topbar.append(element('span', 'user', 'Иван Петров'));
  topbar.append(button('● Связь OK', 'connection', () => openModal('Связь')));
  topbar.append(button('Выйти', 'button', () => {
    state.loggedIn = false;
    render();
  }));

  const workspace = element('div', 'workspace');
  workspace.append(renderFilters());
  const feed = element('section', 'feed');
  const toolbar = element('div', 'feed-toolbar');
  toolbar.append(button('Обновить', 'button', () => renderFeedRows()));
  const resultCount = element('span', '', 'Найдено: 7');
  resultCount.id = 'result-count';
  toolbar.append(resultCount);
  toolbar.append(button(`Сортировка: ${state.ascending ? '↑' : '↓'} по времени`, 'sort', () => {
    state.ascending = !state.ascending;
    renderFeedRows();
    const sortButton = document.querySelector('.sort');
    if (sortButton) sortButton.textContent = `Сортировка: ${state.ascending ? '↑' : '↓'} по времени`;
  }));
  const tableWrap = element('div', 'table-wrap');
  const table = element('table');
  const head = element('thead');
  const headerRow = element('tr');
  ['ВРЕМЯ', 'УСТРОЙСТВО', 'ПРИВЯЗКА', 'КОД', 'КРИТИЧНОСТЬ'].forEach(label => headerRow.append(element('th', '', label)));
  head.append(headerRow);
  const body = element('tbody');
  body.id = 'event-rows';
  table.append(head, body);
  tableWrap.append(table);
  const pagination = element('div', 'pagination');
  pagination.append(element('span', '', 'Показаны все найденные события')); 
  feed.append(toolbar, tableWrap, pagination);
  workspace.append(feed, renderEventCard(state.selectedEvent));

  const footer = element('footer');
  const summary = element('div', 'status-summary');
  summary.append(element('span', '', 'Устройств на связи: 12'), element('span', '', 'Не на связи: 1'), element('span', '', 'Событий за период: 1 248'));
  const footerActions = element('div', 'footer-actions');
  footerActions.append(button('Отчёт', 'button', () => openModal('Отчёт')));
  footerActions.append(button('История', 'button', () => openModal('История')));
  if (role.id !== 'viewer') {
    footerActions.append(button('Пользователи', 'button', () => openModal('Пользователи')));
    footerActions.append(button('Устройства', 'button', () => openModal('Устройства')));
  }
  footer.append(summary, footerActions);
  dashboard.append(topbar, workspace, footer);
  app.replaceChildren(dashboard);
  renderFeedRows();
  renderModal();
}

const state = {
  loggedIn: false,
  roleIndex: 0,
  selectedEvent: events[0],
  visibleCodes: new Set(['DEFECT', 'NO_HELMET', 'NORMAL']),
  visibleSeverities: new Set(['Высокая', 'Средняя', 'Низкая']),
  period: '30 дней',
  device: 'Все',
  binding: 'Все',
  ascending: false,
  modal: null
};

function renderFilters() {
  const aside = element('aside', 'filters');
  const addSelect = (id, labelText, options, value) => {
    const label = element('label', '', labelText);
    label.htmlFor = id;
    const select = element('select');
    select.id = id;
    options.forEach(optionText => {
      const option = element('option', '', optionText);
      option.value = optionText;
      select.append(option);
    });
    select.value = value;
    select.addEventListener('change', () => {
      if (id === 'filter-period') state.period = select.value;
      if (id === 'filter-device') state.device = select.value;
      if (id === 'filter-binding') state.binding = select.value;
      renderFeedRows();
    });
    aside.append(label, select);
  };

  addSelect('filter-period', 'ПЕРИОД', ['Сегодня', '7 дней', '30 дней', 'Все время'], state.period);
  addSelect('filter-device', 'УСТРОЙСТВО', ['Все', 'Edge-01', 'Edge-02', 'Edge-03'], state.device);
  addSelect('filter-binding', 'ПРИВЯЗКА', ['Все', 'Линия №1', 'Зона A', 'ТС 742'], state.binding);

  const addCheckboxGroup = (title, values, checkedValues, targetSet) => {
    const fieldset = element('fieldset');
    fieldset.append(element('legend', '', title));
    values.forEach(value => {
      const label = element('label', 'check-row');
      const input = element('input');
      input.type = 'checkbox';
      input.checked = checkedValues.includes(value);
      input.addEventListener('change', () => {
        input.checked ? targetSet.add(value) : targetSet.delete(value);
        renderFeedRows();
      });
      label.append(input, element('span', '', value));
      fieldset.append(label);
    });
    aside.append(fieldset);
  };

  addCheckboxGroup('КОД СОБЫТИЯ', ['DEFECT', 'NO_HELMET', 'NORMAL'], [...state.visibleCodes], state.visibleCodes);
  addCheckboxGroup('КРИТИЧНОСТЬ', ['Высокая', 'Средняя', 'Низкая'], [...state.visibleSeverities], state.visibleSeverities);

  const actions = element('div', 'filter-actions');
  actions.append(button(strings.reset, 'button', () => {
    state.visibleCodes = new Set(['DEFECT', 'NO_HELMET', 'NORMAL']);
    state.visibleSeverities = new Set(['Высокая', 'Средняя', 'Низкая']);
    state.period = '30 дней';
    state.device = 'Все';
    state.binding = 'Все';
    render();
  }));
  aside.append(actions);
  return aside;
}

function getFilteredEvents() {
  const now = new Date('2026-11-22T23:59:59');
  const days = { 'Сегодня': 1, '7 дней': 7, '30 дней': 30 }[state.period];
  const cutoff = days ? new Date(now.getTime() - (days - 1) * 86400000) : null;
  return events.filter(event => {
    const eventDate = new Date(`${event.date}T${event.time}`);
    return state.visibleCodes.has(event.code)
      && state.visibleSeverities.has(event.severity)
      && (state.device === 'Все' || event.device === state.device)
      && (state.binding === 'Все' || event.binding === state.binding)
      && (!cutoff || eventDate >= cutoff);
  }).sort((a, b) => {
    const comparison = new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
    return state.ascending ? comparison : -comparison;
  });
}

function openModal(title) {
  state.modal = title;
  renderModal();
}

function renderModal() {
  document.querySelector('.modal-backdrop')?.remove();
  if (!state.modal) return;
  const backdrop = element('div', 'modal-backdrop');
  backdrop.addEventListener('mousedown', event => {
    if (event.target === backdrop) {
      state.modal = null;
      renderModal();
    }
  });
  const modal = element('section', 'modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const header = element('div', 'modal-header');
  header.append(element('h2', '', state.modal));
  header.append(button('×', '', () => {
    state.modal = null;
    renderModal();
  }));
  modal.append(header);
  if (state.modal === 'Media события') {
    modal.append(element('div', 'large-media', 'JPEG · превью события'));
  } else {
    const content = element('div', 'modal-content');
    content.append(element('p', '', `Раздел «${state.modal}» будет доступен после подключения API.`));
    content.append(button('Закрыть', 'button button-primary', () => {
      state.modal = null;
      renderModal();
    }));
    modal.append(content);
  }
  backdrop.append(modal);
  app.append(backdrop);
}