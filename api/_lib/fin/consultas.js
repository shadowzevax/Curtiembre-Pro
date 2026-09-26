import { newId, HttpError } from '../util.js';
import { r2, hoyColombia, fecha, dinero, auditar, requerirRol } from './core.js';

const SALDO_SQL = `c.saldo_inicial + COALESCE(SUM(CASE WHEN m.naturaleza = 'entrada' THEN m.valor ELSE -m.valor END), 0)`;

const cuentaPublica = (c) => ({ ...c, saldo_inicial: r2(c.saldo_inicial), saldo: c.saldo === undefined ? undefined : r2(c.saldo) });

// ── Cuentas de dinero (modelo único: caja, banco, otro_medio) ────────────────

export async function listarCuentas(tx, { tipo, incluir_inactivas } = {}) {
  const { rows } = await tx.query(
    `SELECT c.*, ${SALDO_SQL} AS saldo
     FROM fin_cuentas_dinero c LEFT JOIN fin_movimientos_dinero m ON m.cuenta_id = c.id
     WHERE ($1::text IS NULL OR c.tipo = $1) AND ($2::boolean OR c.estado = 'activa')
     GROUP BY c.id ORDER BY c.tipo, c.nombre`, [tipo || null, !!incluir_inactivas]);
  return rows.map(cuentaPublica);
}

const CAMPOS_CUENTA = ['nombre', 'entidad', 'tipo_cuenta', 'numero', 'titular', 'permite_saldo_negativo', 'aplica_gmf', 'estado',
  'fecha_apertura', 'observaciones'];

