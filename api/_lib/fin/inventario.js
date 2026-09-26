// Mecanismo de inventario de Ventas y Compras ejecutado en el servidor, dentro de la misma
// transacción del documento (decisión D2). Replica EXACTAMENTE la lógica que tenía el navegador
// en DocumentoComercialForm: mismas entidades, mismos campos y las mismas fórmulas de
// src/lib/costoPromedio.js (se importan de ahí, no se copian). Las correcciones autorizadas (D3):
// validar stock en ventas, no dejar stock negativo al anular y, al borrar un movimiento,
// guardar su copia completa en la bitácora.
import { newId, HttpError } from '../util.js';
import { calcularCostoPromedioCompra, recalcularDesdeMovimientos } from '../../../src/lib/costoPromedio.js';
import { auditar } from './core.js';

const num = (v) => parseFloat(v) || 0;

function recordFromRow(row) {
  return { ...row.data, id: row.id, created_date: row.created_date };
}

export async function recFind(tx, entity, filtro = {}) {
  const { id, ...resto } = filtro;
  const params = [entity, JSON.stringify(resto)];
  let where = `entity = $1 AND data @> $2::jsonb`;
  if (id) { params.push(String(id)); where += ` AND id = $${params.length}`; }
  const { rows } = await tx.query(`SELECT * FROM records WHERE ${where} ORDER BY created_date DESC, id DESC`, params);
  return rows.map(recordFromRow);
}

export async function recGet(tx, entity, id, { lock = false } = {}) {
  const { rows } = await tx.query(`SELECT * FROM records WHERE entity = $1 AND id = $2${lock ? ' FOR UPDATE' : ''}`, [entity, id]);
  return rows[0] ? recordFromRow(rows[0]) : null;
}

