// Conciliación bancaria: compara el extracto del banco (importado desde Excel/CSV) contra los
// movimientos que ya generó el motor financiero en fin_movimientos_dinero, sugiere coincidencias
// por valor+fecha cercana, y dejar todo emparejado deja la cuenta "conciliada" hasta esa fecha.
import { newId, HttpError } from '../util.js';
import { r2, fecha, dinero, hoyColombia, auditar, requerirRol, saldoCuenta } from './core.js';

const DIAS_TOLERANCIA = 5;

const r2n = (x) => (x == null ? null : r2(x));
const concilPublica = (c) => ({ ...c, saldo_extracto: r2n(c.saldo_extracto), saldo_sistema: r2n(c.saldo_sistema), diferencia: r2n(c.diferencia) });

export async function listarConciliaciones(tx, { cuenta_id } = {}) {
  const { rows } = await tx.query(
    `SELECT c.*, cu.nombre AS cuenta_nombre
     FROM fin_conciliaciones c JOIN fin_cuentas_dinero cu ON cu.id = c.cuenta_id
     WHERE ($1::text IS NULL OR c.cuenta_id = $1)
     ORDER BY c.periodo_anio DESC, c.periodo_mes DESC, c.created_date DESC`, [cuenta_id || null]);
  return rows.map(concilPublica);
}

async function unaOMuere(tx, id) {
  const { rows } = await tx.query(`SELECT * FROM fin_conciliaciones WHERE id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'La conciliación no existe');
  return rows[0];
}

export async function crearConciliacion(tx, ctx, body) {
  requerirRol(ctx, ['admin', 'contador'], 'crear conciliaciones bancarias');
  const { cuenta_id, periodo_anio, periodo_mes, responsable, observaciones } = body || {};
  if (!cuenta_id) throw new HttpError(400, 'Falta la cuenta de dinero');
  const anio = Number(periodo_anio), mes = Number(periodo_mes);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) throw new HttpError(400, 'Período inválido');
  const { rows: cuenta } = await tx.query(`SELECT * FROM fin_cuentas_dinero WHERE id = $1`, [cuenta_id]);
  if (!cuenta[0]) throw new HttpError(404, 'La cuenta de dinero no existe');
  const { rows: abierta } = await tx.query(
    `SELECT id FROM fin_conciliaciones WHERE cuenta_id = $1 AND periodo_anio = $2 AND periodo_mes = $3 AND estado = 'en_proceso'`,
    [cuenta_id, anio, mes]);
  if (abierta[0]) throw new HttpError(409, 'Ya hay una conciliación en proceso para esa cuenta y período');
  const fechaCorte = body.fecha_corte ? fecha(body.fecha_corte, 'fecha de corte') : hoyColombia();
  const saldoExtracto = body.saldo_extracto === undefined ? 0 : dinero(body.saldo_extracto, 'saldo del extracto', { positivo: false });
  const id = newId();
  const { rows } = await tx.query(
    `INSERT INTO fin_conciliaciones (id, cuenta_id, periodo_anio, periodo_mes, fecha_corte, saldo_extracto, responsable, observaciones, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, cuenta_id, anio, mes, fechaCorte, saldoExtracto, responsable || null, observaciones || null, ctx.usuario]);
  await auditar(tx, ctx, { accion: 'conciliacion:crear', entidad: 'fin_conciliaciones', entidad_id: id, despues: rows[0] });
  return concilPublica(rows[0]);
}

async function requerirEnProceso(tx, id) {
  const c = await unaOMuere(tx, id);
  if (c.estado !== 'en_proceso') throw new HttpError(409, 'Esta conciliación ya está cerrada; reábrela para modificarla');
  return c;
}

