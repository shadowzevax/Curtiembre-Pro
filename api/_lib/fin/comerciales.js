// Ventas y Compras (paso A4): el documento, su inventario y su efecto financiero se guardan en
// UNA sola transacción del servidor. Reemplaza el bloque financiero que hacía el navegador
// (DocumentoComercialForm) y corrige los errores E1–E14 e I1–I6 de ARQUITECTURA-FINANZAS.md.
import { HttpError, newId } from '../util.js';
import {
  r2, dinero, fecha as validarFecha, hoyColombia, requerirRol, iniciarOperacion, finalizarOperacion, siguienteConsecutivo,
  crearDocumento, registrarMovimiento, crearObligacion, aplicarAObligacion, saldoObligacion, asiento, vincular, auditar,
  anularOperacion, sincronizarEstadoPago,
} from './core.js';
import {
  recCreate, recGet, recUpdate, registrarEntradasCompra, registrarSalidasVenta, revertirInventarioCompra, revertirInventarioVenta,
  registrarDevolucionInventario,
} from './inventario.js';

const OPERAN = ['admin', 'contador'];
const num = (v) => parseFloat(v) || 0;

const CONF = {
  venta: { entidad: 'OrdenVenta', terceroCampo: 'cliente_id', nitCampo: 'cc_nit_cliente', naturaleza: 'por_cobrar', docPago: 'RC',
    movimiento: 'entrada', clase: 'ingreso', totalCampo: 'valor_total_venta' },
  compra: { entidad: 'OrdenCompra', terceroCampo: 'proveedor_id', nitCampo: 'cc_nit_proveedor', naturaleza: 'por_pagar', docPago: 'CE',
    movimiento: 'salida', clase: 'egreso', totalCampo: 'valor_total_compra' },
};

function conf(tipo) {
  const c = CONF[tipo];
  if (!c) throw new HttpError(404, 'Tipo de documento inválido (venta o compra)');
  return c;
}

// Mismo cálculo del formulario (subtotal por ítem, IVA y retefuente por tasa), hecho en el
// servidor: no se confía en los totales que manda el navegador.
export function calcularTotales(items) {
  let bruto = 0; let iva = 0; let rete = 0;
  const limpios = (items || []).map((it) => {
    const cantidad = num(it.cantidad);
    const precio = num(it.precio_unitario);
    const subtotal = cantidad * precio;
    bruto += subtotal;
    iva += subtotal * num(it.iva);
    rete += subtotal * num(it.retefuente);
    return { ...it, cantidad, precio_unitario: precio, subtotal };
  });
  bruto = r2(bruto); iva = r2(iva); rete = r2(rete);
  return { items: limpios, bruto, iva, rete, neto: r2(bruto + iva - rete) };
}

async function nombreTercero(tx, doc, c) {
  if (doc.tercero_personalizado && !doc[c.terceroCampo]) return doc.tercero_personalizado;
  const id = doc[c.terceroCampo];
  if (!id) return '';
  const t = await recGet(tx, 'Tercero', id);
  return t?.nombre || (doc.tercero_personalizado || String(id));
}

