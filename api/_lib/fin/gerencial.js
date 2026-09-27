// Indicadores y Resumen Gerencial (C2): resumen financiero, alertas, flujo de caja proyectado
// y rentabilidad por cliente. Todo de solo lectura sobre lo que ya genera el motor —
// requerimiento 6.22, no se duplica ni se inventa información.
import { HttpError } from '../util.js';
import { r2, hoyColombia, requerirRol } from './core.js';
import { listarCuentas, listarObligaciones } from './consultas.js';

const money = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

export async function resumenGerencial(tx) {
  const hoy = hoyColombia();
  const en7dias = new Date(); en7dias.setDate(en7dias.getDate() + 7);
  const limite7 = en7dias.toISOString().slice(0, 10);

  const cuentas = await listarCuentas(tx);
  const disponible = r2(cuentas.reduce((s, c) => s + c.saldo, 0));

  const cxc = await listarObligaciones(tx, { naturaleza: 'por_cobrar' });
  const cxp = await listarObligaciones(tx, { naturaleza: 'por_pagar' });
  const vivasCxc = cxc.filter((o) => !['pagada', 'anulada'].includes(o.estado));
  const vivasCxp = cxp.filter((o) => !['pagada', 'anulada'].includes(o.estado));

  const totalCartera = r2(vivasCxc.reduce((s, o) => s + o.saldo, 0));
  const totalObligaciones = r2(vivasCxp.reduce((s, o) => s + o.saldo, 0));
  const carteraVencida = vivasCxc.filter((o) => o.estado === 'vencida');
  const obligacionesVencidas = vivasCxp.filter((o) => o.estado === 'vencida');
  const carteraPorVencer = vivasCxc.filter((o) => o.estado !== 'vencida' && o.fecha_vencimiento && o.fecha_vencimiento <= limite7);
  const obligacionesPorVencer = vivasCxp.filter((o) => o.estado !== 'vencida' && o.fecha_vencimiento && o.fecha_vencimiento <= limite7);

  const alertas = [];
  if (carteraVencida.length) alertas.push({ tipo: 'cartera_vencida', severidad: 'alta',
    mensaje: `${carteraVencida.length} cuenta(s) por cobrar vencida(s) por ${money(carteraVencida.reduce((s, o) => s + o.saldo, 0))} en total` });
  if (obligacionesVencidas.length) alertas.push({ tipo: 'obligaciones_vencidas', severidad: 'alta',
    mensaje: `${obligacionesVencidas.length} cuenta(s) por pagar vencida(s) por ${money(obligacionesVencidas.reduce((s, o) => s + o.saldo, 0))} en total` });
  if (carteraPorVencer.length) alertas.push({ tipo: 'cartera_por_vencer', severidad: 'media',
    mensaje: `${carteraPorVencer.length} cuenta(s) por cobrar vencen en los próximos 7 días` });
  if (obligacionesPorVencer.length) alertas.push({ tipo: 'obligaciones_por_vencer', severidad: 'media',
    mensaje: `${obligacionesPorVencer.length} cuenta(s) por pagar vencen en los próximos 7 días` });
  if (disponible < totalObligaciones) alertas.push({ tipo: 'liquidez', severidad: 'alta',
    mensaje: `El disponible (${money(disponible)}) es menor que las obligaciones pendientes (${money(totalObligaciones)})` });

  return {
    fecha: hoy, disponible,
    cartera: { total: totalCartera, vencida: r2(carteraVencida.reduce((s, o) => s + o.saldo, 0)), cantidad: vivasCxc.length },
    obligaciones: { total: totalObligaciones, vencida: r2(obligacionesVencidas.reduce((s, o) => s + o.saldo, 0)), cantidad: vivasCxp.length },
    posicion_neta: r2(disponible + totalCartera - totalObligaciones),
    alertas,
  };
}

