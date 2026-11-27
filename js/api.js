import { config } from './config.js';

const TOKEN_KEY = 'control_token';

export const api = {
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request(endpoint, options = {}) {
    const url = `${config.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      this.logout();
      window.location.reload();
      throw new Error('Неавторизован');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Ошибка сервера');
    }

    return response.json();
  },

  async login(email, password) {
    const data = await this.request('/api/cabinet/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  },

  async getEvents() {
    return this.request('/api/cabinet/feed');
    return []; 
  }
};