export async function crearCuenta(tx, ctx, body) {
  requerirRol(ctx, ['admin'], 'configurar cuentas de dinero');
  const { tipo, nombre } = body || {};
  if (!['caja', 'banco', 'otro_medio'].includes(tipo)) throw new HttpError(400, 'Tipo de cuenta inválido (caja, banco u otro_medio)');
  if (!nombre || !String(nombre).trim()) throw new HttpError(400, 'El nombre de la cuenta es obligatorio');
  const saldo = body.saldo_inicial === undefined || body.saldo_inicial === '' ? 0 : dinero(body.saldo_inicial, 'saldo inicial', { positivo: false });
  try {
    const { rows } = await tx.query(
      `INSERT INTO fin_cuentas_dinero (id, tipo, nombre, entidad, tipo_cuenta, numero, titular, saldo_inicial, fecha_saldo_inicial,
         saldo_inicial_confirmado, permite_saldo_negativo, aplica_gmf, fecha_apertura, observaciones, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [newId(), tipo, String(nombre).trim(), body.entidad || null, body.tipo_cuenta || null, body.numero || null, body.titular || null,
        saldo, body.fecha_saldo_inicial ? fecha(body.fecha_saldo_inicial, 'fecha del saldo inicial') : null, !!body.saldo_inicial_confirmado,
        !!body.permite_saldo_negativo, tipo === 'banco' ? body.aplica_gmf !== false : false,
        body.fecha_apertura || null, body.observaciones || null, ctx.usuario]
    );
    await auditar(tx, ctx, { accion: 'cuenta:crear', entidad: 'fin_cuentas_dinero', entidad_id: rows[0].id, despues: rows[0] });
    return cuentaPublica({ ...rows[0], saldo: rows[0].saldo_inicial });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, `Ya existe una cuenta de tipo ${tipo} llamada "${nombre}"`);
    throw e;
  }
}

export async function actualizarCuenta(tx, ctx, id, body) {
  requerirRol(ctx, ['admin'], 'configurar cuentas de dinero');
  const { rows: prev } = await tx.query(`SELECT * FROM fin_cuentas_dinero WHERE id = $1 FOR UPDATE`, [id]);
  const antes = prev[0];
  if (!antes) throw new HttpError(404, 'La cuenta no existe');
  const sets = [];
  const params = [id];
  for (const campo of CAMPOS_CUENTA) {
    if (body[campo] !== undefined) {
      if (campo === 'estado' && !['activa', 'inactiva'].includes(body.estado)) throw new HttpError(400, 'Estado inválido');
      params.push(body[campo] === '' ? null : body[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  // El saldo inicial define todos los saldos: cambiarlo exige motivo y queda en la bitácora.
  if (body.saldo_inicial !== undefined || body.fecha_saldo_inicial !== undefined || body.saldo_inicial_confirmado !== undefined) {
    if (!body.motivo || String(body.motivo).trim().length < 5) throw new HttpError(400, 'Cambiar el saldo inicial requiere un motivo');
    if (body.saldo_inicial !== undefined) { params.push(dinero(body.saldo_inicial, 'saldo inicial', { positivo: false })); sets.push(`saldo_inicial = $${params.length}`); }
    if (body.fecha_saldo_inicial !== undefined) { params.push(body.fecha_saldo_inicial ? fecha(body.fecha_saldo_inicial) : null); sets.push(`fecha_saldo_inicial = $${params.length}`); }
    if (body.saldo_inicial_confirmado !== undefined) { params.push(!!body.saldo_inicial_confirmado); sets.push(`saldo_inicial_confirmado = $${params.length}`); }
  }
  if (!sets.length) return cuentaPublica(antes);
  try {
    const { rows } = await tx.query(`UPDATE fin_cuentas_dinero SET ${sets.join(', ')}, updated_date = now() WHERE id = $1 RETURNING *`, params);
    await auditar(tx, ctx, { accion: 'cuenta:actualizar', entidad: 'fin_cuentas_dinero', entidad_id: id, antes, despues: rows[0],
      motivo: body.motivo || null });
    return cuentaPublica(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Ya existe otra cuenta de ese tipo con ese nombre');
    throw e;
  }
}

// Libro tipo "Fecha · Documento · Concepto · Entrada · Salida · Saldo".
export async function libroCuenta(tx, cuenta_id, { desde, hasta } = {}) {
  const { rows: cs } = await tx.query(`SELECT * FROM fin_cuentas_dinero WHERE id = $1`, [cuenta_id]);
  const cuenta = cs[0];
  if (!cuenta) throw new HttpError(404, 'La cuenta no existe');
  const d = desde ? fecha(desde, 'fecha inicial') : '1900-01-01';
  const h = hasta ? fecha(hasta, 'fecha final') : '2999-12-31';
  const { rows: ant } = await tx.query(
    `SELECT COALESCE(SUM(CASE WHEN naturaleza = 'entrada' THEN valor ELSE -valor END), 0) AS neto
     FROM fin_movimientos_dinero WHERE cuenta_id = $1 AND fecha < $2`, [cuenta_id, d]);
  const saldoAnterior = r2(Number(cuenta.saldo_inicial) + Number(ant[0].neto));
  const { rows } = await tx.query(
    `SELECT m.*, doc.numero AS documento_numero, o.tipo_operacion, o.origen_modulo, o.origen_id
     FROM fin_movimientos_dinero m
     LEFT JOIN fin_documentos doc ON doc.id = m.documento_id
     JOIN fin_operaciones o ON o.id = m.operacion_id
     WHERE m.cuenta_id = $1 AND m.fecha BETWEEN $2 AND $3
     ORDER BY m.fecha, m.created_date, m.id`, [cuenta_id, d, h]);
  let saldo = saldoAnterior;
  const movimientos = rows.map((m) => {
    const v = r2(m.valor);
    saldo = r2(saldo + (m.naturaleza === 'entrada' ? v : -v));
    return { ...m, valor: v, entrada: m.naturaleza === 'entrada' ? v : 0, salida: m.naturaleza === 'salida' ? v : 0, saldo };
  });
  return { cuenta: cuentaPublica(cuenta), desde: desde || null, hasta: hasta || null, saldo_anterior: saldoAnterior,
    saldo_final: saldo, movimientos };
}

// ── Cuentas por cobrar / por pagar ───────────────────────────────────────────

export async function listarObligaciones(tx, { naturaleza, tercero_id, estado, incluir_anuladas } = {}) {
  const hoy = hoyColombia();
  const { rows } = await tx.query(
    `SELECT o.*, o.valor_original - COALESCE(SUM(a.valor), 0) AS saldo,
            COALESCE(SUM(a.valor) FILTER (WHERE a.valor > 0), 0) AS aplicado
     FROM fin_obligaciones o LEFT JOIN fin_aplicaciones a ON a.obligacion_id = o.id
     WHERE ($1::text IS NULL OR o.naturaleza = $1) AND ($2::text IS NULL OR o.tercero_id = $2) AND ($3::boolean OR NOT o.anulada)
     GROUP BY o.id ORDER BY o.fecha_vencimiento NULLS LAST, o.fecha`,
    [naturaleza || null, tercero_id || null, !!incluir_anuladas]);
  const lista = rows.map((o) => {
    const saldo = r2(o.saldo);
    let est = 'pendiente';
    if (o.anulada) est = 'anulada';
    else if (saldo <= 0) est = 'pagada';
    else if (o.fecha_vencimiento && o.fecha_vencimiento < hoy) est = 'vencida';
    else if (r2(o.aplicado) > 0) est = 'parcial';
    return { ...o, valor_original: r2(o.valor_original), aplicado: r2(o.aplicado), saldo, estado: est,
      dias_vencida: est === 'vencida' ? Math.round((new Date(hoy) - new Date(o.fecha_vencimiento)) / 86400000) : 0 };
  });
  return estado ? lista.filter((o) => o.estado === estado) : lista;
}

export async function detalleObligacion(tx, id) {
  const [o] = await listarObligaciones(tx, { incluir_anuladas: true }).then((l) => l.filter((x) => x.id === id));
  if (!o) throw new HttpError(404, 'La cuenta por cobrar/pagar no existe');
  const { rows: aplicaciones } = await tx.query(
    `SELECT a.*, d.numero AS documento_numero FROM fin_aplicaciones a LEFT JOIN fin_documentos d ON d.id = a.documento_id
     WHERE a.obligacion_id = $1 ORDER BY a.fecha, a.created_date`, [id]);
  return { ...o, aplicaciones: aplicaciones.map((a) => ({ ...a, valor: r2(a.valor) })) };
}

// ── Documentos, vínculos y operaciones ──────────────────────────────────────

export async function obtenerDocumento(tx, numero) {
  const { rows } = await tx.query(`SELECT * FROM fin_documentos WHERE numero = $1`, [numero]);
  if (!rows[0]) throw new HttpError(404, `El documento ${numero} no existe`);
  const d = rows[0];
  const { rows: op } = await tx.query(`SELECT * FROM fin_operaciones WHERE id = $1`, [d.operacion_id]);
  const { rows: movs } = await tx.query(
    `SELECT m.*, c.nombre AS cuenta_nombre, c.tipo AS cuenta_tipo FROM fin_movimientos_dinero m
     JOIN fin_cuentas_dinero c ON c.id = m.cuenta_id WHERE m.operacion_id = $1 ORDER BY m.created_date`, [d.operacion_id]);
  return { ...d, valor: r2(d.valor), operacion: op[0], movimientos: movs.map((m) => ({ ...m, valor: r2(m.valor) })) };
}

export async function listarVinculos(tx, modulo, id) {
  const { rows } = await tx.query(
    `SELECT v.*, dd.numero AS desde_numero, dh.numero AS hacia_numero
     FROM fin_vinculos v
     LEFT JOIN fin_documentos dd ON v.desde_modulo = 'fin_documentos' AND dd.id = v.desde_id
     LEFT JOIN fin_documentos dh ON v.hacia_modulo = 'fin_documentos' AND dh.id = v.hacia_id
     WHERE (v.desde_modulo = $1 AND v.desde_id = $2) OR (v.hacia_modulo = $1 AND v.hacia_id = $2)
     ORDER BY v.created_date`, [modulo, String(id)]);
  return rows;
}

// Todo lo relacionado con un documento de origen (ej. una venta): operaciones, documentos del
// ERP, cartera y movimientos. Base de la trazabilidad y de "Documentos y Soportes".
export async function relacionadosDeOrigen(tx, modulo, id) {
  const { rows: ops } = await tx.query(
    `SELECT * FROM fin_operaciones WHERE (origen_modulo = $1 AND origen_id = $2)
       OR id IN (SELECT hacia_id FROM fin_vinculos WHERE desde_modulo = $1 AND desde_id = $2 AND hacia_modulo = 'fin_operaciones')
     ORDER BY created_date`, [modulo, String(id)]);
  const ids = ops.map((o) => o.id);
  const q = async (sql) => (ids.length ? (await tx.query(sql, [ids])).rows : []);
  const documentos = await q(`SELECT * FROM fin_documentos WHERE operacion_id = ANY($1) ORDER BY created_date`);
  const movimientos = await q(`SELECT m.*, c.nombre AS cuenta_nombre FROM fin_movimientos_dinero m JOIN fin_cuentas_dinero c ON c.id = m.cuenta_id WHERE m.operacion_id = ANY($1) ORDER BY m.created_date`);
  const { rows: obligaciones } = await tx.query(
    `SELECT o.*, o.valor_original - COALESCE((SELECT SUM(valor) FROM fin_aplicaciones a WHERE a.obligacion_id = o.id), 0) AS saldo
     FROM fin_obligaciones o WHERE o.documento_modulo = $1 AND o.documento_id = $2`, [modulo, String(id)]);
  const oblIds = obligaciones.map((o) => o.id);
  const aplicaciones = oblIds.length ? (await tx.query(
    `SELECT a.*, d.numero AS documento_numero FROM fin_aplicaciones a LEFT JOIN fin_documentos d ON d.id = a.documento_id
     WHERE a.obligacion_id = ANY($1) ORDER BY a.created_date`, [oblIds])).rows : [];
  const extraDocs = aplicaciones.map((a) => a.documento_id).filter((d) => d && !documentos.some((x) => x.id === d));
  if (extraDocs.length) {
    documentos.push(...(await tx.query(`SELECT * FROM fin_documentos WHERE id = ANY($1)`, [extraDocs])).rows);
  }
  return {
    operaciones: ops,
    documentos: documentos.map((d) => ({ ...d, valor: r2(d.valor) })),
    movimientos: movimientos.map((m) => ({ ...m, valor: r2(m.valor) })),
    obligaciones: obligaciones.map((o) => ({ ...o, valor_original: r2(o.valor_original), saldo: r2(o.saldo) })),
    aplicaciones: aplicaciones.map((a) => ({ ...a, valor: r2(a.valor) })),
  };
}

export async function listarAuditoria(tx, ctx, { entidad, entidad_id, desde, hasta, limite } = {}) {
  requerirRol(ctx, ['admin'], 'consultar la bitácora');
  const { rows } = await tx.query(
    `SELECT * FROM fin_auditoria
     WHERE ($1::text IS NULL OR entidad = $1) AND ($2::text IS NULL OR entidad_id = $2)
       AND ($3::date IS NULL OR fecha_hora >= $3::date) AND ($4::date IS NULL OR fecha_hora < ($4::date + 1))
     ORDER BY fecha_hora DESC LIMIT $5`,
    [entidad || null, entidad_id || null, desde || null, hasta || null, Math.min(Number(limite) || 500, 5000)]);
  return rows;
}

// ── Cierres de período ────────────────────────────────────────────────────────

export async function cerrarPeriodo(tx, ctx, { desde, hasta, observacion }) {
  requerirRol(ctx, ['admin'], 'cerrar períodos');
  const d = fecha(desde, 'fecha inicial');
  const h = fecha(hasta, 'fecha final');
  if (h < d) throw new HttpError(400, 'La fecha final no puede ser anterior a la inicial');
  if (h > hoyColombia()) throw new HttpError(400, 'No se puede cerrar un período que aún no termina');
  const { rows } = await tx.query(
    `INSERT INTO fin_periodos (id, desde, hasta, estado, usuario, observacion) VALUES ($1,$2,$3,'cerrado',$4,$5) RETURNING *`,
    [newId(), d, h, ctx.usuario, observacion || null]);
  await auditar(tx, ctx, { accion: 'periodo:cerrar', entidad: 'fin_periodos', entidad_id: rows[0].id, despues: rows[0] });
  return rows[0];
}

export async function reabrirPeriodo(tx, ctx, id, motivo) {
  requerirRol(ctx, ['admin'], 'reabrir períodos');
  if (!motivo || String(motivo).trim().length < 5) throw new HttpError(400, 'Reabrir un período requiere un motivo');
  const { rows } = await tx.query(`UPDATE fin_periodos SET estado = 'reabierto' WHERE id = $1 AND estado = 'cerrado' RETURNING *`, [id]);
  if (!rows[0]) throw new HttpError(404, 'El período no existe o no está cerrado');
  await auditar(tx, ctx, { accion: 'periodo:reabrir', entidad: 'fin_periodos', entidad_id: id, despues: rows[0], motivo });
  return rows[0];
}

export async function listarPeriodos(tx) {
  return (await tx.query(`SELECT * FROM fin_periodos ORDER BY desde DESC`)).rows;
}
