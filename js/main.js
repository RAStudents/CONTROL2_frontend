import { strings } from './i18n.js';
import { login, checkApiHealth } from './api.js';
import { config } from './config.js';

const events = [
  { date: '2026-11-22', time: '14:32:10', device: 'Edge-01', binding: 'Линия №1', code: 'DEFECT', severity: 'Высокая' },
  { date: '2026-11-21', time: '14:30:02', device: 'Edge-02', binding: 'Зона A', code: 'NORMAL', severity: 'Низкая' },
  { date: '2026-11-20', time: '14:28:44', device: 'Edge-01', binding: 'Линия №1', code: 'NO_HELMET', severity: 'Средняя' },
  { date: '2026-11-18', time: '14:25:11', device: 'Edge-03', binding: 'ТС 742', code: 'NORMAL', severity: 'Низкая' },
  { date: '2026-11-15', time: '14:21:09', device: 'Edge-02', binding: 'Зона A', code: 'DEFECT', severity: 'Высокая' },
  { date: '2026-11-10', time: '14:18:33', device: 'Edge-01', binding: 'Линия №1', code: 'DEFECT', severity: 'Высокая' },
  { date: '2026-10-29', time: '14:15:20', device: 'Edge-03', binding: 'ТС 742', code: 'NO_HELMET', severity: 'Средняя' }
];

const ROLE_LABELS = {
  provider_admin: { id: 'supplier', label: strings.roleSupplier },
  supplier_admin: { id: 'supplier', label: strings.roleSupplier },
  company_admin: { id: 'company', label: strings.roleCompany },
  observer: { id: 'viewer', label: strings.roleViewer },
  viewer: { id: 'viewer', label: strings.roleViewer }
};

function decodeToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(payload).split('').map(char =>
      `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`
    ).join('')));
  } catch {
    return null;
  }
}

function getSession() {
  const token = localStorage.getItem('control.jwt');
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || (payload.exp && payload.exp * 1000 <= Date.now())) {
    localStorage.removeItem('control.jwt');
    return null;
  }
  return { token, payload };
}

const session = getSession();

const FILTER_OPTIONS = {
  period: ['Сегодня', '7 дней', '30 дней', 'Все время'],
  device: ['Все', 'Edge-01', 'Edge-02', 'Edge-03'],
  binding: ['Все', 'Линия №1', 'Зона A', 'ТС 742'],
  codes: ['DEFECT', 'NO_HELMET', 'NORMAL'],
  severities: ['Высокая', 'Средняя', 'Низкая']
};

const DEFAULT_FILTERS = {
  period: '30 дней',
  device: 'Все',
  binding: 'Все',
  codes: new Set(FILTER_OPTIONS.codes),
  severities: new Set(FILTER_OPTIONS.severities)
};

const state = {
  loggedIn: Boolean(session),
  session,
  apiStatus: 'checking',
  loginError: '',
  selectedEvent: events[0],
  filters: {
    period: DEFAULT_FILTERS.period,
    device: DEFAULT_FILTERS.device,
    binding: DEFAULT_FILTERS.binding,
    codes: new Set(DEFAULT_FILTERS.codes),
    severities: new Set(DEFAULT_FILTERS.severities)
  },
  ascending: false,
  modal: null
};

const app = document.querySelector('#app');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className = 'button', action) {
  const node = element('button', className, text);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

function resetFilters() {
  state.filters.period = DEFAULT_FILTERS.period;
  state.filters.device = DEFAULT_FILTERS.device;
  state.filters.binding = DEFAULT_FILTERS.binding;
  state.filters.codes = new Set(DEFAULT_FILTERS.codes);
  state.filters.severities = new Set(DEFAULT_FILTERS.severities);
}

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
  email.required = true;
  email.placeholder = 'name@company.ru';
  const passwordLabel = element('label', '', strings.password);
  passwordLabel.htmlFor = 'password';
  const password = element('input');
  password.id = 'password';
  password.type = 'password';
  password.autocomplete = 'current-password';
  password.required = true;
  const error = element('p', 'form-error', state.loginError);
  error.setAttribute('role', 'alert');
  error.hidden = !state.loginError;
  const submit = button(strings.signIn, 'button button-primary login-button');
  submit.type = 'submit';
  const apiState = element('p', 'api-state', state.apiStatus === 'online'
    ? 'Сервер доступен'
    : state.apiStatus === 'offline' ? 'Сервер недоступен' : 'Проверка соединения…');

  form.append(heading, subtitle, emailLabel, email, passwordLabel, password, error, submit, apiState);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    state.loginError = '';
    submit.disabled = true;
    submit.textContent = 'Вход…';
    error.hidden = true;

    try {
      const result = await login(email.value.trim(), password.value);
      const payload = decodeToken(result.access_token);
      if (!payload) throw new Error('Сервер вернул некорректный токен авторизации.');
      localStorage.setItem('control.jwt', result.access_token);
      state.session = { token: result.access_token, payload };
      state.loggedIn = true;
      state.loginError = '';
      render();
    } catch (requestError) {
      state.loginError = requestError.message || 'Не удалось выполнить вход.';
      error.textContent = state.loginError;
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = strings.signIn;
    }
  });
  page.append(form);
  app.replaceChildren(page);
}

