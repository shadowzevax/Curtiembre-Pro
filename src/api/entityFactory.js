import { apiFetch, setToken } from './client';

// Replica la interfaz de las entidades del SDK de Base44:
// list(sort, limit) / filter(query, sort, limit) / get(id) /
// create(data) / update(id, data) / delete(id) / bulkCreate(items)
export function makeEntity(name) {
  const base = `/entities/${name}`;
  return {
    name,
    list: (sort, limit) => apiFetch(base, { params: { sort, limit } }),
    filter: (query, sort, limit) =>
      apiFetch(base, { params: { q: JSON.stringify(query || {}), sort, limit } }),
    get: (id) => apiFetch(`${base}/${id}`),
    create: (data) => apiFetch(base, { method: 'POST', body: data }),
    bulkCreate: (items) => apiFetch(`${base}/bulk`, { method: 'POST', body: items }),
    update: (id, data) => apiFetch(`${base}/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiFetch(`${base}/${id}`, { method: 'DELETE' }),
  };
}

// Entidad especial User: replica base44.auth + gestión de usuarios
export const User = {
  name: 'User',

  me: () => apiFetch('/auth/me'),

  login: async (email, password) => {
    const { token, user } = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(token);
    return user;
  },

  logout: async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* sin sesión */ }
    setToken(null);
    window.location.href = '/';
  },

  updateMyUserData: (data) => apiFetch('/auth/me', { method: 'PUT', body: data }),

  list: () => apiFetch('/users'),
  filter: () => apiFetch('/users'),
  create: (data) => apiFetch('/users', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
};
