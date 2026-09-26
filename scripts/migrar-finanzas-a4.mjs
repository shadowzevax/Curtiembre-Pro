// Migración del paso A4 — corte limpio (decisión D5). Idempotente: se puede correr varias veces.
//  1. Crea en el motor las cajas que existían (entidad Caja) SIN saldo inicial: el saldo real lo
//     confirma el usuario (no se inventan saldos). Bancos: no había ninguno registrado.
//  2. Continúa la numeración de los comprobantes de egreso existentes.
//  3. Genera, en solo lectura, la PROPUESTA de cartera (CxC) y obligaciones (CxP) a partir de las
//     ventas y compras a crédito anteriores, para que el usuario confirme qué está realmente pendiente.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTx } from '../api/_lib/fin/pool.js';
import { aplicarEsquemaFin } from '../api/_lib/fin/schema.js';
import { auditar, hoyColombia } from '../api/_lib/fin/core.js';
import { newId } from '../api/_lib/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { usuario: 'migracion-a4', rol: 'admin' };
const num = (v) => parseFloat(v) || 0;
const pesos = (v) => `$${Math.round(v).toLocaleString('es-CO')}`;

const resumen = await withTx(async (tx) => {
  await aplicarEsquemaFin(tx);
  const cajas = (await tx.query(`SELECT id, data FROM records WHERE entity = 'Caja' ORDER BY created_date`)).rows;
  const creadas = [];
  for (const c of cajas) {
    const ya = (await tx.query(`SELECT id FROM fin_cuentas_dinero WHERE legacy_ref = $1`, [c.id])).rows[0];
    if (ya) continue;
    const nombre = String(c.data.nombre || 'Caja').trim();
    const { rows } = await tx.query(
      `INSERT INTO fin_cuentas_dinero (id, tipo, nombre, saldo_inicial, saldo_inicial_confirmado, estado, observaciones, legacy_ref, created_by)
       VALUES ($1,'caja',$2,0,false,$3,$4,$5,$6) ON CONFLICT (tipo, nombre) DO NOTHING RETURNING *`,
      [newId(), nombre, c.data.estado === 'inactiva' ? 'inactiva' : 'activa',
        `Migrada de la caja anterior. Saldo inicial PENDIENTE de confirmar por el usuario (el sistema anterior mostraba saldo inicial ${pesos(num(c.data.saldo_inicial))} y un saldo actual de ${pesos(num(c.data.saldo_actual))}, que no era confiable).`,
        c.id, ctx.usuario]);
    if (rows[0]) {
      creadas.push(nombre);
      await auditar(tx, ctx, { accion: 'migracion:crear_cuenta', entidad: 'fin_cuentas_dinero', entidad_id: rows[0].id, despues: rows[0] });
    }
  }
  const maxCE = (await tx.query(
    `SELECT COALESCE(MAX((data->>'numero_comprobante')::int), 0) m FROM records
     WHERE entity = 'ComprobanteEgreso' AND data->>'numero_comprobante' ~ '^[0-9]+$'`)).rows[0].m;
  const anio = Number(hoyColombia().slice(0, 4));
  await tx.query(`INSERT INTO fin_consecutivos (tipo, anio, ultimo) VALUES ('CE', $1, $2) ON CONFLICT (tipo, anio) DO NOTHING`, [anio, maxCE]);
  await auditar(tx, ctx, { accion: 'migracion:corte_limpio', entidad: 'fin_meta', motivo: 'Paso A4: cajas migradas sin saldo inicial; CE continúa la numeración anterior',
    despues: { cajas_creadas: creadas, consecutivo_CE_desde: maxCE + 1 } });
  return { creadas, maxCE, anio };
});
console.log('Cajas creadas en el motor:', resumen.creadas.length ? resumen.creadas.join(', ') : '(ya existían)');
console.log(`Comprobantes de egreso continúan en CE-${resumen.anio}-${String(resumen.maxCE + 1).padStart(4, '0')}`);