const etiquetaEstado = (saldo, total, pagado) => (saldo <= 0.004 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente');

// ── Registrar venta / compra ─────────────────────────────────────────────────
export async function registrarDocumento(tx, ctx, tipo, body) {
  requerirRol(ctx, OPERAN, `registrar ${tipo === 'venta' ? 'ventas' : 'compras'}`);
  const c = conf(tipo);
  const entrada = body.documento || {};
  const { items, bruto, iva, rete, neto } = calcularTotales(entrada.items);
  if (!items.length) throw new HttpError(400, 'El documento no tiene ítems');
  if (neto <= 0) throw new HttpError(400, `El Total Neto debe ser mayor a cero para guardar la ${tipo}`);
  const fechaDoc = validarFecha(entrada.fecha_emision_documento || entrada.fecha_orden || hoyColombia(), 'fecha del documento');
  const condicion = entrada.condicion_pago;
  if (!['contado', 'credito', 'mixto'].includes(condicion)) throw new HttpError(400, 'Condición de pago inválida');
  let pagado = condicion === 'contado' ? neto : condicion === 'mixto' ? r2(num(entrada.valor_pagado)) : 0;
  if (condicion === 'mixto') {
    if (pagado <= 0) throw new HttpError(400, 'MIXTO requiere un Valor Pagado mayor a cero');
    if (tipo === 'venta' && pagado > neto) throw new HttpError(400, 'El Valor Pagado no puede ser mayor al Total Neto');
    if (tipo === 'compra' && pagado >= neto) throw new HttpError(400, 'El Valor Pagado no puede ser mayor o igual al Total Neto en modo Mixto');
  }
  pagado = r2(pagado);
  const saldo = r2(neto - pagado);
  if (saldo > 0 && !entrada.fecha_vencimiento) throw new HttpError(400, 'CRÉDITO / MIXTO requiere una Fecha de Vencimiento obligatoria');
  const cuentaId = body.cuenta_id || entrada.cuenta_destino_id;
  if (pagado > 0 && !cuentaId) throw new HttpError(400, 'Seleccione la caja, cuenta bancaria u otro medio por donde entra o sale el pago');

  const terceroNombre = await nombreTercero(tx, entrada, c);
  const terceroId = entrada[c.terceroCampo] || null;
  const estado = etiquetaEstado(saldo, neto, pagado);

  const ordenId = newId();
  {
    const { operacion: op, duplicada } = await iniciarOperacion(tx, ctx, {
      tipo_operacion: tipo, fecha: fechaDoc, idempotency_key: body.idempotency_key, tercero_id: terceroId, tercero_nombre: terceroNombre,
      valor: neto, concepto: `${tipo === 'venta' ? 'Venta' : 'Compra'} a ${terceroNombre || 'tercero'}`, origen_modulo: c.entidad,
      origen_id: ordenId,
    });
    if (duplicada) return { ...(op.resultado || {}), duplicada: true };

    // Consecutivo único del documento (antes lo calculaba el navegador y se repetía).
    const anio = Number(hoyColombia().slice(0, 4));
    const prefijo = entrada.prefijo || (tipo === 'venta' ? 'FV' : 'CH');
    const n = await siguienteConsecutivo(tx, `num:${prefijo}`, anio, async () => {
      const { rows } = await tx.query(
        `SELECT COALESCE(MAX((substring(data->>'numero_id' from '-\\d{4}-(\\d+)$'))::int), 0) AS m
         FROM records WHERE entity = $1 AND data->>'numero_id' LIKE $2`, [c.entidad, `${prefijo}-${anio}-%`]);
      return rows[0].m;
    });
    const numero_id = `${prefijo}-${anio}-${String(n).padStart(4, '0')}`;

    const datos = {
      ...entrada, items, numero_id, prefijo,
      fecha_orden: fechaDoc, fecha_emision_documento: fechaDoc,
      subtotal: bruto, iva_total: iva, retefuente_total: rete, total: neto,
      [c.totalCampo]: neto, valor_pagado: pagado, saldo_pendiente: saldo,
      cuenta_destino_id: pagado > 0 ? cuentaId : '', estado_documento: estado, estado,
      fin_operacion_id: op.id, anulado: false,
    };
    if (tipo === 'compra' && datos.afecta_inventario && !datos.codigo_lote_inventario && prefijo === 'CH') {
      datos.codigo_lote_inventario = `LOTE-${Date.now()}`;
    }
    const orden = await recCreate(tx, ctx, c.entidad, datos, { id: ordenId });

    // Inventario con el mecanismo existente (mismas fórmulas), dentro de la misma transacción.
    const inv = tipo === 'compra'
      ? await registrarEntradasCompra(tx, ctx, { doc: datos, docId: orden.id })
      : await registrarSalidasVenta(tx, ctx, { doc: datos, docId: orden.id });

    const documentos = [];
    const contable = { documento_numero: numero_id, modulo_origen: c.entidad };
    let obl = null;
    if (saldo > 0) {
      // La CxC/CxP nace por el TOTAL; lo pagado de una vez queda como abono (se conserva el valor original).
      obl = await crearObligacion(tx, ctx, op, { naturaleza: c.naturaleza, tercero_id: terceroId, tercero_nombre: terceroNombre,
        tercero_nit: entrada[c.nitCampo] || null, documento_modulo: c.entidad, documento_id: orden.id, documento_numero: numero_id,
        fecha: fechaDoc, fecha_vencimiento: validarFecha(entrada.fecha_vencimiento, 'fecha de vencimiento'), valor_original: neto,
        concepto: op.concepto, origen_clave: `${c.entidad}:${orden.id}:obligacion` });
    }
    if (pagado > 0) {
      const doc = await crearDocumento(tx, ctx, { tipo: c.docPago, fecha: fechaDoc, operacion_id: op.id, tercero_id: terceroId,
        tercero_nombre: terceroNombre, concepto: `${tipo === 'venta' ? 'Pago de la venta' : 'Pago de la compra'} ${numero_id}`, valor: pagado,
        medio_pago: entrada.forma_pago, datos: { documento_origen: numero_id } });
      documentos.push({ id: doc.id, numero: doc.numero, tipo: doc.tipo });
      const { movimiento } = await registrarMovimiento(tx, ctx, op, { cuenta_id: cuentaId, fecha: fechaDoc, naturaleza: c.movimiento,
        clase: c.clase, valor: pagado, concepto: `${doc.numero} · ${numero_id} · ${terceroNombre}`, tercero_id: terceroId,
        tercero_nombre: terceroNombre, documento_id: doc.id, origen_clave: `${c.entidad}:${orden.id}:pago_inicial`, contable });
      if (obl) {
        await aplicarAObligacion(tx, ctx, op, { obligacion_id: obl.id, tipo: 'abono', valor: pagado, fecha: fechaDoc, concepto: doc.numero,
          movimiento_id: movimiento.id, documento_id: doc.id, origen_clave: `${c.entidad}:${orden.id}:abono_inicial` });
      }
      await vincular(tx, c.entidad, orden.id, 'fin_documentos', doc.id, 'documento_relacionado');
    }
    if (rete > 0) {
      await tx.query(
        `INSERT INTO fin_retenciones (id, operacion_id, obligacion_id, rol, tipo, base, valor, tercero_id, tercero_nombre, fecha, origen_clave)
         VALUES (md5(random()::text || clock_timestamp()::text), $1,$2,$3,'retefuente',$4,$5,$6,$7,$8,$9)`,
        [op.id, obl?.id || null, tipo === 'venta' ? 'recibida' : 'practicada', bruto, rete, terceroId, terceroNombre, fechaDoc,
          `${c.entidad}:${orden.id}:retefuente`]);
    }

    const lineas = tipo === 'venta'
      ? [
        { naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: cuentaId, valor: pagado },
        { naturaleza: 'debito', cuenta_rol: 'cxc', valor: saldo },
        { naturaleza: 'debito', cuenta_rol: 'retencion_a_favor', valor: rete },
        { naturaleza: 'credito', cuenta_rol: entrada.tipo_venta === 'servicios' ? 'ingreso_servicios' : 'ingreso_ventas', valor: bruto },
        { naturaleza: 'credito', cuenta_rol: 'iva_generado', valor: iva },
      ]
      : [
        { naturaleza: 'debito', cuenta_rol: datos.afecta_inventario ? 'inventario' : 'costo_gasto_compra', valor: bruto },
        { naturaleza: 'debito', cuenta_rol: 'iva_descontable', valor: iva },
        { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: cuentaId, valor: pagado },
        { naturaleza: 'credito', cuenta_rol: 'cxp', valor: saldo },
        { naturaleza: 'credito', cuenta_rol: 'retencion_por_pagar', valor: rete },
      ];
    await asiento(tx, ctx, op, lineas, { clave: `${c.entidad}:${orden.id}`, fecha: fechaDoc, ...contable });
    await vincular(tx, c.entidad, orden.id, 'fin_operaciones', op.id, 'operacion');

    const resultado = { operacion_id: op.id, orden_id: orden.id, numero_id, total: neto, pagado, saldo, estado,
      obligacion_id: obl?.id || null, documentos, advertencias: inv.advertencias };
    return finalizarOperacion(tx, op.id, resultado);
  }
}

// ── Edición limitada (D4) ────────────────────────────────────────────────────
// Un documento ya registrado afectó inventario y finanzas: solo se editan datos que no los
// alteran. Para cambiar valores se anula y se registra de nuevo, o se usa nota/devolución.
const clavesItem = (items) => JSON.stringify((items || []).map((it) => [it.codigo || '', num(it.cantidad), num(it.precio_unitario),
  num(it.iva), num(it.retefuente)]));
const PROTEGIDOS = ['condicion_pago', 'forma_pago', 'cuenta_destino_id', 'prefijo', 'prefijo_documento', 'numero_documento',
  'afecta_inventario', 'tercero_personalizado'];

export async function editarDocumento(tx, ctx, tipo, id, body) {
  requerirRol(ctx, OPERAN, `editar ${tipo === 'venta' ? 'ventas' : 'compras'}`);
  const c = conf(tipo);
  const actual = await recGet(tx, c.entidad, id, { lock: true });
  if (!actual) throw new HttpError(404, 'El documento no existe');
  if (actual.anulado || actual.estado_documento === 'anulado') throw new HttpError(409, 'El documento está anulado');
  const nuevo = body.documento || {};
  const cambios = [];
  if (nuevo.items !== undefined && clavesItem(nuevo.items) !== clavesItem(actual.items)) cambios.push('ítems, cantidades o precios');
  const sinPago = !(num(actual.valor_pagado) > 0);
  for (const campo of [...PROTEGIDOS, c.terceroCampo]) {
    if (sinPago && (campo === 'cuenta_destino_id' || campo === 'forma_pago')) continue;
    if (nuevo[campo] !== undefined && String(nuevo[campo] ?? '') !== String(actual[campo] ?? '')) cambios.push(campo);
  }
  const fNuevo = nuevo.fecha_emision_documento || nuevo.fecha_orden;
  if (fNuevo && fNuevo !== (actual.fecha_emision_documento || actual.fecha_orden)) cambios.push('fecha');
  if (condicionPagada({ ...actual, ...nuevo }) !== condicionPagada(actual)) cambios.push('valor pagado');
  if (cambios.length) {
    throw new HttpError(409, `Este documento ya afectó el inventario y las finanzas, así que no se puede cambiar: ${[...new Set(cambios)].join(', ')}. Para corregirlo, anúlelo y regístrelo de nuevo, o use una devolución o una nota crédito/débito.`);
  }
  const { items: _i, total: _t, subtotal: _s, iva_total: _iv, retefuente_total: _r, valor_pagado: _v, saldo_pendiente: _sp,
    numero_id: _n, estado_documento: _e, estado: _es, fin_operacion_id: _f, anulado: _a, [c.totalCampo]: _tc, ...permitidos } = nuevo;
  const actualizado = await recUpdate(tx, c.entidad, id, permitidos);
  if (nuevo.fecha_vencimiento && nuevo.fecha_vencimiento !== actual.fecha_vencimiento) {
    await tx.query(`UPDATE fin_obligaciones SET fecha_vencimiento = $2 WHERE documento_modulo = $1 AND documento_id = $3 AND NOT anulada`,
      [c.entidad, validarFecha(nuevo.fecha_vencimiento, 'fecha de vencimiento'), id]);
  }
  await auditar(tx, ctx, { accion: `${tipo}:editar`, entidad: `records:${c.entidad}`, entidad_id: id,
    antes: Object.fromEntries(Object.keys(permitidos).map((k) => [k, actual[k]])), despues: permitidos });
  return { orden_id: id, numero_id: actualizado.numero_id };
}
const condicionPagada = (d) => (d.condicion_pago === 'mixto' ? r2(num(d.valor_pagado)) : d.condicion_pago || '');

// ── Anulación completa (D4 + D9): dinero, cartera, contabilidad e inventario ─
export async function anularDocumento(tx, ctx, tipo, id, body) {
  requerirRol(ctx, ['admin'], `anular ${tipo === 'venta' ? 'ventas' : 'compras'}`);
  const c = conf(tipo);
  const motivo = String(body.motivo || '').trim();
  if (motivo.length < 5) throw new HttpError(400, 'El motivo de la anulación es obligatorio');
  const doc = await recGet(tx, c.entidad, id, { lock: true });
  if (!doc) throw new HttpError(404, 'El documento no existe');
  if (doc.anulado || doc.estado_documento === 'anulado') throw new HttpError(409, 'El documento ya está anulado');
  const devVigentes = (doc.devoluciones || []).filter((d) => !d.anulada);
  if (devVigentes.length) {
    throw new HttpError(409, `No se puede anular: tiene devoluciones vigentes (${devVigentes.map((d) => d.numero).join(', ')}). Anule primero las devoluciones.`);
  }

  let anulacion;
  if (doc.fin_operacion_id) {
    const r = await anularOperacion(tx, ctx, { operacion_id: doc.fin_operacion_id, motivo, idempotency_key: body.idempotency_key });
    if (r.duplicada) return { ...(r.resultado || {}), duplicada: true };
    anulacion = r.anulacion;
  } else {
    // Documento anterior al motor (corte limpio): su parte financiera antigua no se toca.
    const r = await iniciarOperacion(tx, ctx, { tipo_operacion: 'anulacion_documento', fecha: hoyColombia(), idempotency_key: body.idempotency_key,
      valor: num(doc.total), concepto: `Anulación de ${doc.numero_id || id} (documento anterior al módulo financiero)`, origen_modulo: c.entidad,
      origen_id: id, motivo });
    if (r.duplicada) return { ...(r.operacion.resultado || {}), duplicada: true };
    anulacion = r.operacion;
  }
  const inv = tipo === 'compra'
    ? await revertirInventarioCompra(tx, ctx, { doc, docId: id, operacion_id: anulacion.id })
    : await revertirInventarioVenta(tx, ctx, { doc, docId: id, operacion_id: anulacion.id });
  await recUpdate(tx, c.entidad, id, { estado_documento: 'anulado', estado: 'anulado', anulado: true,
    anulacion: { fecha: hoyColombia(), usuario: ctx.usuario, motivo, operacion_id: anulacion.id } });
  await auditar(tx, ctx, { accion: `${tipo}:anular`, entidad: `records:${c.entidad}`, entidad_id: id, operacion_id: anulacion.id,
    antes: { estado: doc.estado_documento }, despues: { estado: 'anulado', movimientos_inventario_revertidos: inv.revertidos }, motivo });
  const resultado = { anulado: true, numero_id: doc.numero_id, movimientos_inventario_revertidos: inv.revertidos,
    financiero: doc.fin_operacion_id ? 'reversado' : 'documento anterior al módulo financiero: sin cambios financieros' };
  await finalizarOperacion(tx, anulacion.id, resultado);
  return resultado;
}

// ── Anular una devolución: su dinero/cartera y su inventario ─────────────────
export async function anularDevolucion(tx, ctx, tipo, id, numero, body) {
  requerirRol(ctx, ['admin'], 'anular devoluciones');
  const c = conf(tipo);
  const doc = await recGet(tx, c.entidad, id, { lock: true });
  if (!doc) throw new HttpError(404, 'El documento no existe');
  const dev = (doc.devoluciones || []).find((d) => d.numero === numero);
  if (!dev) throw new HttpError(404, `La devolución ${numero} no existe en este documento`);
  if (dev.anulada) throw new HttpError(409, 'La devolución ya está anulada');
  const { rows } = await tx.query(`SELECT operacion_id FROM fin_documentos WHERE numero = $1`, [numero]);
  if (!rows[0]) throw new HttpError(404, 'No se encontró la operación de la devolución');
  const r = await anularOperacion(tx, ctx, { operacion_id: rows[0].operacion_id, motivo: body.motivo, idempotency_key: body.idempotency_key });
  if (r.duplicada) return { ...(r.resultado || {}), duplicada: true };
  // Revierte los movimientos de inventario de la devolución (identificados por su documento único).
  const { rows: movs } = await tx.query(
    `SELECT * FROM records WHERE entity = 'MovimientoInventario' AND data->>'documento_origen_id' = $1`, [`${id}:${numero}`]);
  for (const row of movs) {
    const mov = { ...row.data, id: row.id };
    for (const e of ['ProductoTerminado', 'Insumo']) {
      const item = await recGet(tx, e, mov.insumo_id, { lock: true });
      if (!item) continue;
      const { rows: todos } = await tx.query(
        `SELECT data FROM records WHERE entity = 'MovimientoInventario' AND data @> $1::jsonb AND id <> $2`,
        [JSON.stringify({ insumo_id: mov.insumo_id }), mov.id]);
      const stock = todos.reduce((s, t) => s + num(t.data.cantidad), 0);
      if (stock < -1e-9) throw new HttpError(409, `No se puede anular la devolución: el stock de ${item.codigo || ''} quedaría negativo`);
      await recUpdate(tx, e, item.id, { stock_actual: stock });
      break;
    }
    await auditar(tx, ctx, { accion: 'inventario:eliminar_movimiento', entidad: 'records:MovimientoInventario', entidad_id: mov.id,
      operacion_id: r.anulacion.id, antes: mov, motivo: `Anulación de la devolución ${numero}` });
    await tx.query(`DELETE FROM records WHERE entity = 'MovimientoInventario' AND id = $1`, [mov.id]);
  }
  await recUpdate(tx, c.entidad, id, { devoluciones: doc.devoluciones.map((d) => (d.numero === numero ? { ...d, anulada: true } : d)) });
  return { anulada: numero, movimientos_inventario_revertidos: movs.length };
}

export const TIPOS_SOLO_POR_DOCUMENTO = ['venta', 'compra', 'devolucion_venta', 'devolucion_compra'];

// ── Devolución parcial o total ───────────────────────────────────────────────
export async function devolverDocumento(tx, ctx, tipo, id, body) {
  requerirRol(ctx, OPERAN, 'registrar devoluciones');
  const c = conf(tipo);
  const doc = await recGet(tx, c.entidad, id, { lock: true });
  if (!doc) throw new HttpError(404, 'El documento no existe');
  if (doc.anulado || doc.estado_documento === 'anulado') throw new HttpError(409, 'El documento está anulado');
  if (!doc.fin_operacion_id) throw new HttpError(409, 'Las devoluciones solo aplican a documentos registrados con el módulo financiero');
  const motivo = String(body.motivo || '').trim();
  if (motivo.length < 5) throw new HttpError(400, 'El motivo de la devolución es obligatorio');
  const f = validarFecha(body.fecha);

  const previas = doc.devoluciones || [];
  const devuelto = {};
  for (const d of previas.filter((p) => !p.anulada)) for (const l of d.lineas) devuelto[l.codigo] = (devuelto[l.codigo] || 0) + num(l.cantidad);
  let base = 0; let iva = 0; let rete = 0;
  const lineas = [];
  for (const l of body.lineas || []) {
    const cantidad = num(l.cantidad);
    if (cantidad <= 0) continue;
    const item = (doc.items || []).find((it) => it.codigo === l.codigo);
    if (!item) throw new HttpError(400, `El código ${l.codigo} no está en el documento`);
    const disponible = num(item.cantidad) - (devuelto[l.codigo] || 0);
    if (cantidad > disponible + 1e-9) throw new HttpError(409, `Solo se pueden devolver ${disponible} de ${l.codigo}`);
    const b = cantidad * num(item.precio_unitario);
    base += b; iva += b * num(item.iva); rete += b * num(item.retefuente);
    lineas.push({ codigo: l.codigo, descripcion: item.descripcion, cantidad, precio_unitario: num(item.precio_unitario), fecha: f });
  }
  if (!lineas.length) throw new HttpError(400, 'Indique qué cantidades se devuelven');
  base = r2(base); iva = r2(iva); rete = r2(rete);
  const neto = r2(base + iva - rete);

  const { operacion: op, duplicada } = await iniciarOperacion(tx, ctx, { tipo_operacion: `devolucion_${tipo}`, fecha: f,
    idempotency_key: body.idempotency_key, tercero_id: doc[c.terceroCampo] || null, valor: neto,
    concepto: `Devolución de ${tipo} ${doc.numero_id}: ${motivo}`, origen_modulo: c.entidad, origen_id: id, motivo });
  if (duplicada) return { ...(op.resultado || {}), duplicada: true };

  const dv = await crearDocumento(tx, ctx, { tipo: 'DV', fecha: f, operacion_id: op.id, concepto: op.concepto, valor: neto,
    datos: { documento_origen: doc.numero_id, lineas } });
  await registrarDevolucionInventario(tx, ctx, { tipoDoc: tipo, doc, docId: id, lineas, devolucionNumero: dv.numero });

  const { rows } = await tx.query(
    `SELECT id FROM fin_obligaciones WHERE documento_modulo = $1 AND documento_id = $2 AND NOT anulada LIMIT 1`, [c.entidad, id]);
  let aplicado = 0;
  if (rows[0]) {
    const saldo = await saldoObligacion(tx, rows[0].id);
    aplicado = r2(Math.min(saldo, neto));
    if (aplicado > 0) {
      await aplicarAObligacion(tx, ctx, op, { obligacion_id: rows[0].id, tipo: 'devolucion', valor: aplicado, fecha: f, concepto: dv.numero,
        documento_id: dv.id, origen_clave: `dev:${op.id}:obl` });
    }
  }
  const reembolso = r2(neto - aplicado);
  if (reembolso > 0) {
    if (!body.cuenta_id) throw new HttpError(400, `Hay ${reembolso.toLocaleString('es-CO')} para ${tipo === 'venta' ? 'devolver al cliente' : 'recibir del proveedor'}: indique la cuenta de dinero`);
    await registrarMovimiento(tx, ctx, op, { cuenta_id: body.cuenta_id, fecha: f, naturaleza: tipo === 'venta' ? 'salida' : 'entrada',
      clase: tipo === 'venta' ? 'egreso' : 'ingreso', valor: reembolso, concepto: `${dv.numero} · ${doc.numero_id}`, documento_id: dv.id,
      origen_clave: `dev:${op.id}:dinero`, contable: { documento_numero: dv.numero } });
  }
  const lineasCont = tipo === 'venta'
    ? [
      { naturaleza: 'debito', cuenta_rol: 'devoluciones_ventas', valor: base },
      { naturaleza: 'debito', cuenta_rol: 'iva_generado', valor: iva },
      { naturaleza: 'credito', cuenta_rol: 'cxc', valor: aplicado },
      { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor: reembolso },
      { naturaleza: 'credito', cuenta_rol: 'retencion_a_favor', valor: rete },
    ]
    : [
      { naturaleza: 'debito', cuenta_rol: 'cxp', valor: aplicado },
      { naturaleza: 'debito', cuenta_rol: 'disponible', cuenta_dinero_id: body.cuenta_id, valor: reembolso },
      { naturaleza: 'debito', cuenta_rol: 'retencion_por_pagar', valor: rete },
      { naturaleza: 'credito', cuenta_rol: doc.afecta_inventario ? 'inventario' : 'costo_gasto_compra', valor: base },
      { naturaleza: 'credito', cuenta_rol: 'iva_descontable', valor: iva },
    ];
  await asiento(tx, ctx, op, lineasCont, { clave: `dev:${op.id}`, fecha: f, documento_numero: dv.numero, modulo_origen: c.entidad });
  await vincular(tx, c.entidad, id, 'fin_documentos', dv.id, 'documento_relacionado');
  await recUpdate(tx, c.entidad, id, { devoluciones: [...previas, { numero: dv.numero, fecha: f, motivo, lineas, valor: neto }] });
  if (rows[0]) await sincronizarEstadoPago(tx, rows[0].id);
  return finalizarOperacion(tx, op.id, { operacion_id: op.id, documento: { id: dv.id, numero: dv.numero }, valor: neto,
    aplicado_a_cartera: aplicado, reembolso });
}