function renderFilters() {
  const aside = element('aside', 'filters');

  const addSelect = (id, labelText, options, value, key) => {
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
      state.filters[key] = select.value;
      renderFeedRows();
    });
    aside.append(label, select);
  };

  addSelect('filter-period', 'ПЕРИОД', FILTER_OPTIONS.period, state.filters.period, 'period');
  addSelect('filter-device', 'УСТРОЙСТВО', FILTER_OPTIONS.device, state.filters.device, 'device');
  addSelect('filter-binding', 'ПРИВЯЗКА', FILTER_OPTIONS.binding, state.filters.binding, 'binding');

  const addCheckboxGroup = (title, values, targetSet) => {
    const fieldset = element('fieldset');
    fieldset.append(element('legend', '', title));
    values.forEach(value => {
      const label = element('label', 'check-row');
      const input = element('input');
      input.type = 'checkbox';
      input.checked = targetSet.has(value);
      input.addEventListener('change', () => {
        input.checked ? targetSet.add(value) : targetSet.delete(value);
        renderFeedRows();
      });
      label.append(input, element('span', '', value));
      fieldset.append(label);
    });
    aside.append(fieldset);
  };

  addCheckboxGroup('КОД СОБЫТИЯ', FILTER_OPTIONS.codes, state.filters.codes);
  addCheckboxGroup('КРИТИЧНОСТЬ', FILTER_OPTIONS.severities, state.filters.severities);

  const actions = element('div', 'filter-actions');
  actions.append(button(strings.reset, 'button', () => {
    resetFilters();
    render();
  }));
  aside.append(actions);
  return aside;
}

function severityBadge(value) {
  return element('span', `severity severity-${value.toLowerCase()}`, value);
}

function getFilteredEvents() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const days = { 'Сегодня': 1, '7 дней': 7, '30 дней': 30 }[state.filters.period];
  const cutoff = days ? new Date(now.getTime() - (days - 1) * 86400000) : null;
  return events.filter(event => {
    const eventDate = new Date(`${event.date}T${event.time}`);
    return state.filters.codes.has(event.code)
      && state.filters.severities.has(event.severity)
      && (state.filters.device === 'Все' || event.device === state.filters.device)
      && (state.filters.binding === 'Все' || event.binding === state.filters.binding)
      && (!cutoff || eventDate >= cutoff);
  }).sort((a, b) => {
    const comparison = new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
    return state.ascending ? comparison : -comparison;
  });
}

function renderFeedRows() {
  const body = document.querySelector('#event-rows');
  if (!body) return;
  const filtered = getFilteredEvents();
  if (!filtered.some(event => event === state.selectedEvent)) state.selectedEvent = filtered[0] ?? null;
  body.replaceChildren();
  filtered.forEach(event => {
    const row = element('tr', state.selectedEvent === event ? 'selected' : '');
    row.addEventListener('click', () => {
      state.selectedEvent = event;
      document.querySelector('.event-card')?.replaceWith(renderEventCard(event));
      renderFeedRows();
    });
    [event.time, event.device, event.binding].forEach(value => row.append(element('td', '', value)));
    row.append(element('td', 'code', event.code));
    const severityCell = element('td');
    severityCell.append(severityBadge(event.severity));
    row.append(severityCell);
    body.append(row);
  });
  if (!filtered.length) {
    const row = element('tr', 'no-results');
    const cell = element('td', '', 'По выбранным фильтрам ничего не найдено');
    cell.colSpan = 5;
    row.append(cell);
    body.append(row);
  }
  const count = document.querySelector('#result-count');
  if (count) count.textContent = `Найдено: ${filtered.length}`;
  const card = document.querySelector('.event-card');
  if (card) card.replaceWith(renderEventCard(state.selectedEvent));
}

