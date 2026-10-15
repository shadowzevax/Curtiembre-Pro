// Recibos de Caja y Comprobantes de Egreso como documentos formales. No crean nada: leen el
// documento que ya generó la operación (cobro, pago, ingreso, egreso, venta/compra de contado) y
// reúnen lo necesario para mostrarlo, imprimirlo y relacionarlo con su factura y su movimiento.
import { HttpError } from '../util.js';
import { r2 } from './core.js';
import { numeroVisibleVenta } from './comerciales.js';

const TIPO_CUENTA_A_FORMA = { caja: 'efectivo', banco: 'banco', otro_medio: 'otro_medio' };

// Cuenta afectada (primer movimiento real, sin GMF ni reversas) y factura relacionada por documento.
const SQL_LISTADO = `
  SELECT d.*,
    mov.cuenta_id, mov.cuenta_nombre, mov.cuenta_tipo,
    COALESCE(obl.documento_numero, d.datos->>'documento_origen') AS factura_relacionada,
    obl.id AS obligacion_id,
    rv.data->>'numero_id' AS v_numero_id, rv.data->>'numero_documento' AS v_numero_documento,
    rv.data->>'prefijo_documento' AS v_prefijo_documento
  FROM fin_documentos d
  LEFT JOIN LATERAL (
    SELECT m.cuenta_id, c.nombre AS cuenta_nombre, c.tipo AS cuenta_tipo
    FROM fin_movimientos_dinero m JOIN fin_cuentas_dinero c ON c.id = m.cuenta_id
    WHERE m.documento_id = d.id AND m.clase <> 'gmf' AND m.estado <> 'reversa'
    ORDER BY m.created_date LIMIT 1
  ) mov ON true
  LEFT JOIN LATERAL (
    SELECT o.id, o.documento_numero, o.documento_modulo, o.documento_id FROM fin_aplicaciones a JOIN fin_obligaciones o ON o.id = a.obligacion_id
    WHERE a.documento_id = d.id AND a.tipo <> 'reversa' ORDER BY a.created_date LIMIT 1
  ) obl ON true
  LEFT JOIN fin_operaciones opv ON opv.id = d.operacion_id
  LEFT JOIN records rv ON rv.entity = 'OrdenVenta'
    AND rv.id = CASE WHEN obl.documento_modulo = 'OrdenVenta' THEN obl.documento_id WHEN opv.origen_modulo = 'OrdenVenta' THEN opv.origen_id END`;

// Ventas: la factura relacionada se muestra con el No. de Documento que digitó el usuario.
function publico({ v_numero_id, v_numero_documento, v_prefijo_documento, ...d }) {
  const visible = v_numero_id ? numeroVisibleVenta({ numero_id: v_numero_id, numero_documento: v_numero_documento,
    prefijo_documento: v_prefijo_documento }) : null;
  return { ...d, factura_relacionada: visible || d.factura_relacionada, numero_interno_venta: v_numero_id || null, valor: r2(d.valor), forma_pago: d.medio_pago || TIPO_CUENTA_A_FORMA[d.cuenta_tipo] || null };
}

export async function listarDocumentosFinancieros(tx, { tipos, desde, hasta, estado } = {}) {
  const lista = String(tipos || 'RC').split(',').map((t) => t.trim()).filter(Boolean);
  const { rows } = await tx.query(
    `${SQL_LISTADO}
     WHERE d.tipo = ANY($1) AND ($2::date IS NULL OR d.fecha >= $2) AND ($3::date IS NULL OR d.fecha <= $3)
       AND ($4::text IS NULL OR d.estado = $4)
     ORDER BY d.fecha DESC, d.created_date DESC`, [lista, desde || null, hasta || null, estado || null]);
  return rows.map(publico);
}

