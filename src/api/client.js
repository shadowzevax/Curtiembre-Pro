// Cliente HTTP propio que reemplaza al SDK de Base44.
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'curtiembre_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch(path, { method = 'GET', body, params } = {}) {
  const url = new URL(API_BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await resp.json(); } catch { /* respuesta sin JSON */ }

  if (!resp.ok) {
    if (resp.status === 401) {
      // Sesión inválida: limpiar y mandar al login
      setToken(null);
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(resp.status, data?.error || `Error ${resp.status}`);
  }
  return data;
}