function renderEventCard(event) {
  if (!event) return element('aside', 'event-card empty-card', strings.noEvent);
  const aside = element('aside', 'event-card');
  aside.append(element('h2', '', 'КАРТОЧКА СОБЫТИЯ'));
  const details = [
    ['Время возникновения', `${event.date.split('-').reverse().join('.')} ${event.time}`],
    ['Время получения', `${event.date.split('-').reverse().join('.')} ${event.time}`],
    ['Устройство', event.device],
    ['Привязка', event.binding],
    ['Код', `${event.code}${event.code === 'DEFECT' ? ' (Дефект)' : ''}`],
    ['Уверенность', '96%']
  ];
  const list = element('dl');
  details.forEach(([term, value]) => {
    const row = element('div');
    row.append(element('dt', '', term), element('dd', '', value));
    list.append(row);
  });
  const severityRow = element('div');
  severityRow.append(element('dt', '', 'Критичность'));
  const severityValue = element('dd');
  severityValue.append(severityBadge(event.severity));
  severityRow.append(severityValue);
  list.append(severityRow);
  aside.append(list, element('h2', '', 'PAYLOAD'));
  const payload = element('pre', '', '{ "defect_type": "царапина",\n  "confidence": 0.96 }');
  aside.append(payload, element('h2', 'media-heading', 'MEDIA'));
  aside.append(element('div', 'media-preview', 'JPEG · превью'));
  aside.append(button('Открыть media', 'button button-primary full', () => openModal('Media события')));
  aside.append(button('Закрыть карточку', 'button full', () => {
    state.selectedEvent = null;
    render();
  }));
  return aside;
}

function openModal(title) {
  state.modal = title;
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function renderModal() {
  document.querySelector('.modal-backdrop')?.remove();
  if (!state.modal) return;
  const backdrop = element('div', 'modal-backdrop');
  backdrop.addEventListener('mousedown', event => {
    if (event.target === backdrop) closeModal();
  });
  const modal = element('section', 'modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const header = element('div', 'modal-header');
  header.append(element('h2', '', state.modal));
  header.append(button('×', '', closeModal));
  modal.append(header);
  if (state.modal === 'Media события') {
    modal.append(element('div', 'large-media', 'JPEG · превью события'));
  } else {
    const content = element('div', 'modal-content');
    content.append(element('p', '', `Раздел «${state.modal}» будет доступен после подключения API.`));
    content.append(button('Закрыть', 'button button-primary', closeModal));
    modal.append(content);
  }
  backdrop.append(modal);
  app.append(backdrop);
}

function renderTopbar() {
  const payload = state.session?.payload ?? {};
  const role = ROLE_LABELS[payload.role] ?? { id: 'viewer', label: payload.role ?? 'Пользователь' };
  const topbar = element('header', 'topbar');
  topbar.append(button('CONTROL', 'logo', () => {
    state.selectedEvent = events[0];
    render();
  }));
  topbar.append(element('span', 'company-name', role.id === 'supplier'\n    ? 'Acmenra Studio (Поставщик)'\n    : 'Компания не загружена'));
  topbar.append(element('span', `role role-${role.id}`, role.label));
  topbar.append(element('div', 'topbar-spacer'));
  topbar.append(element('span', 'user', 'Пользователь'));
  const connection = button(state.apiStatus === 'online' ? '● API доступен' : '● API недоступен',
    `connection ${state.apiStatus === 'online' ? 'online' : 'offline'}`,
    async () => {
      state.apiStatus = await checkApiHealth() ? 'online' : 'offline';
      render();
    });
  topbar.append(connection);
  topbar.append(button('Выйти', 'button', () => {
    localStorage.removeItem('control.jwt');
    state.session = null;
    state.loggedIn = false;
    state.loginError = '';
    render();
  }));
  return topbar;
}

function renderFeed() {
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
  return feed;
}

function renderFooter() {
  const footer = element('footer');
  const summary = element('div', 'status-summary');
  summary.append(
    element('span', '', 'Устройств на связи: 12'),
    element('span', '', 'Не на связи: 1'),
    element('span', '', 'Событий за период: 1 248')
  );
  const footerActions = element('div', 'footer-actions');
  footerActions.append(button('Отчёт', 'button', () => openModal('Отчёт')));
  footerActions.append(button('История', 'button', () => openModal('История')));
  const role = ROLE_LABELS[state.session?.payload?.role] ?? { id: 'viewer' };
  if (role.id !== 'viewer') {
    footerActions.append(button('Пользователи', 'button', () => openModal('Пользователи')));
    footerActions.append(button('Устройства', 'button', () => openModal('Устройства')));
  }
  footer.append(summary, footerActions);
  return footer;
}

function renderDashboard() {
  const dashboard = element('main', 'dashboard');
  const workspace = element('div', 'workspace');
  workspace.append(renderFilters(), renderFeed(), renderEventCard(state.selectedEvent));
  const demoNotice = element('div', 'demo-notice',
    'События и показатели ниже демонстрационные: API для чтения событий пока не реализован.');
  dashboard.append(renderTopbar(), demoNotice, workspace, renderFooter());
  app.replaceChildren(dashboard);
  renderFeedRows();
  renderModal();
}

function render() {
  if (state.loggedIn) renderDashboard();
  else renderLogin();
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.modal) closeModal();
});

render();
checkApiHealth().then(online => {
  state.apiStatus = online ? 'online' : 'offline';
  if (!state.loggedIn) renderLogin();
});
