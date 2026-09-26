// Carga los saldos iniciales aprobados en "03 Propuesta de cartera y obligaciones al corte.md"
// (el usuario confirmó la propuesta completa, sin editar la lista: son datos semi-reales de
// prueba que se reemplazarán cuando arranque la operación real). Idempotente.
import 'dotenv/config';
import { withTx } from '../api/_lib/fin/pool.js';
import { hoyColombia, iniciarOperacion, finalizarOperacion, crearObligacion, auditar } from '../api/_lib/fin/core.js';
import { actualizarCuenta } from '../api/_lib/fin/consultas.js';

const ctx = { usuario: 'migracion-b2', rol: 'admin' };
const num = (v) => parseFloat(v) || 0;
const pesos = (v) => `$${Math.round(v).toLocaleString('es-CO')}`;

const resultado = await withTx(async (tx) => {
  const docs = (await tx.query(
    `SELECT entity, id, data FROM records WHERE entity IN ('OrdenVenta','OrdenCompra')
       AND data->>'fin_operacion_id' IS NULL AND COALESCE(data->>'anulado','false') <> 'true'
       AND (data->>'condicion_pago' IN ('credito','mixto') OR (data->>'condicion_pago' IS NULL AND data->>'forma_pago' = 'credito'))
     ORDER BY entity, data->>'fecha_orden'`)).rows;

  const terceros = new Map();
  for (const e of ['Tercero', 'Cliente', 'Proveedor']) {
    for (const r of (await tx.query(`SELECT id, data FROM records WHERE entity = $1`, [e])).rows) {
      terceros.set(r.id, r.data.nombre || r.data.razon_social || r.id);
    }
  }

  const { operacion: op } = await iniciarOperacion(tx, ctx, {
    tipo_operacion: 'saldo_inicial', fecha: hoyColombia(),
    idempotency_key: 'saldo-inicial-cartera-b2-2026-09-26',
    motivo: 'Corte limpio: cartera aprobada en 03 Propuesta de cartera y obligaciones al corte.md (datos semi-reales de prueba)',
  });

  const cargadas = []; const omitidas = [];
  for (const d of docs) {
    const x = d.data;
    const total = num(x.total || x.valor_total_venta || x.valor_total_compra);
    const pagado = x.condicion_pago === 'mixto' ? num(x.valor_pagado) : 0;
    const saldo = x.saldo_pendiente !== undefined && x.condicion_pago === 'mixto' ? num(x.saldo_pendiente) : total - pagado;
    const numero = x.numero_id || `${x.prefijo_documento || ''}-${x.numero_documento || ''}`;
    if (!(saldo > 0)) { omitidas.push(numero); continue; }
    const terceroId = d.entity === 'OrdenVenta' ? x.cliente_id : x.proveedor_id;
    const obl = await crearObligacion(tx, ctx, op, {
      naturaleza: d.entity === 'OrdenVenta' ? 'por_cobrar' : 'por_pagar', clase: 'saldo_inicial',
      tercero_id: terceroId || null, tercero_nombre: terceros.get(terceroId) || x.tercero_personalizado || terceroId || '—',
      documento_modulo: d.entity, documento_id: d.id, documento_numero: numero,
      fecha: x.fecha_orden || hoyColombia(), fecha_vencimiento: x.fecha_vencimiento || x.fecha_orden || hoyColombia(),
      valor_original: saldo, concepto: `Saldo inicial (corte) de ${numero}`, origen_clave: `saldo-inicial:${d.entity}:${d.id}`,
    }).catch((e) => { if (!/ya existe/.test(e.message)) throw e; return null; });
    if (obl) cargadas.push({ numero, naturaleza: obl.naturaleza, saldo });
  }

  const resumenCxC = cargadas.filter((c) => c.naturaleza === 'por_cobrar');
  const resumenCxP = cargadas.filter((c) => c.naturaleza === 'por_pagar');
  await finalizarOperacion(tx, op.id, {
    cxc_cargadas: resumenCxC.length, total_cxc: resumenCxC.reduce((s, c) => s + c.saldo, 0),
    cxp_cargadas: resumenCxP.length, total_cxp: resumenCxP.reduce((s, c) => s + c.saldo, 0), omitidas,
  });

  // Saldos de dinero: sin valores reales del usuario (dijo que no es crítico, son datos de
  // prueba). Se confirma en 0 y se retira el permiso temporal de saldo negativo (regla D8).
  const cuentas = (await tx.query(`SELECT id, nombre FROM fin_cuentas_dinero WHERE tipo = 'caja'`)).rows;
  const cuentasAjustadas = [];
  for (const c of cuentas) {
    await actualizarCuenta(tx, ctx, c.id, { saldo_inicial: 0, fecha_saldo_inicial: hoyColombia(), saldo_inicial_confirmado: true,
      permite_saldo_negativo: false,
      motivo: 'Confirmado en el corte: sin saldo real informado (datos de prueba); se retira el permiso temporal de saldo negativo' });
    cuentasAjustadas.push(c.nombre);
  }
  await auditar(tx, ctx, { accion: 'migracion:saldos_iniciales_b2', entidad: 'fin_meta', operacion_id: op.id,
    despues: { cxc: resumenCxC.length, cxp: resumenCxP.length, cuentas: cuentasAjustadas } });

  return { cargadas, omitidas, totalCxC: resumenCxC.reduce((s, c) => s + c.saldo, 0), totalCxP: resumenCxP.reduce((s, c) => s + c.saldo, 0),
    cuentasAjustadas };
});

console.log(`CxC cargadas: ${resultado.cargadas.filter((c) => c.naturaleza === 'por_cobrar').length} · total ${pesos(resultado.totalCxC)}`);
console.log(`CxP cargadas: ${resultado.cargadas.filter((c) => c.naturaleza === 'por_pagar').length} · total ${pesos(resultado.totalCxP)}`);
if (resultado.omitidas.length) console.log('Omitidas (saldo $0):', resultado.omitidas.join(', '));
console.log('Cuentas confirmadas en 0 y sin permiso de saldo negativo:', resultado.cuentasAjustadas.join(', '));
