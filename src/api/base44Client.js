// Shim de compatibilidad: mantiene la interfaz `base44.entities.X` / `base44.auth`
// que algunas páginas usan directamente, pero apuntando a nuestra propia API.
import { makeEntity, User } from './entityFactory';

const entityCache = {};

const entities = new Proxy({}, {
  get(_target, name) {
    if (typeof name !== 'string') return undefined;
    if (name === 'User') return User;
    if (!entityCache[name]) entityCache[name] = makeEntity(name);
    return entityCache[name];
  },
});

export const base44 = {
  entities,
  auth: {
    me: () => User.me(),
    logout: () => User.logout(),
    redirectToLogin: () => { window.location.href = '/'; },
  },
  appLogs: {
    // Base44 registraba la navegación del usuario; ya no aplica.
    logUserInApp: async () => {},
  },
};