export async function recCreate(tx, ctx, entity, data, { id } = {}) {
  const { id: _i, created_date: _c, updated_date: _u, created_by: _b, ...limpio } = data;
  const { rows } = await tx.query(
    `INSERT INTO records (id, entity, data, created_by) VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
    [id || newId(), entity, JSON.stringify(limpio), ctx.usuario]
  );
  return recordFromRow(rows[0]);
}

export async function recUpdate(tx, entity, id, patch) {
  const { id: _i, created_date: _c, updated_date: _u, created_by: _b, ...limpio } = patch;
  const { rows } = await tx.query(
    `UPDATE records SET data = data || $3::jsonb, updated_date = now() WHERE entity = $1 AND id = $2 RETURNING *`,
    [entity, id, JSON.stringify(limpio)]
  );
  if (!rows[0]) throw new HttpError(404, `${entity} ${id} no existe`);
  return recordFromRow(rows[0]);
}

async function recDelete(tx, entity, id) {
  await tx.query(`DELETE FROM records WHERE entity = $1 AND id = $2`, [entity, id]);
}

// Misma resolución que el navegador: categoría según el Catálogo Maestro, luego la entidad de
// inventario correspondiente buscada SOLO por código.
export async function buscarItemInventario(tx, codigo) {
  if (!codigo) return null;
  const [catalogo] = await recFind(tx, 'ProductoCatalogo', { codigo });
  if (!catalogo) return null;
  const cat = catalogo.categoria;
  let entidad = null;
  if (cat === 'materia_prima' || cat === 'productos_terminados') entidad = 'ProductoTerminado';
  else if (cat === 'insumos_quimicos') entidad = 'Insumo';
  if (!entidad) return { catalogo, categoria: cat, entidad: null, item: null };
  const [item] = await recFind(tx, entidad, { codigo });
  return { catalogo, categoria: cat, entidad, item: item || null };
}

async function bloquearItem(tx, entidad, id) {
  return recGet(tx, entidad, id, { lock: true });
}

export async function stockDesdeMovimientos(tx, insumo_id) {
  const movs = await recFind(tx, 'MovimientoInventario', { insumo_id });
  return movs.reduce((s, m) => s + num(m.cantidad), 0);
}

export const referenciaDocumento = (doc) => `${doc.prefijo_documento}-${doc.numero_documento}`;

// ── Compras: entrada de inventario ────────────────────────────────────────────

export async function registrarEntradasCompra(tx, ctx, { doc, docId }) {
  const advertencias = [];
  if (!doc.afecta_inventario) return { advertencias };
  const referencia = referenciaDocumento(doc);
  for (const item of doc.items || []) {
    const r = await buscarItemInventario(tx, item.codigo);
    if (r?.entidad && r.item) {
      const actual = await bloquearItem(tx, r.entidad, r.item.id);
      const stockActual = await stockDesdeMovimientos(tx, actual.id);
      const cantidadCompra = num(item.cantidad);
      const costoUnitarioCompra = num(item.precio_unitario);
      const nuevoStock = stockActual + cantidadCompra;
      const nuevoCostoPromedio = calcularCostoPromedioCompra(stockActual, actual.costo_promedio, cantidadCompra, costoUnitarioCompra);
      await recCreate(tx, ctx, 'MovimientoInventario', {
        tipo_movimiento: 'entrada',
        insumo_id: actual.id,
        cantidad: cantidadCompra,
        costo_unitario: costoUnitarioCompra,
        fecha_movimiento: doc.fecha_orden,
        referencia,
        observaciones: `Compra ${referencia}`,
        usuario_id: 'system',
        documento_origen_tipo: 'OrdenCompra',
        documento_origen_id: docId,
      });
      await recUpdate(tx, r.entidad, actual.id, { costo_promedio: nuevoCostoPromedio, stock_actual: nuevoStock });
    } else if (item.codigo) {
      advertencias.push(`No se encontró producto en inventario para el código ${item.codigo}`);
    }

    // Sincronización por categoría del catálogo (igual que antes: solo en compras nuevas)
    if (r?.categoria === 'productos_en_proceso') {
      const refDoc = doc.numero_id || referencia;
      await recCreate(tx, ctx, 'InventarioEnProceso', {
        codigo: item.codigo,
        descripcion: item.descripcion || r.catalogo.descripcion || '',
        codigo_lote: doc.codigo_lote_inventario || refDoc,
        origen_modulo: 'compras',
        etapa_actual: 'recepcion',
        estado_proceso: 'piel_recibida',
        estado_actual: 'disponible',
        cantidad_hojas: num(item.cantidad),
        fecha_ingreso_proceso: doc.fecha_emision_documento || doc.fecha_orden,
        submodulo_origen: doc.prefijo || 'compras',
        documento_origen_tipo: 'OrdenCompra',
        documento_origen_id: docId,
      });
    }
  }
  return { advertencias };
}

// ── Ventas: salida de inventario (con validación de stock, D7) ───────────────

export async function registrarSalidasVenta(tx, ctx, { doc, docId }) {
  const advertencias = [];
  const referencia = referenciaDocumento(doc);
  for (const item of doc.items || []) {
    const r = await buscarItemInventario(tx, item.codigo);
    if (!r?.entidad || !r.item) continue;
    const actual = await bloquearItem(tx, r.entidad, r.item.id);
    const stockActual = await stockDesdeMovimientos(tx, actual.id);
    const cantidadVenta = num(item.cantidad);
    if (cantidadVenta > stockActual + 1e-9) {
      throw new HttpError(409, `Stock insuficiente de ${item.codigo} ${item.descripcion || actual.descripcion || ''}: disponible ${stockActual}, se quieren vender ${cantidadVenta}`);
    }
    await recCreate(tx, ctx, 'MovimientoInventario', {
      tipo_movimiento: 'salida',
      insumo_id: actual.id,
      cantidad: -cantidadVenta,
      costo_unitario: num(actual.costo_promedio),
      fecha_movimiento: doc.fecha_orden,
      referencia,
      observaciones: `Venta ${referencia}`,
      usuario_id: 'system',
      documento_origen_tipo: 'OrdenVenta',
      documento_origen_id: docId,
    });
    await recUpdate(tx, r.entidad, actual.id, { stock_actual: stockActual - cantidadVenta });
  }
  return { advertencias };
}

// ── Reversión de inventario al anular (mecanismo existente + copia en bitácora) ──

// Documentos nuevos: sus movimientos llevan documento_origen_id (único). Documentos anteriores
// al motor: solo tenían la referencia prefijo-número, que en los datos reales se repite entre
// documentos distintos; si la referencia no es exclusiva de este documento, no se puede saber
// qué movimientos son suyos y se bloquea en vez de borrar movimientos ajenos.
async function movimientosDelDocumento(tx, { entidadDoc, doc, docId }) {
  const propios = await recFind(tx, 'MovimientoInventario', { documento_origen_id: docId });
  if (propios.length) return propios;
  const referencia = referenciaDocumento(doc);
  const candidatos = await recFind(tx, 'MovimientoInventario', { referencia });
  const legados = candidatos.filter((m) => !m.documento_origen_id);
  if (!legados.length) return [];
  const { rows } = await tx.query(
    `SELECT count(*)::int n FROM records WHERE entity = $1
       AND (data->>'prefijo_documento') || '-' || coalesce(data->>'numero_documento', '') = $2`,
    [entidadDoc, referencia]
  );
  if (!doc.numero_documento || rows[0].n > 1) {
    throw new HttpError(409, `No se puede anular automáticamente el inventario: la referencia "${referencia}" la comparten ${rows[0].n} documentos, así que no es posible identificar cuáles movimientos de inventario son de este documento sin afectar a los otros. Requiere un ajuste de inventario manual.`);
  }
  return legados;
}

export async function revertirInventarioCompra(tx, ctx, { doc, docId, operacion_id }) {
  if (!doc.afecta_inventario) return { revertidos: 0 };
  const enProceso = await recFind(tx, 'InventarioEnProceso', { documento_origen_id: docId });
  const enProcesoLegado = doc.codigo_lote_inventario
    ? (await recFind(tx, 'InventarioEnProceso', { origen_modulo: 'compras', codigo_lote: doc.codigo_lote_inventario }))
    : [];
  if (enProceso.length || enProcesoLegado.length) {
    throw new HttpError(409, 'Esta compra generó cuero en "Inventario Productos en Proceso" (Producción). Anularla afectaría un módulo protegido: requiere revisión y ajuste manual.');
  }
  const movs = await movimientosDelDocumento(tx, { entidadDoc: 'OrdenCompra', doc, docId });
  for (const mov of movs) {
    let entidad = null;
    let item = null;
    for (const e of ['ProductoTerminado', 'Insumo']) {
      item = await bloquearItem(tx, e, mov.insumo_id);
      if (item) { entidad = e; break; }
    }
    if (entidad) {
      const todos = await recFind(tx, 'MovimientoInventario', { insumo_id: mov.insumo_id });
      const restantes = todos.filter((m) => m.id !== mov.id);
      const { stock, costoPromedio } = recalcularDesdeMovimientos(restantes);
      if (stock < -1e-9) {
        throw new HttpError(409, `No se puede anular: la mercancía ${item.codigo || ''} de esta compra ya fue consumida o vendida (el stock quedaría en ${stock}). Use una devolución parcial o un ajuste.`);
      }
      await recUpdate(tx, entidad, item.id, { stock_actual: stock, costo_promedio: costoPromedio });
    }
    await auditar(tx, ctx, { accion: 'inventario:eliminar_movimiento', entidad: 'records:MovimientoInventario', entidad_id: mov.id,
      operacion_id, antes: mov, motivo: `Anulación de la compra ${doc.numero_id || referenciaDocumento(doc)}` });
    await recDelete(tx, 'MovimientoInventario', mov.id);
  }
  return { revertidos: movs.length };
}

export async function revertirInventarioVenta(tx, ctx, { doc, docId, operacion_id }) {
  const movs = await movimientosDelDocumento(tx, { entidadDoc: 'OrdenVenta', doc, docId });
  for (const mov of movs) {
    let entidad = null;
    let item = null;
    for (const e of ['ProductoTerminado', 'Insumo']) {
      item = await bloquearItem(tx, e, mov.insumo_id);
      if (item) { entidad = e; break; }
    }
    if (entidad) {
      const todos = await recFind(tx, 'MovimientoInventario', { insumo_id: mov.insumo_id });
      const restantes = todos.filter((m) => m.id !== mov.id);
      // En ventas solo cambia el stock: las salidas nunca alteran el costo promedio.
      await recUpdate(tx, entidad, item.id, { stock_actual: restantes.reduce((s, m) => s + num(m.cantidad), 0) });
    }
    await auditar(tx, ctx, { accion: 'inventario:eliminar_movimiento', entidad: 'records:MovimientoInventario', entidad_id: mov.id,
      operacion_id, antes: mov, motivo: `Anulación de la venta ${doc.numero_id || referenciaDocumento(doc)}` });
    await recDelete(tx, 'MovimientoInventario', mov.id);
  }
  return { revertidos: movs.length };
}

// ── Devoluciones parciales (usan la misma estructura de movimientos entrada/salida) ──

export async function registrarDevolucionInventario(tx, ctx, { tipoDoc, doc, docId, lineas, devolucionNumero }) {
  const referencia = referenciaDocumento(doc);
  for (const l of lineas) {
    const r = await buscarItemInventario(tx, l.codigo);
    if (!r?.entidad || !r.item) continue;
    const actual = await bloquearItem(tx, r.entidad, r.item.id);
    const stockActual = await stockDesdeMovimientos(tx, actual.id);
    const cantidad = num(l.cantidad);
    if (tipoDoc === 'venta') {
      // El cliente devuelve: entra al costo promedio vigente (no altera el promedio).
      await recCreate(tx, ctx, 'MovimientoInventario', {
        tipo_movimiento: 'entrada', insumo_id: actual.id, cantidad, costo_unitario: num(actual.costo_promedio),
        fecha_movimiento: l.fecha, referencia, observaciones: `Devolución de venta ${devolucionNumero} (${referencia})`,
        usuario_id: 'system', documento_origen_tipo: 'DevolucionVenta', documento_origen_id: `${docId}:${devolucionNumero}`,
      });
      await recUpdate(tx, r.entidad, actual.id, { stock_actual: stockActual + cantidad });
    } else {
      if (cantidad > stockActual + 1e-9) {
        throw new HttpError(409, `No hay stock suficiente de ${l.codigo} para devolver al proveedor: disponible ${stockActual}, a devolver ${cantidad}`);
      }
      await recCreate(tx, ctx, 'MovimientoInventario', {
        tipo_movimiento: 'salida', insumo_id: actual.id, cantidad: -cantidad, costo_unitario: num(l.precio_unitario),
        fecha_movimiento: l.fecha, referencia, observaciones: `Devolución a proveedor ${devolucionNumero} (${referencia})`,
        usuario_id: 'system', documento_origen_tipo: 'DevolucionCompra', documento_origen_id: `${docId}:${devolucionNumero}`,
      });
      await recUpdate(tx, r.entidad, actual.id, { stock_actual: stockActual - cantidad });
    }
  }
}
