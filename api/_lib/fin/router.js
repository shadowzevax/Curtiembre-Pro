import { HttpError } from '../util.js';
import { getSql } from '../db.js';
import { withTx } from './pool.js';
import { ensureFinSchema } from './schema.js';
import { requerirRol, anularOperacion } from './core.js';
import * as C from './consultas.js';
import * as S from './soportes.js';

const LECTURA = ['admin', 'contador'];

// El rol se toma de la base de datos en cada solicitud (no del token), así un usuario
// deshabilitado o al que le cambian el rol pierde el acceso de inmediato.
async function contexto(auth) {
  const rows = await getSql().query('SELECT email, role, full_name, disabled FROM app_users WHERE id = $1', [auth.sub]);
  const u = rows[0];
  if (!u || u.disabled) throw new HttpError(401, 'Usuario no autorizado');
  return { usuario: u.email, rol: u.role, nombre: u.full_name || u.email };
}

export async function handleFin(req, segs, auth) {
  await ensureFinSchema();
  const ctx = await contexto(auth);
  requerirRol(ctx, LECTURA, 'usar el módulo de Finanzas');
  const method = req.method.toUpperCase();
  const [a, b, c] = segs;
  const q = req.query || {};
  const body = req.body || {};

  // ── Cuentas de dinero ──
  if (a === 'cuentas') {
    if (!b && method === 'GET') return withTx((tx) => C.listarCuentas(tx, { tipo: q.tipo, incluir_inactivas: q.incluir_inactivas === '1' }));
    if (!b && method === 'POST') return withTx((tx) => C.crearCuenta(tx, ctx, body));
    if (b && !c && method === 'PUT') return withTx((tx) => C.actualizarCuenta(tx, ctx, b, body));
    if (b && c === 'libro' && method === 'GET') return withTx((tx) => C.libroCuenta(tx, b, { desde: q.desde, hasta: q.hasta }));
  }

  // ── Cuentas por cobrar / por pagar ──
  if (a === 'obligaciones' && method === 'GET') {
    if (!b) return withTx((tx) => C.listarObligaciones(tx, { naturaleza: q.naturaleza, tercero_id: q.tercero_id, estado: q.estado,
      incluir_anuladas: q.incluir_anuladas === '1' }));
    return withTx((tx) => C.detalleObligacion(tx, b));
  }

  // ── Documentos, vínculos y trazabilidad ──
  if (a === 'documentos' && b && method === 'GET') return withTx((tx) => C.obtenerDocumento(tx, b));
  if (a === 'vinculos' && method === 'GET') return withTx((tx) => C.listarVinculos(tx, q.modulo, q.id));
  if (a === 'relacionados' && method === 'GET') {
    if (!q.modulo || !q.id) throw new HttpError(400, 'Faltan modulo e id');
    return withTx((tx) => C.relacionadosDeOrigen(tx, q.modulo, q.id));
  }

  // ── Anulación genérica de operaciones financieras ──
  if (a === 'operaciones' && b && c === 'anular' && method === 'POST') {
    return withTx((tx) => anularOperacion(tx, ctx, { operacion_id: b, motivo: body.motivo, idempotency_key: body.idempotency_key }));
  }

  // ── Soportes ──
  if (a === 'soportes') {
    if (!b && method === 'GET') return withTx((tx) => S.listarSoportes(tx, { documento_modulo: q.modulo, documento_id: q.id }));
    if (b === 'subir' && method === 'POST') return withTx((tx) => S.solicitarSubida(tx, ctx, body));
    if (b && c === 'confirmar' && method === 'POST') return withTx((tx) => S.confirmarSubida(tx, ctx, b));
    if (b && c === 'url' && method === 'GET') return withTx((tx) => S.urlDescarga(tx, b, { descargar: q.descargar === '1' }));
    if (b && !c && method === 'DELETE') return withTx((tx) => S.eliminarSoporte(tx, ctx, b, q.motivo));
  }
  if (a === 'almacen' && b === 'uso' && method === 'GET') return withTx((tx) => S.usoAlmacen(tx));

  // ── Bitácora, períodos y parámetros ──
  if (a === 'auditoria' && method === 'GET') return withTx((tx) => C.listarAuditoria(tx, ctx, q));
  if (a === 'periodos') {
    if (!b && method === 'GET') return withTx((tx) => C.listarPeriodos(tx));
    if (b === 'cerrar' && method === 'POST') return withTx((tx) => C.cerrarPeriodo(tx, ctx, body));
    if (b && c === 'reabrir' && method === 'POST') return withTx((tx) => C.reabrirPeriodo(tx, ctx, b, body.motivo));
  }
  if (a === 'parametros' && method === 'GET') {
    return withTx(async (tx) => (await tx.query('SELECT clave, valor, descripcion FROM fin_parametros ORDER BY clave')).rows);
  }
  if (a === 'yo' && method === 'GET') return ctx;

  throw new HttpError(404, 'Ruta de Finanzas no encontrada');
}
