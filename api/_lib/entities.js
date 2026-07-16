import { getSql } from './db.js';
import { HttpError, newId, rowToRecord } from './util.js';

const ENTITY_RE = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;

export function checkEntityName(name) {
  if (!ENTITY_RE.test(name)) throw new HttpError(400, `Nombre de entidad inválido: ${name}`);
  return name;
}

const COLUMN_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by']);

function fieldExpr(field) {
  if (COLUMN_FIELDS.has(field)) return `"${field}"`;
  if (!/^[A-Za-z0-9_.]+$/.test(field)) throw new HttpError(400, `Campo inválido: ${field}`);
  return `data->>'${field}'`;
}

// Traduce un filtro estilo Base44/Mongo (igualdad plana + $in/$ne/$gt/$gte/$lt/$lte/$exists)
// a una condición SQL sobre la columna jsonb `data`.
function buildCondition(field, value, params) {
  const push = (v) => { params.push(v); return `$${params.length}`; };

  if (value === null) {
    return COLUMN_FIELDS.has(field)
      ? `${fieldExpr(field)} IS NULL`
      : `(data->>'${field}') IS NULL`;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const parts = [];
    for (const [op, opVal] of Object.entries(value)) {
      switch (op) {
        case '$in':
          parts.push(`${fieldExpr(field)} = ANY(${push((opVal || []).map(String))})`);
          break;
        case '$nin':
          parts.push(`NOT (${fieldExpr(field)} = ANY(${push((opVal || []).map(String))}))`);
          break;
        case '$ne':
          parts.push(`${fieldExpr(field)} IS DISTINCT FROM ${push(String(opVal))}`);
          break;
        case '$gt': case '$gte': case '$lt': case '$lte': {
          const cmp = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
          if (typeof opVal === 'number') {
            parts.push(`(${fieldExpr(field)})::numeric ${cmp} ${push(opVal)}`);
          } else {
            parts.push(`${fieldExpr(field)} ${cmp} ${push(String(opVal))}`);
          }
          break;
        }
        case '$exists':
          parts.push(opVal ? `data ? '${field.replace(/'/g, '')}'` : `NOT (data ? '${field.replace(/'/g, '')}')`);
          break;
        case '$regex':
          parts.push(`${fieldExpr(field)} ~* ${push(String(opVal))}`);
          break;
        default:
          throw new HttpError(400, `Operador de filtro no soportado: ${op}`);
      }
    }
    return parts.join(' AND ') || 'TRUE';
  }

  if (COLUMN_FIELDS.has(field)) {
    return `${fieldExpr(field)} = ${push(String(value))}`;
  }
  // Igualdad exacta (respeta tipos JSON: número, booleano, string)
  return `data @> ${push(JSON.stringify({ [field]: value }))}::jsonb`;
}

export function buildWhere(query, params) {
  const conds = [];
  for (const [key, value] of Object.entries(query || {})) {
    if (key === '$or' && Array.isArray(value)) {
      const ors = value.map((sub) => `(${buildWhere(sub, params) || 'TRUE'})`);
      if (ors.length) conds.push(`(${ors.join(' OR ')})`);
    } else if (key === '$and' && Array.isArray(value)) {
      const ands = value.map((sub) => `(${buildWhere(sub, params) || 'TRUE'})`);
      if (ands.length) conds.push(`(${ands.join(' AND ')})`);
    } else {
      conds.push(buildCondition(key, value, params));
    }
  }
  return conds.join(' AND ');
}

function buildOrder(sort) {
  let field = sort || '-created_date';
  let dir = 'ASC';
  if (field.startsWith('-')) { dir = 'DESC'; field = field.slice(1); }
  return `${fieldExpr(field)} ${dir} NULLS LAST, id ${dir}`;
}

export async function listRecords(entity, { query, sort, limit, skip } = {}) {
  const sql = getSql();
  const params = [entity];
  let where = `entity = $1`;
  const extra = buildWhere(query, params);
  if (extra) where += ` AND ${extra}`;
  const lim = Math.min(Number(limit) || 10000, 10000);
  const off = Number(skip) || 0;
  const rows = await sql.query(
    `SELECT * FROM records WHERE ${where} ORDER BY ${buildOrder(sort)} LIMIT ${lim} OFFSET ${off}`,
    params
  );
  return rows.map(rowToRecord);
}

export async function getRecord(entity, id) {
  const sql = getSql();
  const rows = await sql.query(
    'SELECT * FROM records WHERE entity = $1 AND id = $2', [entity, id]
  );
  if (!rows[0]) throw new HttpError(404, `${entity} ${id} no existe`);
  return rowToRecord(rows[0]);
}

function cleanData(data) {
  const { id, created_date, updated_date, created_by, ...rest } = data || {};
  return rest;
}

export async function createRecord(entity, data, auth) {
  const sql = getSql();
  const id = newId();
  const rows = await sql.query(
    `INSERT INTO records (id, entity, data, created_by) VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
    [id, entity, JSON.stringify(cleanData(data)), auth?.email || null]
  );
  return rowToRecord(rows[0]);
}

export async function bulkCreateRecords(entity, items, auth) {
  if (!Array.isArray(items)) throw new HttpError(400, 'Se esperaba un array');
  const results = [];
  for (const item of items) {
    results.push(await createRecord(entity, item, auth));
  }
  return results;
}

export async function updateRecord(entity, id, data) {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE records SET data = data || $3::jsonb, updated_date = now()
     WHERE entity = $1 AND id = $2 RETURNING *`,
    [entity, id, JSON.stringify(cleanData(data))]
  );
  if (!rows[0]) throw new HttpError(404, `${entity} ${id} no existe`);
  return rowToRecord(rows[0]);
}

export async function deleteRecord(entity, id) {
  const sql = getSql();
  await sql.query('DELETE FROM records WHERE entity = $1 AND id = $2', [entity, id]);
  return { ok: true };
}