// Filas ya parseadas por el navegador (SheetJS) a partir del Excel/CSV del extracto.
export async function importarLineas(tx, ctx, conciliacion_id, lineas) {
  const concil = await requerirEnProceso(tx, conciliacion_id);
  if (!Array.isArray(lineas) || !lineas.length) throw new HttpError(400, 'El extracto no trae filas para importar');
  if (lineas.length > 5000) throw new HttpError(413, 'El extracto trae demasiadas filas (máximo 5000)');
  let insertadas = 0;
  for (const l of lineas) {
    const f = fecha(l.fecha, 'fecha de una línea del extracto');
    const naturaleza = l.naturaleza === 'salida' ? 'salida' : 'entrada';
    const valor = dinero(l.valor, 'valor de una línea del extracto');
    await tx.query(
      `INSERT INTO fin_conciliacion_lineas (id, conciliacion_id, fecha, descripcion, referencia, naturaleza, valor, usuario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId(), conciliacion_id, f, String(l.descripcion || '').slice(0, 300), String(l.referencia || '').slice(0, 100), naturaleza, valor, ctx.usuario]);
    insertadas++;
  }
  await auditar(tx, ctx, { accion: 'conciliacion:importar_extracto', entidad: 'fin_conciliaciones', entidad_id: conciliacion_id,
    despues: { filas: insertadas } });
  return { insertadas };
}

export async function detalleConciliacion(tx, id) {
  const concil = await unaOMuere(tx, id);
  const { rows: lineas } = await tx.query(
    `SELECT l.*, m.concepto AS movimiento_concepto, m.fecha AS movimiento_fecha, m.clase AS movimiento_clase
     FROM fin_conciliacion_lineas l LEFT JOIN fin_movimientos_dinero m ON m.id = l.movimiento_id
     WHERE l.conciliacion_id = $1 ORDER BY l.fecha, l.created_date`, [id]);
  const saldoSistema = await saldoCuenta(tx, concil.cuenta_id);
  return {
    ...concilPublica(concil),
    saldo_sistema_actual: saldoSistema,
    lineas: lineas.map((l) => ({ ...l, valor: r2(l.valor) })),
  };
}

// Sugiere, para cada línea sin emparejar, el movimiento del sistema más parecido: misma cuenta,
// mismo sentido (entrada/salida), mismo valor y la fecha más cercana dentro de la tolerancia.
// No confirma nada: el usuario revisa y confirma cada sugerencia (o busca una manual).
export async function sugerirCoincidencias(tx, id) {
  const concil = await requerirEnProceso(tx, id);
  const { rows: pendientes } = await tx.query(
    `SELECT * FROM fin_conciliacion_lineas WHERE conciliacion_id = $1 AND estado = 'pendiente' AND movimiento_id IS NULL`, [id]);
  let sugeridas = 0;
  for (const l of pendientes) {
    const { rows: candidatos } = await tx.query(
      `SELECT m.id, m.fecha FROM fin_movimientos_dinero m
       WHERE m.cuenta_id = $1 AND m.conciliado = false AND m.naturaleza = $2 AND m.valor = $3
         AND m.fecha BETWEEN $4::date - $5::int AND $4::date + $5::int
         AND NOT EXISTS (SELECT 1 FROM fin_conciliacion_lineas x WHERE x.movimiento_id = m.id AND x.estado <> 'ignorada')
       ORDER BY ABS(m.fecha - $4::date) LIMIT 1`,
      [concil.cuenta_id, l.naturaleza, l.valor, l.fecha, DIAS_TOLERANCIA]);
    if (candidatos[0]) {
      await tx.query(`UPDATE fin_conciliacion_lineas SET movimiento_id = $2 WHERE id = $1`, [l.id, candidatos[0].id]);
      sugeridas++;
    }
  }
  return { sugeridas, pendientes_sin_sugerencia: pendientes.length - sugeridas };
}

// Movimientos de la cuenta aún no conciliados, para que el usuario busque un emparejamiento manual.
export async function movimientosSinConciliar(tx, cuenta_id, { desde, hasta } = {}) {
  const { rows } = await tx.query(
    `SELECT id, fecha, naturaleza, clase, valor, concepto, tercero_nombre FROM fin_movimientos_dinero
     WHERE cuenta_id = $1 AND conciliado = false AND ($2::date IS NULL OR fecha >= $2) AND ($3::date IS NULL OR fecha <= $3)
     ORDER BY fecha DESC LIMIT 500`, [cuenta_id, desde || null, hasta || null]);
  return rows.map((r) => ({ ...r, valor: r2(r.valor) }));
}

export async function confirmarLinea(tx, ctx, linea_id, movimiento_id) {
  const { rows: lr } = await tx.query(`SELECT * FROM fin_conciliacion_lineas WHERE id = $1 FOR UPDATE`, [linea_id]);
  const linea = lr[0];
  if (!linea) throw new HttpError(404, 'La línea del extracto no existe');
  const concil = await requerirEnProceso(tx, linea.conciliacion_id);
  const movId = movimiento_id || linea.movimiento_id;
  if (!movId) throw new HttpError(400, 'Selecciona el movimiento del sistema que corresponde a esta línea');
  const { rows: mr } = await tx.query(`SELECT * FROM fin_movimientos_dinero WHERE id = $1 FOR UPDATE`, [movId]);
  const mov = mr[0];
  if (!mov) throw new HttpError(404, 'El movimiento del sistema no existe');
  if (mov.cuenta_id !== concil.cuenta_id) throw new HttpError(400, 'Ese movimiento pertenece a otra cuenta de dinero');
  if (mov.conciliado) throw new HttpError(409, 'Ese movimiento ya quedó conciliado en otra línea');
  await tx.query(`UPDATE fin_movimientos_dinero SET conciliado = true, conciliacion_id = $2 WHERE id = $1`, [mov.id, concil.id]);
  const { rows } = await tx.query(
    `UPDATE fin_conciliacion_lineas SET movimiento_id = $2, estado = 'conciliada' WHERE id = $1 RETURNING *`, [linea_id, mov.id]);
  return { ...rows[0], valor: r2(rows[0].valor) };
}

export async function desconciliarLinea(tx, ctx, linea_id) {
  const { rows: lr } = await tx.query(`SELECT * FROM fin_conciliacion_lineas WHERE id = $1 FOR UPDATE`, [linea_id]);
  const linea = lr[0];
  if (!linea) throw new HttpError(404, 'La línea del extracto no existe');
  await requerirEnProceso(tx, linea.conciliacion_id);
  if (linea.movimiento_id) await tx.query(`UPDATE fin_movimientos_dinero SET conciliado = false, conciliacion_id = NULL WHERE id = $1`, [linea.movimiento_id]);
  const { rows } = await tx.query(
    `UPDATE fin_conciliacion_lineas SET movimiento_id = NULL, estado = 'pendiente' WHERE id = $1 RETURNING *`, [linea_id]);
  return { ...rows[0], valor: r2(rows[0].valor) };
}

export async function ignorarLinea(tx, ctx, linea_id, motivo) {
  const { rows: lr } = await tx.query(`SELECT * FROM fin_conciliacion_lineas WHERE id = $1 FOR UPDATE`, [linea_id]);
  const linea = lr[0];
  if (!linea) throw new HttpError(404, 'La línea del extracto no existe');
  await requerirEnProceso(tx, linea.conciliacion_id);
  if (linea.movimiento_id) await tx.query(`UPDATE fin_movimientos_dinero SET conciliado = false, conciliacion_id = NULL WHERE id = $1`, [linea.movimiento_id]);
  const { rows } = await tx.query(
    `UPDATE fin_conciliacion_lineas SET movimiento_id = NULL, estado = 'ignorada' WHERE id = $1 RETURNING *`, [linea_id]);
  await auditar(tx, ctx, { accion: 'conciliacion:ignorar_linea', entidad: 'fin_conciliacion_lineas', entidad_id: linea_id, motivo: motivo || null });
  return { ...rows[0], valor: r2(rows[0].valor) };
}

export async function cerrarConciliacion(tx, ctx, id) {
  requerirRol(ctx, ['admin', 'contador'], 'cerrar conciliaciones bancarias');
  const concil = await requerirEnProceso(tx, id);
  const { rows: pend } = await tx.query(
    `SELECT count(*)::int AS n FROM fin_conciliacion_lineas WHERE conciliacion_id = $1 AND estado = 'pendiente'`, [id]);
  if (pend[0].n > 0) throw new HttpError(409, `Quedan ${pend[0].n} línea(s) del extracto sin conciliar ni marcar como ignoradas`);
  const saldoSistema = await saldoCuenta(tx, concil.cuenta_id);
  const diferencia = r2(Number(concil.saldo_extracto) - Number(saldoSistema));
  const estado = diferencia === 0 ? 'conciliada' : 'con_diferencias';
  const { rows } = await tx.query(
    `UPDATE fin_conciliaciones SET estado = $2, saldo_sistema = $3, diferencia = $4, cerrada_en = now(), cerrada_por = $5 WHERE id = $1 RETURNING *`,
    [id, estado, saldoSistema, diferencia, ctx.usuario]);
  await auditar(tx, ctx, { accion: 'conciliacion:cerrar', entidad: 'fin_conciliaciones', entidad_id: id, despues: rows[0] });
  return concilPublica(rows[0]);
}

export async function reabrirConciliacion(tx, ctx, id, motivo) {
  requerirRol(ctx, ['admin'], 'reabrir conciliaciones bancarias');
  const concil = await unaOMuere(tx, id);
  if (concil.estado === 'en_proceso') throw new HttpError(409, 'Esta conciliación ya está en proceso');
  if (!motivo || motivo.trim().length < 5) throw new HttpError(400, 'El motivo de reapertura es obligatorio (mínimo 5 caracteres)');
  const { rows } = await tx.query(
    `UPDATE fin_conciliaciones SET estado = 'en_proceso', saldo_sistema = NULL, diferencia = NULL, cerrada_en = NULL, cerrada_por = NULL WHERE id = $1 RETURNING *`, [id]);
  await auditar(tx, ctx, { accion: 'conciliacion:reabrir', entidad: 'fin_conciliaciones', entidad_id: id, motivo });
  return concilPublica(rows[0]);
}