// ── Propuesta de cartera y obligaciones (solo lectura) ──
const propuesta = await withTx(async (tx) => {
  const terceros = new Map();
  for (const e of ['Tercero', 'Cliente', 'Proveedor']) {
    for (const r of (await tx.query(`SELECT id, data FROM records WHERE entity = $1`, [e])).rows) {
      terceros.set(r.id, r.data.nombre || r.data.razon_social || r.id);
    }
  }
  const docs = (await tx.query(
    `SELECT entity, id, data FROM records WHERE entity IN ('OrdenVenta','OrdenCompra')
       AND data->>'fin_operacion_id' IS NULL AND COALESCE(data->>'anulado','false') <> 'true'
       AND (data->>'condicion_pago' IN ('credito','mixto') OR (data->>'condicion_pago' IS NULL AND data->>'forma_pago' = 'credito'))
     ORDER BY entity, data->>'fecha_orden'`)).rows;
  return docs.map((d) => {
    const x = d.data;
    const total = num(x.total || x.valor_total_venta || x.valor_total_compra);
    const pagado = x.condicion_pago === 'mixto' ? num(x.valor_pagado) : 0;
    const saldo = x.saldo_pendiente !== undefined && x.condicion_pago === 'mixto' ? num(x.saldo_pendiente) : total - pagado;
    const terceroId = d.entity === 'OrdenVenta' ? x.cliente_id : x.proveedor_id;
    return { tipo: d.entity === 'OrdenVenta' ? 'CxC' : 'CxP', documento: x.numero_id || `${x.prefijo_documento || ''}-${x.numero_documento || ''}`,
      fecha: x.fecha_orden || '', vence: x.fecha_vencimiento || '', tercero: terceros.get(terceroId) || x.tercero_personalizado || terceroId || '—',
      total, pagado, saldo };
  });
});

const tabla = (filas) => [
  '| Documento | Fecha | Vence | Tercero | Total | Pagado al registrar | Saldo según el sistema anterior | ¿Sigue pendiente? (confirmar) |',
  '|---|---|---|---|---|---|---|---|',
  ...filas.map((f) => `| ${f.documento} | ${f.fecha} | ${f.vence} | ${f.tercero} | ${pesos(f.total)} | ${pesos(f.pagado)} | ${pesos(f.saldo)} | |`),
  `| **Total** | | | | | | **${pesos(filas.reduce((s, f) => s + f.saldo, 0))}** | |`,
].join('\n');
const cxc = propuesta.filter((p) => p.tipo === 'CxC');
const cxp = propuesta.filter((p) => p.tipo === 'CxP');
const md = `# 03 · Propuesta de cartera y obligaciones al corte

**ERP Curtiembre ArteCueros Mejía** · Generado automáticamente el ${hoyColombia()} (paso A4, corte limpio)

> **Solo lectura. Nada de esto se ha cargado todavía.**
> El sistema anterior **nunca creó** las cuentas por cobrar ni por pagar (en la base había 0), aunque existían ventas y compras a crédito. Esta lista se armó con los datos que quedaron guardados en cada venta o compra. Los abonos registrados por fuera del sistema **no** aparecen aquí.
>
> **Qué necesito de ti:** en la última columna escribe si el saldo sigue pendiente (y por cuánto, si es distinto). Con eso cargaremos los saldos iniciales en el paso B2, vinculados a cada venta o compra original.

## Cuentas por cobrar (ventas a crédito o mixtas)

${cxc.length ? tabla(cxc) : '_No hay ventas a crédito anteriores._'}

## Cuentas por pagar (compras a crédito o mixtas)

${cxp.length ? tabla(cxp) : '_No hay compras a crédito anteriores._'}

## Saldos de dinero al corte

| Cuenta | Saldo real a la fecha de corte (confirmar) |
|---|---|
| Caja general | |
| CAJA MENOR | |
| Bancos (cuáles) | |
| Nequi / otros medios | |

**Fecha de corte propuesta:** ____________ (desde esta fecha los libros de caja y bancos comienzan con estos saldos).
`;
const destino = path.resolve(ROOT, '..', '03 Propuesta de cartera y obligaciones al corte.md');
fs.writeFileSync(destino, md);
console.log(`Propuesta generada: ${destino} · ${cxc.length} CxC y ${cxp.length} CxP`);
