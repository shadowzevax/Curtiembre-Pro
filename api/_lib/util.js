import crypto from 'node:crypto';

// Ids de 24 hex, mismo formato que los ids originales de Base44
export function newId() {
  return crypto.randomBytes(12).toString('hex');
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function toIso(value) {
  if (!value) return value;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? value : d.toISOString();
}

// Convierte una fila de `records` a la forma que devolvía Base44:
// los campos del documento al nivel raíz + id/fechas/created_by
export function rowToRecord(row) {
  return {
    ...row.data,
    id: row.id,
    created_date: toIso(row.created_date),
    updated_date: toIso(row.updated_date),
    created_by: row.created_by || undefined,
  };
}

export function userToPublic(row) {
  return {
    ...row.data,
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    disabled: row.disabled,
    created_date: toIso(row.created_date),
    updated_date: toIso(row.updated_date),
  };
}
