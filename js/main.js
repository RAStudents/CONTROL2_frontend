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