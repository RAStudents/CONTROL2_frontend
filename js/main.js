import { strings } from './i18n.js';
import { api } from './api.js';

const roles = [
  { id: 'supplier', label: strings.roleSupplier },
  { id: 'company', label: strings.roleCompany },
  { id: 'viewer', label: strings.roleViewer }
];

const state = {
  loggedIn: !!api.getToken(),
  roleIndex: 0,
  events: [],
  selectedEvent: null,
  visibleCodes: new Set(),
  ascending: false,
  modal: null,
  error: null,
  loading: false
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
  email.value = 'admin@acmenra.ru';
  
  const passwordLabel = element('label', '', strings.password);
  passwordLabel.htmlFor = 'password';
  const password = element('input');
  password.id = 'password';
  password.type = 'password';
  password.value = 'admin123';
  
  const submit = button(state.loading ? 'Вход...' : strings.signIn, 'button button-primary login-button');
  submit.type = 'submit';
  submit.disabled = state.loading;

  if (state.error) {
    const errorMsg = element('p', 'error-message', state.error);
    errorMsg.style.color = 'red';
    errorMsg.style.fontSize = '12px';
    errorMsg.style.marginBottom = '10px';
    form.append(errorMsg);
  }

  form.append(heading, subtitle, emailLabel, email, passwordLabel, password, submit);
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.error = null;
    state.loading = true;
    render();

    try {
      await api.login(email.value, password.value);
      state.loggedIn = true;
      await loadEvents();
    } catch (err) {
      state.error = err.message;
    } finally {
      state.loading = false;
      render();
    }
  });

  page.append(form);
  app.replaceChildren(page);
}

async function loadEvents() {
  try {
    const data = await api.getEvents();
    if (data && data.length > 0) {
      state.events = data.map(e => ({
        time: new Date(e.occurred_at).toLocaleTimeString('ru-RU'),
        device: 'Edge-01', 
        binding: 'Линия №1',
        code: e.code.toUpperCase(),
        severity: e.code === 'fall' ? 'Высокая' : 'Средняя', 
        payload: e.payload
      }));

      const uniqueCodes = [...new Set(state.events.map(e => e.code))];
      state.visibleCodes = new Set(uniqueCodes);
      
      if (!state.selectedEvent || !state.events.includes(state.selectedEvent)) {
        state.selectedEvent = state.events[0];
      }
    } else {
      state.events = [];
      state.selectedEvent = null;
    }
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    state.events = [];
  }
}

function renderFilters() {
  const aside = element('aside', 'filters');
  
  const addSelect = (labelText, options) => {
    aside.append(element('label', '', labelText));
    const select = element('select');
    for (const optionText of options) {
      const option = element('option', '', optionText);
      option.value = optionText;
      select.append(option);
    }
    aside.append(select);
  };
  addSelect('ПЕРИОД', ['Сегодня', '7 дней', '30 дней']);
  addSelect('УСТРОЙСТВО', ['Все', 'Edge-01']);
  addSelect('ПРИВЯЗКА', ['Все', 'Линия №1']);

  const fieldset = element('fieldset');
  fieldset.append(element('legend', '', 'КОД СОБЫТИЯ'));
  
  const uniqueCodes = [...new Set(state.events.map(e => e.code))];
  
  if (uniqueCodes.length === 0) {
    fieldset.append(element('p', '', 'Нет данных'));
  } else {
    uniqueCodes.forEach(code => {
      const label = element('label', 'check-row');
      const input = element('input');
      input.type = 'checkbox';
      input.checked = state.visibleCodes.has(code);
      input.addEventListener('change', () => {
        if (input.checked) {
          state.visibleCodes.add(code);
        } else {
          state.visibleCodes.delete(code);
        }
        renderFeedRows();
      });
      label.append(input, element('span', '', code));
      fieldset.append(label);
    });
  }
  aside.append(fieldset);

  const actions = element('div', 'filter-actions');
  actions.append(button(strings.apply, 'button button-primary', () => renderFeedRows()));
  actions.append(button(strings.reset, 'button', () => {
    state.visibleCodes = new Set(uniqueCodes);
    render();
  }));
  aside.append(actions);
  
  return aside;
}

function severityBadge(value) {
  return element('span', `severity severity-${value.toLowerCase()}`, value);
}