// Flujo de caja proyectado: agrupa lo que ya se sabe que entrará (CxC con vencimiento) y
// saldrá (CxP con vencimiento) por semana, sobre el disponible actual. No es una predicción
// estadística: es la suma de compromisos que ya existen en el sistema.
export async function flujoCajaProyectado(tx, { semanas = 8 } = {}) {
  const cuentas = await listarCuentas(tx);
  let saldo = r2(cuentas.reduce((s, c) => s + c.saldo, 0));
  const cxc = (await listarObligaciones(tx, { naturaleza: 'por_cobrar' })).filter((o) => !['pagada', 'anulada'].includes(o.estado));
  const cxp = (await listarObligaciones(tx, { naturaleza: 'por_pagar' })).filter((o) => !['pagada', 'anulada'].includes(o.estado));

  const hoy = new Date(hoyColombia() + 'T00:00:00');
  const semanasArr = [];
  for (let i = 0; i < semanas; i++) {
    const desde = new Date(hoy); desde.setDate(desde.getDate() + i * 7);
    const hasta = new Date(hoy); hasta.setDate(hasta.getDate() + (i + 1) * 7 - 1);
    const desdeS = desde.toISOString().slice(0, 10), hastaS = hasta.toISOString().slice(0, 10);
    const entran = cxc.filter((o) => o.fecha_vencimiento && o.fecha_vencimiento >= desdeS && o.fecha_vencimiento <= hastaS);
    const salen = cxp.filter((o) => o.fecha_vencimiento && o.fecha_vencimiento >= desdeS && o.fecha_vencimiento <= hastaS);
    const totalEntran = r2(entran.reduce((s, o) => s + o.saldo, 0));
    const totalSalen = r2(salen.reduce((s, o) => s + o.saldo, 0));
    saldo = r2(saldo + totalEntran - totalSalen);
    semanasArr.push({ desde: desdeS, hasta: hastaS, entran: totalEntran, salen: totalSalen, saldo_proyectado: saldo,
      cantidad_entran: entran.length, cantidad_salen: salen.length });
  }
  // Todo lo que no tiene fecha de vencimiento, o vence después de la última semana mostrada, queda fuera de la proyección.
  const sinFecha = { cxc: cxc.filter((o) => !o.fecha_vencimiento).length, cxp: cxp.filter((o) => !o.fecha_vencimiento).length };
  return { saldo_inicial: r2(cuentas.reduce((s, c) => s + c.saldo, 0)), semanas: semanasArr, sin_fecha_vencimiento: sinFecha };
}

// Rentabilidad por cliente: indicadores comerciales confiables (facturado, cobrado, cartera,
// ticket promedio, días de pago) — no se presenta un margen de utilidad porque hoy no existe un
// vínculo confiable entre el costo del lote y el costo por unidad del producto terminado
// (hallazgo de la investigación de C1/C2); mostrar un margen ahora sería una cifra inventada.
export async function rentabilidadClientes(tx) {
  const cxc = await listarObligaciones(tx, { naturaleza: 'por_cobrar', incluir_anuladas: true });
  const porCliente = new Map();
  for (const o of cxc) {
    if (o.anulada) continue;
    const key = o.tercero_id || o.tercero_nombre;
    if (!key) continue;
    const actual = porCliente.get(key) || { tercero_id: o.tercero_id, tercero_nombre: o.tercero_nombre,
      facturado: 0, cobrado: 0, pendiente: 0, vencido: 0, documentos: 0 };
    actual.facturado += o.valor_original;
    actual.cobrado += (o.valor_original - o.saldo);
    actual.pendiente += (o.estado !== 'pagada' ? o.saldo : 0);
    actual.vencido += (o.estado === 'vencida' ? o.saldo : 0);
    actual.documentos += 1;
    porCliente.set(key, actual);
  }
  return [...porCliente.values()].map((c) => ({ ...c, facturado: r2(c.facturado), cobrado: r2(c.cobrado), pendiente: r2(c.pendiente),
    vencido: r2(c.vencido), ticket_promedio: c.documentos > 0 ? r2(c.facturado / c.documentos) : 0 }))
    .sort((a, b) => b.facturado - a.facturado);
}

// Envía un texto por el mismo bot de Telegram que ya se usa para avisar despliegues
// (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID en Vercel), para que las alertas también lleguen ahí.
export async function notificarTelegram(tx, ctx, texto) {
  requerirRol(ctx, ['admin', 'contador'], 'enviar notificaciones por Telegram');
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) throw new HttpError(500, 'Telegram no está configurado (faltan las variables de entorno)');
  if (!texto || !String(texto).trim()) throw new HttpError(400, 'Falta el texto a enviar');
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: String(texto).slice(0, 4000), parse_mode: 'HTML' }),
  });
  if (!resp.ok) throw new HttpError(502, 'Telegram rechazó el mensaje');
  return { ok: true };
}
