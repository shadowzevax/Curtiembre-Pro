import { getSql } from './db.js';
import { HttpError, newId } from './util.js';

// Límite práctico: el body de una función de Vercel acepta ~4.5MB.
// El archivo llega como base64 en JSON (evita depender de un parser multipart).
const MAX_BYTES = 6 * 1024 * 1024;

export async function uploadFile(body, auth) {
  const { name, type, data } = body || {};
  if (!data) throw new HttpError(400, 'Archivo vacío');
  const approxBytes = Math.floor(String(data).length * 0.75);
  if (approxBytes > MAX_BYTES) {
    throw new HttpError(413, 'El archivo supera el tamaño máximo permitido (≈4MB). Usa una imagen más liviana.');
  }
  const sql = getSql();
  const id = newId() + newId(); // 48 hex: no adivinable, se sirve sin auth para <img src>
  await sql.query(
    `INSERT INTO app_files (id, name, mime, size, content_b64, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name || 'archivo', type || 'application/octet-stream', approxBytes, String(data), auth?.email || null]
  );
  return { file_url: `/api/files/${id}` };
}

export async function serveFile(id, res) {
  const sql = getSql();
  const rows = await sql.query('SELECT * FROM app_files WHERE id = $1', [id]);
  const f = rows[0];
  if (!f) throw new HttpError(404, 'Archivo no existe');
  const buf = Buffer.from(f.content_b64, 'base64');
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name || 'archivo')}"`);
  res.statusCode = 200;
  res.end(buf);
}