export async function documentoImprimible(tx, numero) {
  const { rows } = await tx.query(`${SQL_LISTADO} WHERE d.numero = $1`, [numero]);
  if (!rows[0]) throw new HttpError(404, `El documento ${numero} no existe`);
  const doc = publico(rows[0]);

  const { rows: ops } = await tx.query(`SELECT * FROM fin_operaciones WHERE id = $1`, [doc.operacion_id]);
  const operacion = ops[0] || null;

  // Movimientos de dinero de la operación (el principal y, si lo hubo, el GMF 4x1000).
  const { rows: movs } = await tx.query(
    `SELECT m.clase, m.naturaleza, m.valor, c.nombre AS cuenta_nombre, c.tipo AS cuenta_tipo, c.numero AS cuenta_numero, c.entidad
     FROM fin_movimientos_dinero m JOIN fin_cuentas_dinero c ON c.id = m.cuenta_id
     WHERE m.operacion_id = $1 AND m.estado <> 'reversa' ORDER BY m.created_date`, [doc.operacion_id]);
  const principal = movs.find((m) => m.clase !== 'gmf') || null;
  const gmf = r2(movs.filter((m) => m.clase === 'gmf').reduce((s, m) => s + Number(m.valor), 0));

  // Saldo antes y después del pago, calculado desde el historial de la cuenta por cobrar/pagar.
  let saldo = null;
  if (doc.obligacion_id) {
    const { rows: ob } = await tx.query(`SELECT * FROM fin_obligaciones WHERE id = $1`, [doc.obligacion_id]);
    const { rows: apls } = await tx.query(
      `SELECT * FROM fin_aplicaciones WHERE obligacion_id = $1 ORDER BY created_date, id`, [doc.obligacion_id]);
    const primeraPropia = apls.findIndex((a) => a.documento_id === doc.id);
    const previas = apls.slice(0, Math.max(primeraPropia, 0)).reduce((s, a) => s + Number(a.valor), 0);
    const propias = apls.filter((a) => a.documento_id === doc.id && a.tipo !== 'reversa').reduce((s, a) => s + Number(a.valor), 0);
    const saldoAnterior = r2(Number(ob[0].valor_original) - previas);
    saldo = { valor_factura: r2(ob[0].valor_original), saldo_anterior: saldoAnterior, valor_aplicado: r2(propias),
      saldo_posterior: r2(saldoAnterior - propias) };
  } else if (doc.datos?.documento_origen) {
    // Venta o compra de contado: se paga completa en el mismo momento, no queda saldo.
    saldo = { valor_factura: doc.valor, saldo_anterior: doc.valor, valor_aplicado: doc.valor, saldo_posterior: 0 };
  }

  // Datos del tercero (identificación, dirección…) tal como están en Administración → Terceros.
  let tercero = { nombre: doc.tercero_nombre };
  if (doc.tercero_id) {
    const { rows: t } = await tx.query(`SELECT data FROM records WHERE entity = 'Tercero' AND id = $1`, [doc.tercero_id]);
    const d = t[0]?.data;
    if (d) tercero = { nombre: d.nombre || doc.tercero_nombre, tipo_identificacion: d.tipo_identificacion || null,
      identificacion: d.numero_identificacion || d.nit || null, direccion: d.direccion || null, telefono: d.telefono || null, email: d.email || null };
  }

  const { rows: u } = await tx.query(`SELECT full_name FROM app_users WHERE email = $1`, [doc.usuario]);
  const elaborado_por = u[0]?.full_name || doc.usuario || null;

  let anulacion = null;
  if (doc.estado === 'anulado') {
    const { rows: an } = await tx.query(
      `SELECT o.fecha, o.created_date, o.motivo, o.usuario, u.full_name FROM fin_operaciones o
       LEFT JOIN app_users u ON u.email = o.usuario WHERE o.anula_a = $1 ORDER BY o.created_date LIMIT 1`, [doc.operacion_id]);
    anulacion = an[0] ? { fecha: an[0].fecha, fecha_hora: an[0].created_date, motivo: an[0].motivo,
      usuario: an[0].full_name || an[0].usuario } : { motivo: operacion?.motivo || null };
  }

  return {
    ...doc,
    categoria: operacion?.datos?.categoria || null,
    tipo_operacion: operacion?.tipo_operacion || null,
    observaciones: doc.datos?.observaciones || null,
    retencion: doc.datos?.retencion || null,
    cuenta: principal ? { nombre: principal.cuenta_nombre, tipo: principal.cuenta_tipo, numero: principal.cuenta_numero, entidad: principal.entidad } : null,
    gmf,
    saldo,
    tercero,
    elaborado_por,
    anulacion,
  };
}
