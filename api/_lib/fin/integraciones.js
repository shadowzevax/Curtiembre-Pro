// Paso B4 — integraciones con módulos que ya existen, SIN modificar su lógica ni sus pantallas
// (decisión D: "Costos Indirectos → Egresos", "Procesos Externos → Cuentas por Pagar"). Estos
// módulos se leen tal cual están; Finanzas solo agrega el vínculo y el efecto financiero.
import { HttpError } from '../util.js';
import { r2, dinero, fecha as validarFecha, hoyColombia, requerirRol, vincular } from './core.js';
import { egreso as registrarEgreso } from './operaciones.js';
import { recFind, recGet, recUpdate } from './inventario.js';
import { crearObligacion, iniciarOperacion, finalizarOperacion, asiento } from './core.js';

const num = (v) => parseFloat(v) || 0;

// ── Costos Indirectos → Egreso (causación ya existente; el pago se hace aparte) ──
export async function costosIndirectosPendientes(tx) {
  const { rows } = await tx.query(
    `SELECT id, entity, data FROM records WHERE entity = 'CostoIndirecto' AND (data->>'fin_operacion_id') IS NULL ORDER BY data->>'fecha_servicio' DESC`);
  return rows.map((r) => {
    const d = r.data;
    const valor = num(d.subtotal ?? d.valor_total ?? d.valor ?? 0);
    return { id: r.id, tipo_costo: d.tipo_costo, concepto: d.nombre_servicio || d.concepto || d.tipo_costo, fecha: d.fecha_servicio,
      codigo_lote: d.codigo_lote || null, valor };
  }).filter((c) => c.valor > 0);
}

export async function pagarCostoIndirecto(tx, ctx, { costo_id, cuenta_id, fecha, idempotency_key }) {
  requerirRol(ctx, ['admin', 'contador'], 'pagar costos indirectos');
  const costo = await recGet(tx, 'CostoIndirecto', costo_id, { lock: true });
  if (!costo) throw new HttpError(404, 'El costo indirecto no existe');
  if (costo.fin_operacion_id) throw new HttpError(409, 'Este costo ya está vinculado a un pago');
  const valor = dinero(costo.subtotal ?? costo.valor_total ?? costo.valor ?? 0);
  const f = validarFecha(fecha);
  const resultado = await registrarEgreso(tx, ctx, { cuenta_id, fecha: f, valor, categoria: 'costo_indirecto',
    concepto: `${costo.nombre_servicio || costo.tipo_costo}${costo.codigo_lote ? ` · Lote ${costo.codigo_lote}` : ''}`,
    origen_modulo: 'CostoIndirecto', origen_id: costo_id, idempotency_key });
  if (!resultado.duplicada) {
    await recUpdate(tx, 'CostoIndirecto', costo_id, { fin_operacion_id: resultado.operacion_id, estado_pago: 'pagado', fecha_pago: f });
  }
  return resultado;
}

// ── Procesos Externos → Cuenta por Pagar (al recibir, proporcional a lo recibido) ──
export async function procesosExternosPendientes(tx) {
  const procesos = await recFind(tx, 'ProcesoExterno', {});
  const { rows: existentes } = await tx.query(`SELECT origen_clave FROM fin_obligaciones WHERE origen_clave LIKE 'procext:%'`);
  const yaSincronizados = new Set(existentes.map((r) => r.origen_clave.replace('procext:', '')));
  return procesos
    .filter((p) => ['recibido', 'recibido_total'].includes(p.estado) && !yaSincronizados.has(p.id))
    .map((p) => {
      const enviada = num(p.cantidad_enviada);
      const recibida = num(p.cantidad_recibida);
      const proporcion = enviada > 0 ? Math.min(recibida / enviada, 1) : (p.estado === 'recibido_total' ? 1 : 0);
      return { id: p.id, proveedor_nombre: p.proveedor_nombre, cantidad_enviada: enviada, cantidad_recibida: recibida,
        valor_total_servicio: num(p.valor_total_servicio), valor_a_generar: r2(num(p.valor_total_servicio) * proporcion), fecha: p.fecha_recepcion || p.fecha_salida };
    })
    .filter((p) => p.valor_a_generar > 0);
}

export async function sincronizarProcesosExternos(tx, ctx) {
  requerirRol(ctx, ['admin', 'contador'], 'sincronizar procesos externos');
  const pendientes = await procesosExternosPendientes(tx);
  const creadas = [];
  for (const p of pendientes) {
    const { operacion: op, duplicada } = await iniciarOperacion(tx, ctx, {
      tipo_operacion: 'sincronizacion_proceso_externo', fecha: hoyColombia(), idempotency_key: `sync-procext:${p.id}`,
      tercero_nombre: p.proveedor_nombre, valor: p.valor_a_generar, concepto: `Proceso externo recibido · ${p.proveedor_nombre}`,
      origen_modulo: 'ProcesoExterno', origen_id: p.id,
    });
    if (duplicada) continue;
    const obl = await crearObligacion(tx, ctx, op, { naturaleza: 'por_pagar', clase: 'proceso_externo', tercero_nombre: p.proveedor_nombre,
      documento_modulo: 'ProcesoExterno', documento_id: p.id, fecha: p.fecha || hoyColombia(), valor_original: p.valor_a_generar,
      concepto: `Servicio de proceso externo recibido (${p.cantidad_recibida}/${p.cantidad_enviada} hojas)`, origen_clave: `procext:${p.id}` });
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'costo_gasto_compra', valor: p.valor_a_generar },
      { naturaleza: 'credito', cuenta_rol: 'cxp', valor: p.valor_a_generar },
    ], { clave: `procext:${op.id}`, fecha: p.fecha || hoyColombia(), modulo_origen: 'ProcesoExterno' });
    await vincular(tx, 'ProcesoExterno', p.id, 'fin_obligaciones', obl.id, 'cuenta_por_pagar');
    await finalizarOperacion(tx, op.id, { obligacion_id: obl.id, valor: p.valor_a_generar });
    creadas.push({ proceso_id: p.id, proveedor: p.proveedor_nombre, valor: p.valor_a_generar });
  }
  return { creadas: creadas.length, detalle: creadas };
}
