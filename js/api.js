import { config } from './config.js';

const API_BASE_URL = (config.apiUrl || 'http://localhost:8000').replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const headers = new Headers(options.headers ?? {});

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('control.jwt');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
      signal: options.signal ?? controller.signal
    });

    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('control.jwt');
      }

      const detail = data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(item => item.msg).join('; ')
          : data?.message ?? `Ошибка запроса (${response.status})`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Время ожидания ответа сервера истекло.');
    }
    if (error instanceof TypeError) {
      throw new Error('Не удалось связаться с сервером. Проверьте адрес API и его доступность.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function login(email, password) {
  return apiRequest('/api/cabinet/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

export async function checkApiHealth() {
  try {
    const result = await apiRequest('/health');
    return result?.status === 'ok';
  } catch {
    return false;
  }
}