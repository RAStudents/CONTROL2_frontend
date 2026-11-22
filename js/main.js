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