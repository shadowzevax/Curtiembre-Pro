// Operaciones financieras (paso A3). Cada una es UNA transacción: documento + dinero +
// cartera + contabilidad + vínculos + bitácora, o nada. Todas son idempotentes.
import { HttpError } from '../util.js';
import {
  r2, dinero, fecha as validarFecha, requerirRol, iniciarOperacion, finalizarOperacion, crearDocumento, registrarMovimiento,
  crearObligacion, aplicarAObligacion, saldoObligacion, asiento, vincular, auditar,
} from './core.js';

const OPERAN = ['admin', 'contador'];

async function ejecutar(tx, ctx, def, fn) {
  const { operacion: op, duplicada } = await iniciarOperacion(tx, ctx, def);
  if (duplicada) return { ...(op.resultado || {}), operacion_id: op.id, duplicada: true };
  const resultado = await fn(op);
  return finalizarOperacion(tx, op.id, { operacion_id: op.id, ...resultado });
}

async function obligacionVigente(tx, id, naturalezas) {
  const { rows } = await tx.query(`SELECT * FROM fin_obligaciones WHERE id = $1`, [id]);
  const o = rows[0];
  if (!o) throw new HttpError(404, 'La cuenta por cobrar/pagar no existe');
  if (o.anulada) throw new HttpError(409, 'La cuenta por cobrar/pagar está anulada');
  if (naturalezas && !naturalezas.includes(o.naturaleza)) throw new HttpError(400, `La obligación seleccionada no es de tipo ${naturalezas.join(' o ')}`);
  return o;
}

async function vincularConOrigen(tx, obl, documento) {
  await vincular(tx, 'fin_obligaciones', obl.id, 'fin_documentos', documento.id, 'abono');
  if (obl.documento_modulo && obl.documento_id) {
    await vincular(tx, obl.documento_modulo, obl.documento_id, 'fin_documentos', documento.id, 'documento_relacionado');
  }
}

function retencionDe(body) {
  const r = body.retencion;
  if (!r || !(Number(r.valor) > 0)) return null;
  if (!['retefuente', 'reteiva', 'reteica', 'otra'].includes(r.tipo)) throw new HttpError(400, 'Tipo de retención inválido');
  return { tipo: r.tipo, valor: dinero(r.valor, 'valor de la retención'), base: r.base ? dinero(r.base, 'base') : null,
    tarifa: r.tarifa ? Number(r.tarifa) : null };
}

