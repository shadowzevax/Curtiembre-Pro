import { HttpError } from '../util.js';
import { getSql } from '../db.js';
import { withTx } from './pool.js';
import { ensureFinSchema } from './schema.js';
import { requerirRol, anularOperacion } from './core.js';
import * as C from './consultas.js';
import * as S from './soportes.js';
import { OPERACIONES } from './operaciones.js';
import * as V from './comerciales.js';
import * as I from './integraciones.js';
import * as CN from './conciliacion.js';
import * as G from './gerencial.js';

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
  if (a === 'documentos' && !b && method === 'GET') return withTx((tx) => C.listarDocumentos(tx, { tipo: q.tipo, desde: q.desde, hasta: q.hasta }));
  if (a === 'documentos' && b && method === 'GET') return withTx((tx) => C.obtenerDocumento(tx, b));
  if (a === 'vinculos' && method === 'GET') return withTx((tx) => C.listarVinculos(tx, q.modulo, q.id));
  if (a === 'relacionados' && method === 'GET') {
    if (!q.modulo || !q.id) throw new HttpError(400, 'Faltan modulo e id');
    return withTx((tx) => C.relacionadosDeOrigen(tx, q.modulo, q.id));
  }

  // ── Operaciones financieras (cobro, pago, ingreso, egreso, transferencia, ajuste…) ──
  if (a === 'operaciones' && b && !c && method === 'POST') {
    const fn = OPERACIONES[b];
    if (!fn) throw new HttpError(404, `Operación desconocida: ${b}`);
    return withTx((tx) => fn(tx, ctx, body));
  }

  // ── Ventas y Compras: documento + inventario + finanzas en una transacción ──
  if (a === 'comercial' && (b === 'venta' || b === 'compra')) {
    const [, , id, accion] = segs;
    if (!id && method === 'POST') return withTx((tx) => V.registrarDocumento(tx, ctx, b, body));
    if (id && !accion && method === 'PUT') return withTx((tx) => V.editarDocumento(tx, ctx, b, id, body));
    if (id && accion === 'anular' && method === 'POST') return withTx((tx) => V.anularDocumento(tx, ctx, b, id, body));
    if (id && accion === 'devolucion' && method === 'POST') return withTx((tx) => V.devolverDocumento(tx, ctx, b, id, body));
    if (id && accion === 'devolucion' && segs[4] && segs[5] === 'anular' && method === 'POST') {
      return withTx((tx) => V.anularDevolucion(tx, ctx, b, id, segs[4], body));
    }
  }

  // ── Anulación genérica de operaciones financieras ──
  if (a === 'operaciones' && b && c === 'anular' && method === 'POST') {
    return withTx(async (tx) => {
      const { rows } = await tx.query(`SELECT tipo_operacion FROM fin_operaciones WHERE id = $1`, [b]);
      if (rows[0] && V.TIPOS_SOLO_POR_DOCUMENTO.includes(rows[0].tipo_operacion)) {
        throw new HttpError(409, 'Esta operación afecta inventario: anúlela desde la venta, compra o devolución correspondiente');
      }
      return anularOperacion(tx, ctx, { operacion_id: b, motivo: body.motivo, idempotency_key: body.idempotency_key });
    });
  }

  // ── Integraciones (B4): Costos Indirectos → Egreso, Procesos Externos → CxP ──
  if (a === 'integraciones') {
    if (b === 'costos-indirectos' && !c && method === 'GET') return withTx((tx) => I.costosIndirectosPendientes(tx));
    if (b === 'costos-indirectos' && c === 'pagar' && method === 'POST') return withTx((tx) => I.pagarCostoIndirecto(tx, ctx, body));
    if (b === 'procesos-externos' && !c && method === 'GET') return withTx((tx) => I.procesosExternosPendientes(tx));
    if (b === 'procesos-externos' && c === 'sincronizar' && method === 'POST') return withTx((tx) => I.sincronizarProcesosExternos(tx, ctx));
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

  // ── Conciliación bancaria (B6) ──
  if (a === 'conciliacion') {
    const [, id, sub, lineaId, accionLinea] = segs;
    if (!id && method === 'GET') return withTx((tx) => CN.listarConciliaciones(tx, { cuenta_id: q.cuenta_id }));
    if (!id && method === 'POST') return withTx((tx) => CN.crearConciliacion(tx, ctx, body));
    if (id && !sub && method === 'GET') return withTx((tx) => CN.detalleConciliacion(tx, id));
    if (id && sub === 'importar' && method === 'POST') return withTx((tx) => CN.importarLineas(tx, ctx, id, body.lineas));
    if (id && sub === 'sugerir' && method === 'POST') return withTx((tx) => CN.sugerirCoincidencias(tx, id));
    if (id && sub === 'sin-conciliar' && method === 'GET') return withTx(async (tx) => {
      const d = await CN.detalleConciliacion(tx, id);
      return CN.movimientosSinConciliar(tx, d.cuenta_id, { desde: q.desde, hasta: q.hasta });
    });
    if (id && sub === 'cerrar' && method === 'POST') return withTx((tx) => CN.cerrarConciliacion(tx, ctx, id));
    if (id && sub === 'reabrir' && method === 'POST') return withTx((tx) => CN.reabrirConciliacion(tx, ctx, id, body.motivo));
    if (id && sub === 'lineas' && lineaId && accionLinea === 'confirmar' && method === 'POST') {
      return withTx((tx) => CN.confirmarLinea(tx, ctx, lineaId, body.movimiento_id));
    }
    if (id && sub === 'lineas' && lineaId && accionLinea === 'desconciliar' && method === 'POST') {
      return withTx((tx) => CN.desconciliarLinea(tx, ctx, lineaId));
    }
    if (id && sub === 'lineas' && lineaId && accionLinea === 'ignorar' && method === 'POST') {
      return withTx((tx) => CN.ignorarLinea(tx, ctx, lineaId, body.motivo));
    }
  }

  // ── Bitácora, períodos y parámetros ──
  if (a === 'auditoria' && method === 'GET') return withTx((tx) => C.listarAuditoria(tx, ctx, q));
  if (a === 'periodos') {
    if (!b && method === 'GET') return withTx((tx) => C.listarPeriodos(tx));
    if (b === 'cerrar' && method === 'POST') return withTx((tx) => C.cerrarPeriodo(tx, ctx, body));
    if (b && c === 'reabrir' && method === 'POST') return withTx((tx) => C.reabrirPeriodo(tx, ctx, b, body.motivo));
  }
  if (a === 'parametros') {
    if (!b && method === 'GET') return withTx((tx) => C.listarParametros(tx));
    if (b && method === 'PUT') return withTx((tx) => C.actualizarParametro(tx, ctx, b, body.valor));
  }

  // ── Configuración Contable (B7) ──
  if (a === 'parametrizacion-contable') {
    if (!b && method === 'GET') return withTx((tx) => C.listarParametrizacionContable(tx));
    if (b && method === 'PUT') return withTx((tx) => C.asignarCuentaContable(tx, ctx, b, body.cuenta_contable_id));
  }
  if (a === 'terceros-config') {
    if (!b && method === 'GET') return withTx((tx) => C.listarTercerosConfig(tx));
    if (b && method === 'PUT') return withTx((tx) => C.configurarTercero(tx, ctx, b, body));
  }

  // ── Reportes (C1): movimientos sin conciliar, sin necesidad de una conciliación abierta ──
  if (a === 'movimientos-sin-conciliar' && method === 'GET') {
    return withTx((tx) => CN.movimientosSinConciliar(tx, q.cuenta_id, { desde: q.desde, hasta: q.hasta }));
  }

  // ── Indicadores y Resumen Gerencial (C2, solo lectura salvo notificar) ──
  if (a === 'gerencial' && b === 'resumen' && method === 'GET') return withTx((tx) => G.resumenGerencial(tx));
  if (a === 'gerencial' && b === 'flujo-caja' && method === 'GET') return withTx((tx) => G.flujoCajaProyectado(tx, { semanas: q.semanas ? Number(q.semanas) : undefined }));
  if (a === 'gerencial' && b === 'rentabilidad-clientes' && method === 'GET') return withTx((tx) => G.rentabilidadClientes(tx));
  if (a === 'gerencial' && b === 'notificar' && method === 'POST') return withTx((tx) => G.notificarTelegram(tx, ctx, body.texto));

  // ── Saldos y Balances, Impuestos y Retenciones (B7, solo lectura) ──
  if (a === 'saldos-cuenta-rol' && method === 'GET') return withTx((tx) => C.saldosPorCuentaRol(tx, { desde: q.desde, hasta: q.hasta }));
  if (a === 'retenciones' && method === 'GET') return withTx((tx) => C.listarRetenciones(tx, { rol: q.rol, tipo: q.tipo, desde: q.desde, hasta: q.hasta }));

  if (a === 'yo' && method === 'GET') return ctx;

  throw new HttpError(404, 'Ruta de Finanzas no encontrada');
}
