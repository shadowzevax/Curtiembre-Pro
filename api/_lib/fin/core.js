import { newId, HttpError } from '../util.js';

// ── Utilidades ────────────────────────────────────────────────────────────────

export const r2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;

export function dinero(x, campo = 'valor', { positivo = true } = {}) {
  const n = Number(x);
  if (!Number.isFinite(n)) throw new HttpError(400, `El ${campo} no es un número válido`);
  const v = r2(n);
  if (positivo && v <= 0) throw new HttpError(400, `El ${campo} debe ser mayor a cero`);
  return v;
}

export function hoyColombia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export function fecha(valor, campo = 'fecha') {
  const f = valor || hoyColombia();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f)) || isNaN(new Date(`${f}T00:00:00Z`))) {
    throw new HttpError(400, `La ${campo} no es válida (formato AAAA-MM-DD)`);
  }
  return String(f);
}

export function requerirRol(ctx, roles, accion = 'realizar esta operación') {
  if (!roles.includes(ctx.rol)) {
    throw new HttpError(403, `Tu rol (${ctx.rol}) no tiene permiso para ${accion}`);
  }
}

const one = async (tx, text, params) => (await tx.query(text, params)).rows[0];

// ── Bitácora ──────────────────────────────────────────────────────────────────

export async function auditar(tx, ctx, { accion, entidad, entidad_id, operacion_id, antes, despues, motivo }) {
  await tx.query(
    `INSERT INTO fin_auditoria (id, usuario, rol, accion, entidad, entidad_id, operacion_id, antes, despues, motivo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [newId(), ctx.usuario, ctx.rol, accion, entidad || null, entidad_id || null, operacion_id || null,
      antes === undefined ? null : JSON.stringify(antes), despues === undefined ? null : JSON.stringify(despues), motivo || null]
  );
}

// ── Períodos cerrados ─────────────────────────────────────────────────────────

export async function verificarPeriodoAbierto(tx, f) {
  const cerrado = await one(tx,
    `SELECT desde, hasta FROM fin_periodos WHERE estado = 'cerrado' AND $1::date BETWEEN desde AND hasta LIMIT 1`, [f]);
  if (cerrado) {
    throw new HttpError(409, `El período del ${cerrado.desde} al ${cerrado.hasta} está cerrado: no se pueden registrar ni anular operaciones con fecha ${f}`);
  }
}

// ── Consecutivos (sin huecos: si la transacción se deshace, el número no se consume) ──

export async function siguienteConsecutivo(tx, tipo, anio, inicializar) {
  const existe = await one(tx, `SELECT ultimo FROM fin_consecutivos WHERE tipo = $1 AND anio = $2`, [tipo, anio]);
  if (!existe) {
    const inicial = inicializar ? Number(await inicializar()) || 0 : 0;
    await tx.query(
      `INSERT INTO fin_consecutivos (tipo, anio, ultimo) VALUES ($1,$2,$3) ON CONFLICT (tipo, anio) DO NOTHING`,
      [tipo, anio, inicial]
    );
  }
  const row = await one(tx,
    `UPDATE fin_consecutivos SET ultimo = ultimo + 1 WHERE tipo = $1 AND anio = $2 RETURNING ultimo`, [tipo, anio]);
  return row.ultimo;
}

export const formatoNumero = (tipo, anio, n) => `${tipo}-${anio}-${String(n).padStart(4, '0')}`;

// ── Operaciones (idempotentes por idempotency_key) ────────────────────────────

// Si la llave ya existe devuelve { duplicada: true } con la operación original: un doble clic,
// un reintento o un corte de red nunca registran dos veces la misma operación.
export async function iniciarOperacion(tx, ctx, { tipo_operacion, fecha: f, idempotency_key, tercero_id, tercero_nombre, valor,
  concepto, origen_modulo, origen_id, anula_a, motivo, datos, estado = 'confirmada' }) {
  if (!idempotency_key || String(idempotency_key).length < 8) {
    throw new HttpError(400, 'Falta la llave de idempotencia de la operación');
  }
  const row = await one(tx,
    `INSERT INTO fin_operaciones (id, tipo_operacion, fecha, idempotency_key, tercero_id, tercero_nombre, valor, concepto,
       origen_modulo, origen_id, anula_a, motivo, datos, estado, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
    [newId(), tipo_operacion, f, idempotency_key, tercero_id || null, tercero_nombre || null,
      valor ?? null, concepto || null, origen_modulo || null, origen_id || null, anula_a || null, motivo || null,
      JSON.stringify(datos || {}), estado, ctx.usuario]
  );
  if (row) {
    await auditar(tx, ctx, { accion: `crear:${tipo_operacion}`, entidad: 'fin_operaciones', entidad_id: row.id, operacion_id: row.id,
      despues: { tipo_operacion, fecha: f, valor, tercero_nombre, concepto, origen_modulo, origen_id } });
    return { operacion: row, duplicada: false };
  }
  const previa = await one(tx, `SELECT * FROM fin_operaciones WHERE idempotency_key = $1`, [idempotency_key]);
  if (previa.tipo_operacion !== tipo_operacion) {
    throw new HttpError(409, 'La llave de idempotencia ya se usó para otra operación');
  }
  return { operacion: previa, duplicada: true };
}

export async function finalizarOperacion(tx, operacion_id, resultado) {
  await tx.query(`UPDATE fin_operaciones SET resultado = $2::jsonb WHERE id = $1`, [operacion_id, JSON.stringify(resultado)]);
  return resultado;
}

// ── Documentos del ERP (RC, CE, CIN, TR, AJ, NC, ND, DV…) ────────────────────

export async function crearDocumento(tx, ctx, { tipo, fecha: f, operacion_id, tercero_id, tercero_nombre, concepto, valor, medio_pago, datos }) {
  const anio = Number(f.slice(0, 4));
  const n = await siguienteConsecutivo(tx, tipo, anio);
  const numero = formatoNumero(tipo, anio, n);
  return one(tx,
    `INSERT INTO fin_documentos (id, tipo, anio, consecutivo, numero, fecha, tercero_id, tercero_nombre, concepto, valor, medio_pago,
       operacion_id, datos, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING *`,
    [newId(), tipo, anio, n, numero, f, tercero_id || null, tercero_nombre || null, concepto || null, valor ?? 0,
      medio_pago || null, operacion_id, JSON.stringify(datos || {}), ctx.usuario]
  );
}

// ── Dinero: cajas, bancos y otros medios ─────────────────────────────────────

export async function saldoCuenta(tx, cuenta_id) {
  const row = await one(tx,
    `SELECT c.saldo_inicial + COALESCE(SUM(CASE WHEN m.naturaleza = 'entrada' THEN m.valor ELSE -m.valor END), 0) AS saldo
     FROM fin_cuentas_dinero c LEFT JOIN fin_movimientos_dinero m ON m.cuenta_id = c.id
     WHERE c.id = $1 GROUP BY c.saldo_inicial`, [cuenta_id]);
  return row ? r2(row.saldo) : null;
}

async function parametro(tx, clave, porDefecto) {
  const row = await one(tx, `SELECT valor FROM fin_parametros WHERE clave = $1`, [clave]);
  return row ? row.valor : porDefecto;
}

const naturalezaInversa = (n) => (n === 'entrada' ? 'salida' : 'entrada');

// Registra un movimiento bloqueando la cuenta (SELECT … FOR UPDATE): dos salidas simultáneas
// sobre la misma cuenta se procesan una después de la otra, y la segunda ve el saldo real.
// En bancos con GMF, agrega el 4x1000 como movimiento propio con su registro contable.
export async function registrarMovimiento(tx, ctx, op, { cuenta_id, fecha: f, naturaleza, clase, valor, concepto, tercero_id,
  tercero_nombre, documento_id, origen_clave, estado = 'confirmado', reversa_de, sin_gmf = false, contable }) {
  const cuenta = await one(tx, `SELECT * FROM fin_cuentas_dinero WHERE id = $1 FOR UPDATE`, [cuenta_id]);
  if (!cuenta) throw new HttpError(404, 'La cuenta de dinero no existe');
  if (cuenta.estado !== 'activa' && !reversa_de) throw new HttpError(409, `La cuenta "${cuenta.nombre}" está inactiva`);
  await verificarPeriodoAbierto(tx, f);

  let gmf = 0;
  if (naturaleza === 'salida' && cuenta.tipo === 'banco' && cuenta.aplica_gmf && clase !== 'gmf' && !sin_gmf) {
    gmf = r2(valor * Number(await parametro(tx, 'gmf_tasa', 0.004)));
  }
  if (naturaleza === 'salida' && !cuenta.permite_saldo_negativo) {
    const saldo = await saldoCuenta(tx, cuenta_id);
    if (saldo < r2(valor + gmf)) {
      throw new HttpError(409, `Saldo insuficiente en "${cuenta.nombre}": disponible ${saldo.toLocaleString('es-CO')}, se requieren ${r2(valor + gmf).toLocaleString('es-CO')}`);
    }
  }

  const mov = await one(tx,
    `INSERT INTO fin_movimientos_dinero (id, cuenta_id, fecha, naturaleza, clase, valor, concepto, tercero_id, tercero_nombre,
       documento_id, operacion_id, origen_clave, estado, reversa_de, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (origen_clave) DO NOTHING RETURNING *`,
    [newId(), cuenta_id, f, naturaleza, clase, valor, concepto || null, tercero_id || null, tercero_nombre || null,
      documento_id || null, op.id, origen_clave, estado, reversa_de || null, ctx.usuario]
  );
  if (!mov) throw new HttpError(409, `Este movimiento ya fue registrado antes (${origen_clave}); no se duplica`);

  let movGmf = null;
  if (gmf > 0) {
    movGmf = await one(tx,
      `INSERT INTO fin_movimientos_dinero (id, cuenta_id, fecha, naturaleza, clase, valor, concepto, documento_id, operacion_id,
         origen_clave, usuario)
       VALUES ($1,$2,$3,'salida','gmf',$4,$5,$6,$7,$8,$9) RETURNING *`,
      [newId(), cuenta_id, f, gmf, `GMF 4x1000 · ${concepto || ''}`.trim(), documento_id || null, op.id, `${origen_clave}:gmf`, ctx.usuario]
    );
    await asiento(tx, ctx, op, [
      { naturaleza: 'debito', cuenta_rol: 'gasto_gmf', valor: gmf },
      { naturaleza: 'credito', cuenta_rol: 'disponible', cuenta_dinero_id: cuenta_id, valor: gmf },
    ], { clave: `${origen_clave}:gmf`, fecha: f, concepto: 'GMF 4x1000', ...(contable || {}) });
  }
  return { movimiento: mov, gmf: movGmf, cuenta };
}

// ── Cuentas por cobrar / por pagar / anticipos ───────────────────────────────

export async function crearObligacion(tx, ctx, op, { naturaleza, clase = 'documento', tercero_id, tercero_nombre, tercero_nit,
  documento_modulo, documento_id, documento_numero, fecha: f, fecha_vencimiento, valor_original, concepto, origen_clave }) {
  await verificarPeriodoAbierto(tx, f);
  const row = await one(tx,
    `INSERT INTO fin_obligaciones (id, naturaleza, clase, tercero_id, tercero_nombre, tercero_nit, documento_modulo, documento_id,
       documento_numero, fecha, fecha_vencimiento, valor_original, concepto, operacion_id, origen_clave, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (origen_clave) DO NOTHING RETURNING *`,
    [newId(), naturaleza, clase, tercero_id || null, tercero_nombre || null, tercero_nit || null, documento_modulo || null,
      documento_id || null, documento_numero || null, f, fecha_vencimiento || null, valor_original, concepto || null, op.id,
      origen_clave, ctx.usuario]
  );
  if (!row) throw new HttpError(409, `Esta cuenta por cobrar/pagar ya existe (${origen_clave}); no se duplica`);
  return row;
}

export async function saldoObligacion(tx, obligacion_id) {
  const row = await one(tx,
    `SELECT o.valor_original - COALESCE(SUM(a.valor), 0) AS saldo
     FROM fin_obligaciones o LEFT JOIN fin_aplicaciones a ON a.obligacion_id = o.id
     WHERE o.id = $1 GROUP BY o.valor_original`, [obligacion_id]);
  return row ? r2(row.saldo) : null;
}

// valor > 0 disminuye el saldo pendiente; valor < 0 lo aumenta. Nunca se aplica más que el saldo.
export async function aplicarAObligacion(tx, ctx, op, { obligacion_id, tipo, valor, fecha: f, concepto, movimiento_id,
  documento_id, reversa_de, origen_clave }) {
  const obl = await one(tx, `SELECT * FROM fin_obligaciones WHERE id = $1 FOR UPDATE`, [obligacion_id]);
  if (!obl) throw new HttpError(404, 'La cuenta por cobrar/pagar no existe');
  if (obl.anulada && !reversa_de) throw new HttpError(409, 'La cuenta por cobrar/pagar está anulada');
  await verificarPeriodoAbierto(tx, f);
  if (valor > 0) {
    const saldo = await saldoObligacion(tx, obligacion_id);
    if (valor > saldo + 0.004) {
      throw new HttpError(409, `El valor (${valor.toLocaleString('es-CO')}) supera el saldo pendiente (${saldo.toLocaleString('es-CO')}) de ${obl.documento_numero || 'la obligación'}`);
    }
  }
  const row = await one(tx,
    `INSERT INTO fin_aplicaciones (id, obligacion_id, tipo, valor, fecha, concepto, operacion_id, movimiento_id, documento_id,
       reversa_de, origen_clave, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (origen_clave) DO NOTHING RETURNING *`,
    [newId(), obligacion_id, tipo, valor, f, concepto || null, op.id, movimiento_id || null, documento_id || null,
      reversa_de || null, origen_clave, ctx.usuario]
  );
  if (!row) throw new HttpError(409, `Esta aplicación ya fue registrada (${origen_clave}); no se duplica`);
  return { aplicacion: row, obligacion: obl };
}

// El estado de pago de la venta/compra de origen se deriva de su cartera: así la lista de
// Ventas y Compras siempre muestra pendiente / parcial / pagado según los abonos reales.
export async function sincronizarEstadoPago(tx, obligacion_id) {
  const o = await one(tx,
    `SELECT o.*, o.valor_original - COALESCE((SELECT SUM(valor) FROM fin_aplicaciones a WHERE a.obligacion_id = o.id), 0) AS saldo,
       COALESCE((SELECT SUM(valor) FROM fin_aplicaciones a WHERE a.obligacion_id = o.id AND a.valor > 0), 0) AS aplicado
     FROM fin_obligaciones o WHERE o.id = $1`, [obligacion_id]);
  if (!o || o.anulada || !['OrdenVenta', 'OrdenCompra'].includes(o.documento_modulo)) return;
  const saldo = r2(o.saldo);
  const estado = saldo <= 0.004 ? 'pagado' : r2(o.aplicado) > 0 ? 'parcial' : 'pendiente';
  await tx.query(
    `UPDATE records SET data = data || jsonb_build_object('estado_documento', $3::text, 'estado', $3::text, 'saldo_pendiente', $4::numeric),
       updated_date = now()
     WHERE entity = $1 AND id = $2 AND COALESCE(data->>'anulado', 'false') <> 'true'`,
    [o.documento_modulo, o.documento_id, estado, saldo]);
}

// ── Contabilidad (sin plan de cuentas: cuenta_rol conceptual) ─────────────────

export async function asiento(tx, ctx, op, lineas, { clave, fecha: f, documento_numero, modulo_origen, concepto, tercero_id,
  tercero_nombre, referencia, estado = 'confirmado' }) {
  const validas = lineas.map((l) => ({ ...l, valor: r2(l.valor) })).filter((l) => l.valor > 0);
  const deb = r2(validas.filter((l) => l.naturaleza === 'debito').reduce((s, l) => s + l.valor, 0));
  const cre = r2(validas.filter((l) => l.naturaleza === 'credito').reduce((s, l) => s + l.valor, 0));
  if (Math.abs(deb - cre) > 0.01) {
    throw new HttpError(500, `Registro contable descuadrado en ${clave}: débitos ${deb} ≠ créditos ${cre}`);
  }
  for (const [i, l] of validas.entries()) {
    await tx.query(
      `INSERT INTO fin_mov_contables (id, operacion_id, fecha, documento_numero, modulo_origen, tipo_operacion, tercero_id,
         tercero_nombre, concepto, naturaleza, cuenta_rol, cuenta_dinero_id, valor, referencia, estado, origen_clave, usuario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [newId(), op.id, f || op.fecha, documento_numero || null, modulo_origen || op.origen_modulo || null, op.tipo_operacion,
        tercero_id ?? op.tercero_id ?? null, tercero_nombre ?? op.tercero_nombre ?? null, concepto || op.concepto || null,
        l.naturaleza, l.cuenta_rol, l.cuenta_dinero_id || null, l.valor, referencia || null, estado, `${clave}:${i}`, ctx.usuario]
    );
  }
}

// ── Vínculos entre documentos (trazabilidad y "Documentos y Soportes") ───────

export async function vincular(tx, desde_modulo, desde_id, hacia_modulo, hacia_id, tipo_relacion) {
  await tx.query(
    `INSERT INTO fin_vinculos (id, desde_modulo, desde_id, hacia_modulo, hacia_id, tipo_relacion)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [newId(), desde_modulo, String(desde_id), hacia_modulo, String(hacia_id), tipo_relacion]
  );
}

// ── Anulación: nada se borra; todo se reversa en la misma transacción ────────

export async function anularOperacion(tx, ctx, { operacion_id, motivo, idempotency_key }) {
  requerirRol(ctx, ['admin'], 'anular operaciones');
  if (!motivo || String(motivo).trim().length < 5) throw new HttpError(400, 'El motivo de la anulación es obligatorio');
  const orig = await one(tx, `SELECT * FROM fin_operaciones WHERE id = $1 FOR UPDATE`, [operacion_id]);
  if (!orig) throw new HttpError(404, 'La operación no existe');
  if (orig.tipo_operacion === 'anulacion') throw new HttpError(409, 'Una anulación no se puede anular');

  const hoy = hoyColombia();
  const { operacion: op, duplicada } = await iniciarOperacion(tx, ctx, {
    tipo_operacion: 'anulacion', fecha: hoy, idempotency_key, tercero_id: orig.tercero_id, tercero_nombre: orig.tercero_nombre,
    valor: orig.valor, concepto: `Anulación de ${orig.tipo_operacion}`, origen_modulo: orig.origen_modulo, origen_id: orig.origen_id,
    anula_a: orig.id, motivo,
  });
  if (duplicada) return { duplicada: true, anulacion: op, resultado: op.resultado };
  if (orig.estado !== 'confirmada') throw new HttpError(409, `La operación ya está ${orig.estado}`);
  await verificarPeriodoAbierto(tx, orig.fecha);
  await verificarPeriodoAbierto(tx, hoy);

  // Las cuentas por cobrar/pagar que nacieron en esta operación no se pueden anular si tienen
  // abonos de otras operaciones vigentes: primero se anulan esos cobros/pagos.
  const obligaciones = (await tx.query(`SELECT * FROM fin_obligaciones WHERE operacion_id = $1`, [orig.id])).rows;
  if (obligaciones.length) {
    const ajenas = (await tx.query(
      `SELECT a.id, d.numero FROM fin_aplicaciones a
       LEFT JOIN fin_documentos d ON d.id = a.documento_id
       WHERE a.obligacion_id = ANY($1) AND a.operacion_id <> $2 AND a.tipo <> 'reversa'
         AND NOT EXISTS (SELECT 1 FROM fin_aplicaciones r WHERE r.reversa_de = a.id)`,
      [obligaciones.map((o) => o.id), orig.id])).rows;
    if (ajenas.length) {
      const docs = [...new Set(ajenas.map((a) => a.numero).filter(Boolean))].join(', ');
      throw new HttpError(409, `No se puede anular: la cuenta por cobrar/pagar tiene abonos posteriores vigentes${docs ? ` (${docs})` : ''}. Anula primero esos cobros o pagos.`);
    }
  }

  const contable = { documento_numero: null, modulo_origen: orig.origen_modulo };
  const movs = (await tx.query(
    `SELECT * FROM fin_movimientos_dinero WHERE operacion_id = $1 AND estado = 'confirmado' ORDER BY created_date`, [orig.id])).rows;
  for (const m of movs) {
    await registrarMovimiento(tx, ctx, op, {
      cuenta_id: m.cuenta_id, fecha: hoy, naturaleza: naturalezaInversa(m.naturaleza), clase: m.clase, valor: r2(m.valor),
      concepto: `Anulación · ${m.concepto || ''}`, tercero_id: m.tercero_id, tercero_nombre: m.tercero_nombre,
      documento_id: m.documento_id, origen_clave: `rev:${m.id}`, estado: 'reversa', reversa_de: m.id, sin_gmf: true, contable,
    });
    await tx.query(`UPDATE fin_movimientos_dinero SET estado = 'anulado' WHERE id = $1`, [m.id]);
  }

  const aplics = (await tx.query(
    `SELECT a.* FROM fin_aplicaciones a WHERE a.operacion_id = $1 AND a.tipo <> 'reversa'
       AND NOT EXISTS (SELECT 1 FROM fin_aplicaciones r WHERE r.reversa_de = a.id)`, [orig.id])).rows;
  for (const a of aplics) {
    await aplicarAObligacion(tx, ctx, op, {
      obligacion_id: a.obligacion_id, tipo: 'reversa', valor: r2(-Number(a.valor)), fecha: hoy,
      concepto: `Anulación · ${a.concepto || a.tipo}`, reversa_de: a.id, origen_clave: `rev:${a.id}`,
    });
  }

  for (const o of obligaciones) await tx.query(`UPDATE fin_obligaciones SET anulada = true WHERE id = $1`, [o.id]);
  for (const oblId of new Set(aplics.map((a) => a.obligacion_id))) await sincronizarEstadoPago(tx, oblId);
  await tx.query(`UPDATE fin_retenciones SET anulada = true WHERE operacion_id = $1`, [orig.id]);
  const docs = (await tx.query(`UPDATE fin_documentos SET estado = 'anulado' WHERE operacion_id = $1 RETURNING numero`, [orig.id])).rows;

  const contables = (await tx.query(
    `SELECT * FROM fin_mov_contables WHERE operacion_id = $1 AND estado = 'confirmado'`, [orig.id])).rows;
  for (const c of contables) {
    await tx.query(
      `INSERT INTO fin_mov_contables (id, operacion_id, fecha, documento_numero, modulo_origen, tipo_operacion, tercero_id,
         tercero_nombre, concepto, naturaleza, cuenta_rol, cuenta_dinero_id, valor, referencia, estado, origen_clave, usuario)
       VALUES ($1,$2,$3,$4,$5,'anulacion',$6,$7,$8,$9,$10,$11,$12,$13,'reversa',$14,$15)
       ON CONFLICT (origen_clave) DO NOTHING`,
      [newId(), op.id, hoy, c.documento_numero, c.modulo_origen, c.tercero_id, c.tercero_nombre, `Anulación · ${c.concepto || ''}`,
        c.naturaleza === 'debito' ? 'credito' : 'debito', c.cuenta_rol, c.cuenta_dinero_id, c.valor, c.id, `rev:${c.id}`, ctx.usuario]
    );
    await tx.query(`UPDATE fin_mov_contables SET estado = 'anulado' WHERE id = $1`, [c.id]);
  }

  await tx.query(`UPDATE fin_operaciones SET estado = 'anulada', anulada_por = $2, motivo = $3 WHERE id = $1`, [orig.id, op.id, motivo]);
  await vincular(tx, 'fin_operaciones', orig.id, 'fin_operaciones', op.id, 'anulada_por');
  await auditar(tx, ctx, { accion: 'anular', entidad: 'fin_operaciones', entidad_id: orig.id, operacion_id: op.id,
    antes: { estado: orig.estado }, despues: { estado: 'anulada', documentos: docs.map((d) => d.numero) }, motivo });

  const resultado = { anulacion_id: op.id, operacion_anulada: orig.id, documentos_anulados: docs.map((d) => d.numero),
    movimientos_reversados: movs.length, aplicaciones_reversadas: aplics.length };
  await finalizarOperacion(tx, op.id, resultado);
  return { duplicada: false, anulacion: op, original: orig, resultado };
}