async function registrarRetencion(tx, op, obl, rol, ret, f) {
  const { rows } = await tx.query(
    `INSERT INTO fin_retenciones (id, operacion_id, obligacion_id, rol, tipo, base, tarifa, valor, tercero_id, tercero_nombre, fecha, origen_clave)
     VALUES (md5(random()::text || clock_timestamp()::text), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [op.id, obl?.id || null, rol, ret.tipo, ret.base, ret.tarifa, ret.valor, obl?.tercero_id || op.tercero_id, obl?.tercero_nombre || op.tercero_nombre,
      f, `ret:${op.id}:${ret.tipo}`]);
  return rows[0];
}

// ── Cobro de cartera (CxC) → Recibo de Caja ──────────────────────────────────
export async function cobro(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar cobros');
  const obl = await obligacionVigente(tx, body.obligacion_id, ['por_cobrar']);
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  const ret = retencionDe(body);
  return ejecutar(tx, ctx, { tipo_operacion: 'cobro', fecha: f, idempotency_key: body.idempotency_key, tercero_id: obl.tercero_id,
    tercero_nombre: obl.tercero_nombre, valor, concepto: body.concepto || `Cobro ${obl.documento_numero || ''}`.trim(),
    origen_modulo: 'fin_obligaciones', origen_id: obl.id }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'RC', fecha: f, operacion_id: op.id, tercero_id: obl.tercero_id,
      tercero_nombre: obl.tercero_nombre, concepto: op.concepto, valor, medio_pago: body.medio_pago,
      datos: { obligacion_id: obl.id, documento_origen: obl.documento_numero, retencion: ret } });
    const { movimiento } = await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: 'entrada',
      clase: 'ingreso', valor, concepto: `${doc.numero} · ${op.concepto}`, tercero_id: obl.tercero_id, tercero_nombre: obl.tercero_nombre,
      documento_id: doc.id, origen_clave: `cobro:${op.id}`, contable: { documento_numero: doc.numero } });
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'abono', valor, fecha: f, concepto: doc.numero,
      movimiento_id: movimiento.id, documento_id: doc.id, origen_clave: `cobro:${op.id}:abono` });
    if (ret) {
      await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'retencion', valor: ret.valor, fecha: f,
        concepto: `Retención ${ret.tipo}`, documento_id: doc.id, origen_clave: `cobro:${op.id}:ret` });
      await registrarRetencion(tx, op, obl, 'recibida', ret, f);
    }
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor },
      { naturaleza: 'debito', cuenta_rol: 'retencion_a_favor', valor: ret?.valor || 0 },
      { naturaleza: 'credito', cuenta_rol: 'cxc', valor: r2(valor + (ret?.valor || 0)) },
    ], { clave: `cobro:${op.id}`, fecha: f, documento_numero: doc.numero });
    await vincularConOrigen(tx, obl, doc);
    return { documento: { id: doc.id, numero: doc.numero }, saldo_pendiente: await saldoObligacion(tx, obl.id) };
  });
}

// ── Pago a proveedor (CxP) → Comprobante de Egreso ───────────────────────────
export async function pago(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar pagos');
  const obl = await obligacionVigente(tx, body.obligacion_id, ['por_pagar']);
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  const ret = retencionDe(body);
  return ejecutar(tx, ctx, { tipo_operacion: 'pago', fecha: f, idempotency_key: body.idempotency_key, tercero_id: obl.tercero_id,
    tercero_nombre: obl.tercero_nombre, valor, concepto: body.concepto || `Pago ${obl.documento_numero || ''}`.trim(),
    origen_modulo: 'fin_obligaciones', origen_id: obl.id }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'CE', fecha: f, operacion_id: op.id, tercero_id: obl.tercero_id,
      tercero_nombre: obl.tercero_nombre, concepto: op.concepto, valor, medio_pago: body.medio_pago,
      datos: { obligacion_id: obl.id, documento_origen: obl.documento_numero, retencion: ret } });
    const { movimiento } = await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: 'salida',
      clase: 'egreso', valor, concepto: `${doc.numero} · ${op.concepto}`, tercero_id: obl.tercero_id, tercero_nombre: obl.tercero_nombre,
      documento_id: doc.id, origen_clave: `pago:${op.id}`, contable: { documento_numero: doc.numero } });
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'abono', valor, fecha: f, concepto: doc.numero,
      movimiento_id: movimiento.id, documento_id: doc.id, origen_clave: `pago:${op.id}:abono` });
    if (ret) {
      await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'retencion', valor: ret.valor, fecha: f,
        concepto: `Retención ${ret.tipo}`, documento_id: doc.id, origen_clave: `pago:${op.id}:ret` });
      await registrarRetencion(tx, op, obl, 'practicada', ret, f);
    }
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'cxp', valor: r2(valor + (ret?.valor || 0)) },
      { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor },
      { naturaleza: 'credito', cuenta_rol: 'retencion_por_pagar', valor: ret?.valor || 0 },
    ], { clave: `pago:${op.id}`, fecha: f, documento_numero: doc.numero });
    await vincularConOrigen(tx, obl, doc);
    return { documento: { id: doc.id, numero: doc.numero }, saldo_pendiente: await saldoObligacion(tx, obl.id) };
  });
}

// ── Otros ingresos / egresos (Tesorería) ─────────────────────────────────────
const ROLES_INGRESO = { otros_ingresos: 'otros_ingresos', financiero: 'ingreso_financiero', reintegro: 'reintegros' };
const ROLES_EGRESO = { gasto_general: 'gasto_general', costo_indirecto: 'costo_indirecto', nomina: 'gasto_nomina',
  impuestos: 'impuestos_pagados', otros: 'otros_egresos' };

export async function ingreso(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar ingresos');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  if (!body.concepto) throw new HttpError(400, 'El concepto del ingreso es obligatorio');
  const rol = ROLES_INGRESO[body.categoria || 'otros_ingresos'];
  if (!rol) throw new HttpError(400, 'Categoría de ingreso inválida');
  return ejecutar(tx, ctx, { tipo_operacion: 'ingreso', fecha: f, idempotency_key: body.idempotency_key, tercero_id: body.tercero_id,
    tercero_nombre: body.tercero_nombre, valor, concepto: body.concepto, origen_modulo: body.origen_modulo, origen_id: body.origen_id,
    datos: { categoria: body.categoria } }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'CIN', fecha: f, operacion_id: op.id, tercero_id: body.tercero_id,
      tercero_nombre: body.tercero_nombre, concepto: body.concepto, valor, medio_pago: body.medio_pago });
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: 'entrada', clase: 'ingreso', valor,
      concepto: `${doc.numero} · ${body.concepto}`, tercero_id: body.tercero_id, tercero_nombre: body.tercero_nombre, documento_id: doc.id,
      origen_clave: `ingreso:${op.id}` });
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor },
      { naturaleza: 'credito', cuenta_rol: rol, valor },
    ], { clave: `ingreso:${op.id}`, fecha: f, documento_numero: doc.numero });
    if (body.origen_modulo && body.origen_id) await vincular(tx, body.origen_modulo, body.origen_id, 'fin_documentos', doc.id, 'pago');
    return { documento: { id: doc.id, numero: doc.numero } };
  });
}

export async function egreso(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar egresos');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  if (!body.concepto) throw new HttpError(400, 'El concepto del egreso es obligatorio');
  const rol = ROLES_EGRESO[body.categoria || 'gasto_general'];
  if (!rol) throw new HttpError(400, 'Categoría de egreso inválida');
  const ret = retencionDe(body);
  return ejecutar(tx, ctx, { tipo_operacion: 'egreso', fecha: f, idempotency_key: body.idempotency_key, tercero_id: body.tercero_id,
    tercero_nombre: body.tercero_nombre, valor, concepto: body.concepto, origen_modulo: body.origen_modulo, origen_id: body.origen_id,
    datos: { categoria: body.categoria, retencion: ret } }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'CE', fecha: f, operacion_id: op.id, tercero_id: body.tercero_id,
      tercero_nombre: body.tercero_nombre, concepto: body.concepto, valor, medio_pago: body.medio_pago, datos: { retencion: ret } });
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: 'salida', clase: 'egreso', valor,
      concepto: `${doc.numero} · ${body.concepto}`, tercero_id: body.tercero_id, tercero_nombre: body.tercero_nombre, documento_id: doc.id,
      origen_clave: `egreso:${op.id}`, contable: { documento_numero: doc.numero } });
    if (ret) await registrarRetencion(tx, op, null, 'practicada', ret, f);
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: rol, valor: r2(valor + (ret?.valor || 0)) },
      { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor },
      { naturaleza: 'credito', cuenta_rol: 'retencion_por_pagar', valor: ret?.valor || 0 },
    ], { clave: `egreso:${op.id}`, fecha: f, documento_numero: doc.numero });
    if (body.origen_modulo && body.origen_id) await vincular(tx, body.origen_modulo, body.origen_id, 'fin_documentos', doc.id, 'pago');
    return { documento: { id: doc.id, numero: doc.numero } };
  });
}

// ── Transferencia entre cuentas: no es ingreso ni gasto ──────────────────────
export async function transferencia(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar transferencias');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  if (!body.cuenta_origen_id || !body.cuenta_destino_id) throw new HttpError(400, 'Faltan la cuenta de origen y la de destino');
  if (body.cuenta_origen_id === body.cuenta_destino_id) throw new HttpError(400, 'La cuenta de origen y la de destino deben ser distintas');
  const concepto = body.concepto || 'Transferencia entre cuentas';
  return ejecutar(tx, ctx, { tipo_operacion: 'transferencia', fecha: f, idempotency_key: body.idempotency_key, valor, concepto,
    datos: { origen: body.cuenta_origen_id, destino: body.cuenta_destino_id } }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'TR', fecha: f, operacion_id: op.id, concepto, valor,
      datos: { cuenta_origen_id: body.cuenta_origen_id, cuenta_destino_id: body.cuenta_destino_id } });
    const { cuenta: origen } = await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_origen_id, fecha: f, naturaleza: 'salida',
      clase: 'transferencia', valor, concepto: `${doc.numero} · ${concepto}`, documento_id: doc.id, origen_clave: `tr:${op.id}:salida`,
      sin_gmf: !!body.exenta_gmf, contable: { documento_numero: doc.numero } });
    const { cuenta: destino } = await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_destino_id, fecha: f, naturaleza: 'entrada',
      clase: 'transferencia', valor, concepto: `${doc.numero} · ${concepto}`, documento_id: doc.id, origen_clave: `tr:${op.id}:entrada` });
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: destino.id, valor },
      { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: origen.id, valor },
    ], { clave: `tr:${op.id}`, fecha: f, documento_numero: doc.numero });
    return { documento: { id: doc.id, numero: doc.numero }, origen: origen.nombre, destino: destino.nombre };
  });
}

// ── Ajuste de caja / diferencia de arqueo (solo administrador) ───────────────
export async function ajuste(tx, ctx, body) {
  requerirRol(ctx, ['admin'], 'registrar ajustes de caja');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  if (!['entrada', 'salida'].includes(body.naturaleza)) throw new HttpError(400, 'Indique si el ajuste es un sobrante (entrada) o un faltante (salida)');
  if (!body.motivo || String(body.motivo).trim().length < 5) throw new HttpError(400, 'El motivo del ajuste es obligatorio');
  const concepto = `Ajuste (${body.naturaleza === 'entrada' ? 'sobrante' : 'faltante'}): ${body.motivo}`;
  return ejecutar(tx, ctx, { tipo_operacion: 'ajuste', fecha: f, idempotency_key: body.idempotency_key, valor, concepto,
    motivo: body.motivo, datos: { arqueo_id: body.arqueo_id || null } }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'AJ', fecha: f, operacion_id: op.id, concepto, valor });
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: body.naturaleza, clase: 'ajuste', valor,
      concepto: `${doc.numero} · ${concepto}`, documento_id: doc.id, origen_clave: `aj:${op.id}`, sin_gmf: true });
    await asiento(tx, ctx, op, body.naturaleza === 'entrada'
      ? [{ naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }, { naturaleza: 'credito', cuenta_rol: 'sobrantes_caja', valor }]
      : [{ naturaleza: 'debito', cuenta_rol: 'faltantes_caja', valor }, { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }],
    { clave: `aj:${op.id}`, fecha: f, documento_numero: doc.numero });
    await auditar(tx, ctx, { accion: 'ajuste', entidad: 'fin_cuentas_dinero', entidad_id: body.cuenta_id, operacion_id: op.id,
      despues: { naturaleza: body.naturaleza, valor }, motivo: body.motivo });
    return { documento: { id: doc.id, numero: doc.numero } };
  });
}

// ── Movimientos propios del banco: comisiones, cuota de manejo, intereses ────
export async function movimientoBancario(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar movimientos bancarios');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  const tipos = { comision: ['salida', 'comision', 'gasto_bancario'], cuota_manejo: ['salida', 'comision', 'gasto_bancario'],
    interes: ['entrada', 'interes', 'ingreso_financiero'] };
  const t = tipos[body.tipo];
  if (!t) throw new HttpError(400, 'Tipo inválido (comision, cuota_manejo o interes)');
  const [naturaleza, clase, rol] = t;
  const concepto = body.concepto || { comision: 'Comisión bancaria', cuota_manejo: 'Cuota de manejo', interes: 'Intereses' }[body.tipo];
  return ejecutar(tx, ctx, { tipo_operacion: `banco_${body.tipo}`, fecha: f, idempotency_key: body.idempotency_key, valor, concepto,
    datos: { extracto_linea_id: body.extracto_linea_id || null } }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: naturaleza === 'salida' ? 'CE' : 'CIN', fecha: f, operacion_id: op.id, concepto, valor });
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza, clase, valor,
      concepto: `${doc.numero} · ${concepto}`, documento_id: doc.id, origen_clave: `banco:${op.id}`, sin_gmf: true });
    await asiento(tx, ctx, op, naturaleza === 'salida'
      ? [{ naturaleza: 'debito', cuenta_rol: rol, valor }, { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }]
      : [{ naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }, { naturaleza: 'credito', cuenta_rol: rol, valor }],
    { clave: `banco:${op.id}`, fecha: f, documento_numero: doc.numero });
    return { documento: { id: doc.id, numero: doc.numero } };
  });
}

// ── Anticipos (dinero recibido o entregado antes de la venta/compra) ─────────
export async function anticipo(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar anticipos');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  const esCliente = body.tipo === 'cliente';
  if (!['cliente', 'proveedor'].includes(body.tipo)) throw new HttpError(400, 'Tipo de anticipo inválido (cliente o proveedor)');
  if (!body.tercero_id && !body.tercero_nombre) throw new HttpError(400, 'El anticipo debe tener un tercero');
  const concepto = body.concepto || `Anticipo ${esCliente ? 'de cliente' : 'a proveedor'}`;
  return ejecutar(tx, ctx, { tipo_operacion: `anticipo_${body.tipo}`, fecha: f, idempotency_key: body.idempotency_key,
    tercero_id: body.tercero_id, tercero_nombre: body.tercero_nombre, valor, concepto }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: esCliente ? 'RC' : 'CE', fecha: f, operacion_id: op.id, tercero_id: body.tercero_id,
      tercero_nombre: body.tercero_nombre, concepto, valor, medio_pago: body.medio_pago });
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: esCliente ? 'entrada' : 'salida',
      clase: esCliente ? 'ingreso' : 'egreso', valor, concepto: `${doc.numero} · ${concepto}`, tercero_id: body.tercero_id,
      tercero_nombre: body.tercero_nombre, documento_id: doc.id, origen_clave: `ant:${op.id}`, contable: { documento_numero: doc.numero } });
    const obl = await crearObligacion(tx, ctx, op, { naturaleza: esCliente ? 'anticipo_cliente' : 'anticipo_proveedor', clase: 'anticipo',
      tercero_id: body.tercero_id, tercero_nombre: body.tercero_nombre, documento_modulo: 'fin_documentos', documento_id: doc.id,
      documento_numero: doc.numero, fecha: f, valor_original: valor, concepto, origen_clave: `ant:${op.id}:obl` });
    await asiento(tx, ctx, op, esCliente
      ? [{ naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }, { naturaleza: 'credito', cuenta_rol: 'anticipo_clientes', valor }]
      : [{ naturaleza: 'debito', cuenta_rol: 'anticipo_proveedores', valor }, { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor }],
    { clave: `ant:${op.id}`, fecha: f, documento_numero: doc.numero });
    return { documento: { id: doc.id, numero: doc.numero }, anticipo_id: obl.id };
  });
}

export async function cruceAnticipo(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'cruzar anticipos');
  const ant = await obligacionVigente(tx, body.anticipo_id, ['anticipo_cliente', 'anticipo_proveedor']);
  const esCliente = ant.naturaleza === 'anticipo_cliente';
  const obl = await obligacionVigente(tx, body.obligacion_id, [esCliente ? 'por_cobrar' : 'por_pagar']);
  if (ant.tercero_id && obl.tercero_id && ant.tercero_id !== obl.tercero_id) throw new HttpError(409, 'El anticipo y la cuenta son de terceros distintos');
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  return ejecutar(tx, ctx, { tipo_operacion: 'cruce_anticipo', fecha: f, idempotency_key: body.idempotency_key, tercero_id: obl.tercero_id,
    tercero_nombre: obl.tercero_nombre, valor, concepto: `Cruce de anticipo ${ant.documento_numero} con ${obl.documento_numero}` }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: 'CR', fecha: f, operacion_id: op.id, tercero_id: obl.tercero_id,
      tercero_nombre: obl.tercero_nombre, concepto: op.concepto, valor });
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: ant.id, tipo: 'cruce_anticipo', valor, fecha: f, concepto: doc.numero,
      documento_id: doc.id, origen_clave: `cruce:${op.id}:ant` });
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'cruce_anticipo', valor, fecha: f, concepto: doc.numero,
      documento_id: doc.id, origen_clave: `cruce:${op.id}:obl` });
    await asiento(tx, ctx, op, esCliente
      ? [{ naturaleza: 'debito', cuenta_rol: 'anticipo_clientes', valor }, { naturaleza: 'credito', cuenta_rol: 'cxc', valor }]
      : [{ naturaleza: 'debito', cuenta_rol: 'cxp', valor }, { naturaleza: 'credito', cuenta_rol: 'anticipo_proveedores', valor }],
    { clave: `cruce:${op.id}`, fecha: f, documento_numero: doc.numero });
    await vincularConOrigen(tx, obl, doc);
    return { documento: { id: doc.id, numero: doc.numero }, saldo_pendiente: await saldoObligacion(tx, obl.id),
      saldo_anticipo: await saldoObligacion(tx, ant.id) };
  });
}

// ── Notas crédito / débito sobre una CxC o CxP ───────────────────────────────
export async function nota(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar notas crédito o débito');
  const obl = await obligacionVigente(tx, body.obligacion_id, ['por_cobrar', 'por_pagar']);
  const f = validarFecha(body.fecha);
  const valor = dinero(body.valor);
  if (!['credito', 'debito'].includes(body.tipo)) throw new HttpError(400, 'Tipo de nota inválido (credito o debito)');
  if (!body.motivo || String(body.motivo).trim().length < 5) throw new HttpError(400, 'El motivo de la nota es obligatorio');
  const esNC = body.tipo === 'credito';
  return ejecutar(tx, ctx, { tipo_operacion: `nota_${body.tipo}`, fecha: f, idempotency_key: body.idempotency_key, tercero_id: obl.tercero_id,
    tercero_nombre: obl.tercero_nombre, valor, concepto: `Nota ${body.tipo} a ${obl.documento_numero}: ${body.motivo}`, motivo: body.motivo,
    origen_modulo: 'fin_obligaciones', origen_id: obl.id }, async (op) => {
    const doc = await crearDocumento(tx, ctx, { tipo: esNC ? 'NC' : 'ND', fecha: f, operacion_id: op.id, tercero_id: obl.tercero_id,
      tercero_nombre: obl.tercero_nombre, concepto: op.concepto, valor, datos: { obligacion_id: obl.id } });
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: esNC ? 'nota_credito' : 'nota_debito', valor: esNC ? valor : -valor,
      fecha: f, concepto: doc.numero, documento_id: doc.id, origen_clave: `nota:${op.id}` });
    // [débito, crédito] según el tipo de cuenta y de nota
    const [deb, cre] = {
      'por_cobrar:credito': ['descuentos_ventas', 'cxc'],
      'por_cobrar:debito': ['cxc', 'ingreso_ventas'],
      'por_pagar:credito': ['cxp', 'descuentos_compras'],
      'por_pagar:debito': ['costo_gasto_compra', 'cxp'],
    }[`${obl.naturaleza}:${body.tipo}`];
    await asiento(tx, ctx, op, [{ naturaleza: 'debito', cuenta_rol: deb, valor }, { naturaleza: 'credito', cuenta_rol: cre, valor }],
      { clave: `nota:${op.id}`, fecha: f, documento_numero: doc.numero });
    await vincularConOrigen(tx, obl, doc);
    return { documento: { id: doc.id, numero: doc.numero }, saldo_pendiente: await saldoObligacion(tx, obl.id) };
  });
}

// ── Retención registrada después (ej. el cliente la informa al pagar) ────────
export async function retencion(tx, ctx, body) {
  requerirRol(ctx, OPERAN, 'registrar retenciones');
  const obl = await obligacionVigente(tx, body.obligacion_id, ['por_cobrar', 'por_pagar']);
  const f = validarFecha(body.fecha);
  const ret = retencionDe({ retencion: body });
  if (!ret) throw new HttpError(400, 'Falta el valor de la retención');
  const esCxc = obl.naturaleza === 'por_cobrar';
  return ejecutar(tx, ctx, { tipo_operacion: 'retencion', fecha: f, idempotency_key: body.idempotency_key, tercero_id: obl.tercero_id,
    tercero_nombre: obl.tercero_nombre, valor: ret.valor, concepto: `Retención ${ret.tipo} sobre ${obl.documento_numero}`,
    origen_modulo: 'fin_obligaciones', origen_id: obl.id }, async (op) => {
    await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'retencion', valor: ret.valor, fecha: f,
      concepto: `Retención ${ret.tipo}`, origen_clave: `ret:${op.id}` });
    await registrarRetencion(tx, op, obl, esCxc ? 'recibida' : 'practicada', ret, f);
    await asiento(tx, ctx, op, esCxc
      ? [{ naturaleza: 'debito', cuenta_rol: 'retencion_a_favor', valor: ret.valor }, { naturaleza: 'credito', cuenta_rol: 'cxc', valor: ret.valor }]
      : [{ naturaleza: 'debito', cuenta_rol: 'cxp', valor: ret.valor }, { naturaleza: 'credito', cuenta_rol: 'retencion_por_pagar', valor: ret.valor }],
    { clave: `ret:${op.id}`, fecha: f, documento_numero: obl.documento_numero });
    return { saldo_pendiente: await saldoObligacion(tx, obl.id) };
  });
}

export const OPERACIONES = { cobro, pago, ingreso, egreso, transferencia, ajuste, banco: movimientoBancario, anticipo,
  'cruce-anticipo': cruceAnticipo, nota, retencion };