function renderFeedRows() {
  const body = document.querySelector('#event-rows');
  if (!body) return;
  
  let filtered = state.events.filter(event => state.visibleCodes.has(event.code));
  if (state.ascending) filtered = [...filtered].reverse();
  
  body.replaceChildren();
  
  if (filtered.length === 0) {
    const row = element('tr');
    const cell = element('td', '', 'Событий не найдено');
    cell.colSpan = 5;
    cell.style.textAlign = 'center';
    cell.style.color = '#6b7a8c';
    row.append(cell);
    body.append(row);
    
    state.selectedEvent = null;
    renderCard();
    return;
  }

  if (!filtered.find(e => e.time === state.selectedEvent?.time)) {
      state.selectedEvent = filtered[0];
      renderCard();
  }

  filtered.forEach(event => {
    const row = element('tr', state.selectedEvent?.time === event.time ? 'selected' : '');
    row.addEventListener('click', () => {
      state.selectedEvent = event;
      renderFeedRows();
      renderCard();
    });
    [event.time, event.device, event.binding].forEach(value => row.append(element('td', '', value)));
    row.append(element('td', 'code', event.code));
    const severityCell = element('td');
    severityCell.append(severityBadge(event.severity));
    row.append(severityCell);
    body.append(row);
  });
}

function renderCard() {
    const cardContainer = document.querySelector('.workspace > aside:last-child');
    if (cardContainer) {
        const newCard = renderEventCard(state.selectedEvent);
        cardContainer.replaceWith(newCard);
    }
}

function renderEventCard(event) {
  if (!event) return element('aside', 'event-card empty-card', strings.noEvent);
  
  const aside = element('aside', 'event-card');
  aside.append(element('h2', '', 'КАРТОЧКА СОБЫТИЯ'));
  
  const details = [
    ['Время возникновения', `${event.time}`],
    ['Код', event.code],
    ['Критичность', event.severity],
    ['Устройство', event.device],
    ['Привязка', event.binding]
  ];
  
  const list = element('dl');
  details.forEach(([term, value]) => {
    const row = element('div');
    row.append(element('dt', '', term), element('dd', '', value));
    list.append(row);
  });
  
  aside.append(list, element('h2', '', 'PAYLOAD'));
  
  const payloadText = JSON.stringify(event.payload || {}, null, 2);
  const payload = element('pre', '', payloadText);
  
  aside.append(payload, element('h2', 'media-heading', 'MEDIA'));
  aside.append(element('div', 'media-preview', 'JPEG · превью'));
  aside.append(button('Открыть media', 'button button-primary full', () => openModal('Media события')));
  
  return aside;
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
  
  const content = element('div', 'modal-content');
  content.append(element('p', '', `Раздел «${state.modal}» в разработке.`));
  content.append(button('Закрыть', 'button button-primary', () => {
    state.modal = null;
    renderModal();
  }));
  modal.append(content);

  backdrop.append(modal);
  app.append(backdrop);
}

function renderDashboard() {
  const role = roles[state.roleIndex];
  const dashboard = element('main', 'dashboard');
  const topbar = element('header', 'topbar');
  
  topbar.append(button('CONTROL', 'logo', () => {
    state.selectedEvent = state.events[0] || null;
    render();
  }));
  
  topbar.append(element('span', 'company-name', 'ООО «Завод»'));
  topbar.append(button(role.label, `role role-${role.id}`, () => {
    state.roleIndex = (state.roleIndex + 1) % roles.length;
    render();
  }));
  
  topbar.append(element('div', 'topbar-spacer'));
  topbar.append(element('span', 'user', 'Иван Петров'));
  topbar.append(button('● Связь OK', 'connection', () => openModal('Связь')));
  
  topbar.append(button('Выйти', 'button', () => {
    api.logout();
    state.loggedIn = false;
    render();
  }));

  const workspace = element('div', 'workspace');
  workspace.append(renderFilters());
  
  const feed = element('section', 'feed');
  const toolbar = element('div', 'feed-toolbar');
  toolbar.append(button('Обновить', 'button', async () => {
    await loadEvents();
    render();
  }));
  toolbar.append(element('span', '', `Найдено: ${state.events.length}`));
  
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
  pagination.append(button('← Назад'), element('span', '', 'Страница 1 из 1'), button('Вперёд →'));
  feed.append(toolbar, tableWrap, pagination);
  
  workspace.append(feed);
  workspace.append(renderEventCard(state.selectedEvent));

  const footer = element('footer');
  const summary = element('div', 'status-summary');
  summary.append(
    element('span', '', 'Устройств на связи: 12'), 
    element('span', '', 'Не на связи: 1'), 
    element('span', '', `Событий за период: ${state.events.length}`)
  );
  
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

function render() {
  if (state.loggedIn) {
    renderDashboard();
  } else {
    renderLogin();
  }
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.modal) {
    state.modal = null;
    renderModal();
  }
});

render();