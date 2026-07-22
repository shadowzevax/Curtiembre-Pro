import { ensureSchema } from './db.js';
import { HttpError } from './util.js';
import {
  getAuthUser, requireAdmin, login, getMe, updateMyData,
  listUsers, createUser, updateUser, deleteUser,
} from './auth.js';
import {
  checkEntityName, listRecords, getRecord, createRecord,
  bulkCreateRecords, updateRecord, deleteRecord,
} from './entities.js';
import { uploadFile, serveFile } from './files.js';
import { handleTelegramWebhook } from './telegram.js';

function parseQueryFilter(q) {
  if (!q) return undefined;
  try {
    return JSON.parse(q);
  } catch {
    throw new HttpError(400, 'Parámetro de filtro inválido');
  }
}

// Router compartido por la función de Vercel y el servidor de desarrollo.
// `segments` = partes del path después de /api, ej. ['entities', 'Insumo', 'abc123']
export async function handleApi(req, res, segments) {
  await ensureSchema();
  const method = req.method.toUpperCase();
  const [root, a, b] = segments;

  // ---- Auth ----
  if (root === 'auth') {
    if (a === 'login' && method === 'POST') {
      return login(req.body?.email, req.body?.password);
    }
    if (a === 'me' && method === 'GET') {
      return getMe(getAuthUser(req));
    }
    if (a === 'me' && method === 'PUT') {
      return updateMyData(getAuthUser(req), req.body);
    }
    if (a === 'logout' && method === 'POST') {
      return { ok: true };
    }
    throw new HttpError(404, 'Ruta no encontrada');
  }

  // ---- Webhook de Telegram (público; el filtro de seguridad es por chat_id) ----
  if (root === 'telegram-webhook') {
    if (method !== 'POST') throw new HttpError(404, 'Ruta no encontrada');
    return handleTelegramWebhook(req.body);
  }

  // ---- Archivos ----
  if (root === 'files') {
    if (!a && method === 'POST') {
      return uploadFile(req.body, getAuthUser(req));
    }
    if (a && method === 'GET') {
      await serveFile(a, res);
      return null; // respuesta ya enviada
    }
    throw new HttpError(404, 'Ruta no encontrada');
  }

  // Todo lo demás requiere sesión
  const auth = getAuthUser(req);

  // ---- Usuarios (entidad especial User) ----
  if (root === 'users') {
    if (!a && method === 'GET') return listUsers();
    if (!a && method === 'POST') { requireAdmin(auth); return createUser(req.body); }
    if (a && method === 'PUT') { requireAdmin(auth); return updateUser(a, req.body); }
    if (a && method === 'DELETE') { requireAdmin(auth); return deleteUser(a, auth); }
    throw new HttpError(404, 'Ruta no encontrada');
  }

  // ---- Entidades genéricas ----
  if (root === 'entities' && a) {
    const entity = checkEntityName(a);
    if (!b && method === 'GET') {
      return listRecords(entity, {
        query: parseQueryFilter(req.query.q),
        sort: req.query.sort,
        limit: req.query.limit,
        skip: req.query.skip,
      });
    }
    if (!b && method === 'POST') return createRecord(entity, req.body, auth);
    if (b === 'bulk' && method === 'POST') return bulkCreateRecords(entity, req.body, auth);
    if (b && method === 'GET') return getRecord(entity, b);
    if (b && method === 'PUT') return updateRecord(entity, b, req.body);
    if (b && method === 'DELETE') return deleteRecord(entity, b);
  }

  throw new HttpError(404, 'Ruta no encontrada');
}

export async function runHandler(req, res, segments) {
  try {
    const result = await handleApi(req, res, segments);
    if (result === null) return; // ya respondió (archivos)
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result ?? {}));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('API error:', err);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Error interno' }));
  }
}
