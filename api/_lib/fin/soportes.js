// Soportes (archivos adjuntos) en Cloudflare R2, bucket privado. La base de datos guarda solo la
// referencia; el archivo sube directo del navegador a R2 con una URL firmada de corta duración
// (evita el límite de 4,5 MB de las funciones) y se descarga con otra URL firmada tras validar sesión.
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { newId, HttpError } from '../util.js';
import { auditar } from './core.js';

let _s3 = null;
function s3() {
  if (!_s3) {
    const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new HttpError(500, 'El almacenamiento de soportes no está configurado (variables R2_*)');
    }
    _s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      // Sin esto, las versiones recientes del SDK agregan sumas de verificación a la URL firmada
      // que el navegador no envía, y la subida directa falla.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return _s3;
}
const bucket = () => process.env.R2_BUCKET;

const MIMES_PERMITIDOS = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf|application\/vnd\.(openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|ms-excel)|application\/msword|text\/(plain|csv))$/;

const nombreSeguro = (n) => String(n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);

export async function solicitarSubida(tx, ctx, body) {
  const { documento_modulo, documento_id, tipo_soporte, nombre, mime, tamano, observacion } = body || {};
  if (!documento_modulo || !documento_id) throw new HttpError(400, 'Falta el documento al que pertenece el soporte');
  if (!tipo_soporte) throw new HttpError(400, 'Falta el tipo de soporte');
  if (!MIMES_PERMITIDOS.test(String(mime || ''))) throw new HttpError(400, `Tipo de archivo no permitido (${mime || 'desconocido'}). Se aceptan imágenes, PDF, Excel, Word y texto.`);
  const { rows } = await tx.query(`SELECT valor FROM fin_parametros WHERE clave = 'soporte_max_mb'`);
  const maxMb = Number(rows[0]?.valor || 10);
  if (!(Number(tamano) > 0) || Number(tamano) > maxMb * 1024 * 1024) {
    throw new HttpError(413, `El archivo supera el tamaño máximo permitido (${maxMb} MB)`);
  }
  const id = newId();
  const clave = `soportes/${nombreSeguro(documento_modulo)}/${nombreSeguro(documento_id)}/${id}-${nombreSeguro(nombre)}`;
  await tx.query(
    `INSERT INTO fin_soportes (id, documento_modulo, documento_id, tipo_soporte, nombre, clave_almacen, mime, tamano, observacion,
       estado, usuario) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10)`,
    [id, documento_modulo, String(documento_id), tipo_soporte, String(nombre || 'archivo').slice(0, 200), clave, mime, Number(tamano),
      observacion || null, ctx.usuario]
  );
  const upload_url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: clave, ContentType: mime }), { expiresIn: 600 });
  return { id, upload_url };
}

export async function confirmarSubida(tx, ctx, id) {
  const { rows } = await tx.query(`SELECT * FROM fin_soportes WHERE id = $1 FOR UPDATE`, [id]);
  const s = rows[0];
  if (!s) throw new HttpError(404, 'El soporte no existe');
  if (s.estado === 'activo') return s;
  if (s.estado !== 'pendiente') throw new HttpError(409, 'El soporte fue eliminado');
  let head;
  try {
    head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: s.clave_almacen }));
  } catch {
    throw new HttpError(409, 'El archivo no llegó al almacenamiento; vuelve a intentar la subida');
  }
  const { rows: act } = await tx.query(
    `UPDATE fin_soportes SET estado = 'activo', tamano = $2 WHERE id = $1 RETURNING *`, [id, Number(head.ContentLength) || s.tamano]);
  await auditar(tx, ctx, { accion: 'soporte:adjuntar', entidad: 'fin_soportes', entidad_id: id,
    despues: { documento: `${s.documento_modulo}:${s.documento_id}`, nombre: s.nombre, tipo: s.tipo_soporte } });
  return act[0];
}

export async function urlDescarga(tx, id, { descargar = false } = {}) {
  const { rows } = await tx.query(`SELECT * FROM fin_soportes WHERE id = $1`, [id]);
  const s = rows[0];
  if (!s || s.estado === 'pendiente') throw new HttpError(404, 'El soporte no existe');
  if (s.url_externa && !s.clave_almacen) return { url: s.url_externa };
  const disposition = `${descargar ? 'attachment' : 'inline'}; filename="${nombreSeguro(s.nombre)}"`;
  const url = await getSignedUrl(s3(), new GetObjectCommand({
    Bucket: bucket(), Key: s.clave_almacen, ResponseContentDisposition: disposition, ResponseContentType: s.mime || undefined,
  }), { expiresIn: 300 });
  return { url };
}

// "Eliminar" un soporte lo oculta y deja constancia; el archivo no se borra del almacenamiento.
export async function eliminarSoporte(tx, ctx, id, motivo) {
  const { rows } = await tx.query(
    `UPDATE fin_soportes SET estado = 'eliminado', eliminado_por = $2, eliminado_en = now()
     WHERE id = $1 AND estado = 'activo' RETURNING *`, [id, ctx.usuario]);
  if (!rows[0]) throw new HttpError(404, 'El soporte no existe o ya fue eliminado');
  await auditar(tx, ctx, { accion: 'soporte:eliminar', entidad: 'fin_soportes', entidad_id: id,
    antes: { nombre: rows[0].nombre, documento: `${rows[0].documento_modulo}:${rows[0].documento_id}` }, motivo: motivo || null });
  return { ok: true };
}

export async function listarSoportes(tx, { documento_modulo, documento_id }) {
  const { rows } = await tx.query(
    `SELECT id, documento_modulo, documento_id, tipo_soporte, nombre, mime, tamano, observacion, usuario, created_date
     FROM fin_soportes WHERE documento_modulo = $1 AND documento_id = $2 AND estado = 'activo' ORDER BY created_date`,
    [documento_modulo, String(documento_id)]);
  return rows;
}

// Uso según la base de datos (los eliminados siguen ocupando espacio porque no se borran).
export async function usoAlmacen(tx) {
  const { rows } = await tx.query(
    `SELECT COALESCE(SUM(tamano), 0)::bigint AS bytes, count(*)::int AS archivos FROM fin_soportes WHERE estado <> 'pendiente'`);
  const { rows: p } = await tx.query(
    `SELECT clave, valor FROM fin_parametros WHERE clave IN ('almacen_alerta_gb','almacen_limite_gratis_gb')`);
  const par = Object.fromEntries(p.map((r) => [r.clave, Number(r.valor)]));
  const gb = Number(rows[0].bytes) / (1024 ** 3);
  return { bytes: Number(rows[0].bytes), gb: Math.round(gb * 1000) / 1000, archivos: rows[0].archivos,
    alerta_gb: par.almacen_alerta_gb ?? 8, limite_gratis_gb: par.almacen_limite_gratis_gb ?? 10,
    en_alerta: gb >= (par.almacen_alerta_gb ?? 8) };
}
