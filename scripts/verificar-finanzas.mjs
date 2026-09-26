// Verificación técnica del motor financiero SIN tocar los datos reales.
//
// Crea un esquema temporal aislado (fin_verif_<fecha>) con copias vacías de las tablas,
// fija search_path SOLO a ese esquema (ningún nombre de tabla puede resolver a los datos
// reales), ejecuta los escenarios de error y lo elimina al terminar, pase lo que pase.
//
//   npm run verificar:finanzas
import 'dotenv/config';
import { withClient, withTx } from '../api/_lib/fin/pool.js';
import { aplicarEsquemaFin } from '../api/_lib/fin/schema.js';
import * as core from '../api/_lib/fin/core.js';
import * as C from '../api/_lib/fin/consultas.js';
import { volcar, aplicarDump } from './db-snapshot.mjs';

const ESQUEMA = `fin_verif_${Date.now()}`;
const admin = { usuario: 'verif-admin@local', rol: 'admin' };
const contador = { usuario: 'verif-contador@local', rol: 'contador' };
const operario = { usuario: 'verif-operario@local', rol: 'operario' };

let fallos = 0;
let pruebas = 0;
const ok = (cond, msg) => { pruebas++; if (cond) console.log(`  ✔ ${msg}`); else { fallos++; console.log(`  ✘ ${msg}`); } };
async function falla(fn, patron, msg) {
  pruebas++;
  try { await fn(); fallos++; console.log(`  ✘ ${msg} (no falló)`); }
  catch (e) {
    if (patron.test(e.message)) console.log(`  ✔ ${msg}`);
    else { fallos++; console.log(`  ✘ ${msg} → error inesperado: ${e.message}`); }
  }
}
const tx = (fn) => withTx(fn, { searchPath: ESQUEMA });
const key = (s) => `verif-${s}-${Math.random().toString(36).slice(2)}`;
export const util = { tx, key, ok, falla, admin, contador, operario, ESQUEMA };

async function prepararEsquema() {
  await withClient(async (c) => {
    await c.query(`CREATE SCHEMA ${ESQUEMA}`);
    for (const t of ['records', 'app_users', 'app_files']) {
      await c.query(`CREATE TABLE ${ESQUEMA}.${t} (LIKE public.${t} INCLUDING ALL)`);
    }
  });
  await tx((t) => aplicarEsquemaFin(t));
}

async function nuevaOperacion(t, ctx, tipo = 'prueba', f) {
  return (await core.iniciarOperacion(t, ctx, { tipo_operacion: tipo, fecha: f || core.hoyColombia(), idempotency_key: key(tipo) })).operacion;
}

async function pruebasBase() {
  console.log('\n[A2] Base técnica');
  const caja = await tx((t) => C.crearCuenta(t, admin, { tipo: 'caja', nombre: 'Caja prueba', saldo_inicial: 1000 }));
  const banco = await tx((t) => C.crearCuenta(t, admin, { tipo: 'banco', nombre: 'Banco prueba', saldo_inicial: 100000 }));
  ok(caja.saldo === 1000 && banco.aplica_gmf === true, 'Cuentas creadas: saldo = saldo inicial; los bancos aplican GMF por defecto');
  await falla(() => tx((t) => C.crearCuenta(t, contador, { tipo: 'caja', nombre: 'X' })), /permiso/, 'Un contador no puede crear cuentas');
  await falla(() => tx((t) => C.crearCuenta(t, admin, { tipo: 'caja', nombre: 'Caja prueba' })), /Ya existe/, 'No se permiten dos cajas con el mismo nombre');

  // Consecutivos: un número usado en una transacción deshecha no se consume.
  const n1 = await tx((t) => core.siguienteConsecutivo(t, 'ZZ', 2026));
  await withTx(async (t) => { await core.siguienteConsecutivo(t, 'ZZ', 2026); throw new Error('forzado'); }, { searchPath: ESQUEMA }).catch(() => {});
  const n2 = await tx((t) => core.siguienteConsecutivo(t, 'ZZ', 2026));
  ok(n1 === 1 && n2 === 2, `Consecutivos sin huecos tras un fallo (1 → ${n2})`);
  const n3 = await tx((t) => core.siguienteConsecutivo(t, 'YY', 2026, async () => 41));
  ok(n3 === 42, 'Un consecutivo nuevo arranca desde el máximo existente (41 → 42)');

  // Idempotencia: la misma llave nunca registra dos operaciones.
  const k = key('idem');
  const r1 = await tx((t) => core.iniciarOperacion(t, admin, { tipo_operacion: 'prueba', fecha: core.hoyColombia(), idempotency_key: k }));
  const r2 = await tx((t) => core.iniciarOperacion(t, admin, { tipo_operacion: 'prueba', fecha: core.hoyColombia(), idempotency_key: k }));
  ok(!r1.duplicada && r2.duplicada && r1.operacion.id === r2.operacion.id, 'Doble envío con la misma llave: la segunda vez devuelve la primera operación');

  // Movimientos, saldos calculados y saldo insuficiente.
  await tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'entrada', clase: 'ingreso', valor: 500, origen_clave: `p:${op.id}:1` });
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'salida', clase: 'egreso', valor: 300, origen_clave: `p:${op.id}:2` });
  });
  ok((await tx((t) => core.saldoCuenta(t, caja.id))) === 1200, 'Saldo = inicial + entradas − salidas (1000 + 500 − 300 = 1200)');
  await falla(() => tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'salida', clase: 'egreso', valor: 5000, origen_clave: `p:${op.id}:x` });
  }), /Saldo insuficiente/, 'Una salida de caja mayor al saldo se rechaza');

  // GMF en bancos.
  await tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: banco.id, fecha: core.hoyColombia(), naturaleza: 'salida', clase: 'egreso', valor: 10000, origen_clave: `p:${op.id}:b`, concepto: 'pago' });
  });
  ok((await tx((t) => core.saldoCuenta(t, banco.id))) === 89960, 'Salida bancaria de 10.000 descuenta además el GMF de 40 (100.000 → 89.960)');

  // Operación a medias: si falla un paso, no queda nada.
  const antes = await tx((t) => core.saldoCuenta(t, caja.id));
  await withTx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'entrada', clase: 'ingreso', valor: 777, origen_clave: `p:${op.id}:m` });
    throw new Error('fallo forzado a mitad de la operación');
  }, { searchPath: ESQUEMA }).catch(() => {});
  ok((await tx((t) => core.saldoCuenta(t, caja.id))) === antes, 'Un fallo a mitad de la operación no deja ningún movimiento (todo o nada)');

  // Efecto duplicado.
  await falla(() => tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'entrada', clase: 'ingreso', valor: 1, origen_clave: 'dup:1' });
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'entrada', clase: 'ingreso', valor: 1, origen_clave: 'dup:1' });
  }), /ya fue registrado/, 'El mismo efecto (misma llave de origen) no se puede registrar dos veces');

  // Protección en la base de datos.
  await falla(() => tx((t) => t.query('DELETE FROM fin_movimientos_dinero')), /protegido/, 'La base de datos impide borrar movimientos de dinero');
  await falla(() => tx((t) => t.query('UPDATE fin_movimientos_dinero SET valor = valor + 1')), /no se puede modificar/, 'La base de datos impide cambiar el valor de un movimiento');
  await falla(() => tx((t) => t.query('DELETE FROM fin_auditoria')), /protegido/, 'La bitácora no se puede borrar');
  await falla(() => tx((t) => t.query(`UPDATE fin_auditoria SET accion = 'x'`)), /protegido/, 'La bitácora no se puede modificar');
  await tx((t) => t.query('UPDATE fin_movimientos_dinero SET conciliado = true WHERE cuenta_id = $1', [banco.id]));
  ok(true, 'Marcar un movimiento como conciliado sí está permitido (no altera su valor)');

  // Concurrencia: dos salidas simultáneas de 700 sobre una caja con 1.200.
  const saldoInicial = await tx((t) => core.saldoCuenta(t, caja.id));
  const intento = () => tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: core.hoyColombia(), naturaleza: 'salida', clase: 'egreso', valor: 700, origen_clave: `c:${op.id}` });
    await new Promise((r) => setTimeout(r, 400));
  });
  const res = await Promise.allSettled([intento(), intento()]);
  const exitos = res.filter((r) => r.status === 'fulfilled').length;
  const saldoFinal = await tx((t) => core.saldoCuenta(t, caja.id));
  ok(saldoInicial === 1200 && exitos === 1 && saldoFinal === 500,
    `Dos salidas simultáneas de 700 con saldo 1.200: se aplica una sola y la otra ve el saldo real (saldo final ${saldoFinal})`);

  // Anulación por reversa.
  const opId = await tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.registrarMovimiento(t, admin, op, { cuenta_id: banco.id, fecha: core.hoyColombia(), naturaleza: 'salida', clase: 'egreso', valor: 1000, origen_clave: `a:${op.id}`, concepto: 'x' });
    await core.asiento(t, admin, op, [{ naturaleza: 'debito', cuenta_rol: 'gasto', valor: 1000 }, { naturaleza: 'credito', cuenta_rol: 'disponible', valor: 1000 }], { clave: `a:${op.id}` });
    return op.id;
  });
  const saldoAntesAnular = await tx((t) => core.saldoCuenta(t, banco.id));
  await falla(() => tx((t) => core.anularOperacion(t, contador, { operacion_id: opId, motivo: 'error de digitación', idempotency_key: key('an') })), /permiso/, 'Solo el administrador puede anular');
  await falla(() => tx((t) => core.anularOperacion(t, admin, { operacion_id: opId, motivo: '', idempotency_key: key('an') })), /motivo/, 'La anulación exige un motivo');
  await tx((t) => core.anularOperacion(t, admin, { operacion_id: opId, motivo: 'error de digitación', idempotency_key: key('an') }));
  const saldoTrasAnular = await tx((t) => core.saldoCuenta(t, banco.id));
  ok(saldoTrasAnular === saldoAntesAnular + 1004, 'Anular devuelve el saldo, incluido el GMF (+1.004), sin borrar el movimiento original');
  const cont = await tx((t) => t.query(`SELECT naturaleza, sum(valor)::numeric v FROM fin_mov_contables GROUP BY naturaleza`));
  ok(cont.rows.length === 2 && cont.rows[0].v === cont.rows[1].v, 'Tras anular, los registros contables siguen cuadrados (débitos = créditos)');
  await falla(() => tx((t) => core.anularOperacion(t, admin, { operacion_id: opId, motivo: 'otra vez', idempotency_key: key('an') })), /ya está anulada/, 'Una operación anulada no se puede anular dos veces');

  // Obligaciones: nunca se aplica más que el saldo.
  await falla(() => tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    const o = await core.crearObligacion(t, admin, op, { naturaleza: 'por_cobrar', fecha: core.hoyColombia(), valor_original: 1000, origen_clave: `o:${op.id}` });
    await core.aplicarAObligacion(t, admin, op, { obligacion_id: o.id, tipo: 'abono', valor: 1500, fecha: core.hoyColombia(), origen_clave: `oa:${op.id}` });
  }), /supera el saldo/, 'Un abono mayor al saldo de la cuenta por cobrar se rechaza');

  // Asiento descuadrado.
  await falla(() => tx(async (t) => {
    const op = await nuevaOperacion(t, admin);
    await core.asiento(t, admin, op, [{ naturaleza: 'debito', cuenta_rol: 'a', valor: 10 }, { naturaleza: 'credito', cuenta_rol: 'b', valor: 9 }], { clave: `d:${op.id}` });
  }), /descuadrado/, 'Un registro contable descuadrado se rechaza');

  // Período cerrado.
  await tx((t) => C.cerrarPeriodo(t, admin, { desde: '2020-01-01', hasta: '2020-12-31' }));
  await falla(() => tx(async (t) => {
    const op = await nuevaOperacion(t, admin, 'prueba', '2020-06-15');
    await core.registrarMovimiento(t, admin, op, { cuenta_id: caja.id, fecha: '2020-06-15', naturaleza: 'entrada', clase: 'ingreso', valor: 10, origen_clave: `pc:${op.id}` });
  }), /está cerrado/, 'No se puede registrar con fecha dentro de un período cerrado');

  // Libro y bitácora.
  const libro = await tx((t) => C.libroCuenta(t, caja.id));
  const ultimo = libro.movimientos[libro.movimientos.length - 1];
  ok(ultimo.saldo === libro.saldo_final && libro.saldo_final === (await tx((t) => core.saldoCuenta(t, caja.id))), 'El libro de caja cuadra: el saldo acumulado coincide con el saldo calculado');
  const aud = await tx((t) => t.query(`SELECT count(*)::int n FROM fin_auditoria`));
  ok(aud.rows[0].n > 5, `La bitácora registró automáticamente las acciones (${aud.rows[0].n} entradas)`);

  // Respaldo y restauración atómica dentro del esquema temporal.
  const tablas = await withClient(volcar, { searchPath: ESQUEMA });
  const filasAntes = tablas.fin_movimientos_dinero.length;
  await withClient(async (c) => {
    await c.query('BEGIN');
    await aplicarDump(c, { tablas }, 'verificacion');
    await c.query('COMMIT');
  }, { searchPath: ESQUEMA });
  const saldoRestaurado = await tx((t) => core.saldoCuenta(t, caja.id));
  const filasDespues = (await tx((t) => t.query('SELECT count(*)::int n FROM fin_movimientos_dinero'))).rows[0].n;
  ok(filasAntes === filasDespues && saldoRestaurado === libro.saldo_final, 'Respaldo → restauración: mismas filas y mismos saldos');
}

async function pruebasOperaciones() {
  console.log('\n[A3] Operaciones del motor');
  const OP = await import('../api/_lib/fin/operaciones.js');
  const caja = await tx((t) => C.crearCuenta(t, admin, { tipo: 'caja', nombre: 'Caja A3', saldo_inicial: 0 }));
  const banco = await tx((t) => C.crearCuenta(t, admin, { tipo: 'banco', nombre: 'Banco A3', saldo_inicial: 10000000 }));
  const nequi = await tx((t) => C.crearCuenta(t, admin, { tipo: 'otro_medio', nombre: 'Nequi A3', saldo_inicial: 0 }));
  const hoy = core.hoyColombia();
  const saldo = (id) => tx((t) => core.saldoCuenta(t, id));
  const saldoObl = (id) => tx((t) => core.saldoObligacion(t, id));

  // Una CxC de 3.000.000 (lo que creará una venta a crédito en A4).
  const cxc = await tx(async (t) => {
    const op = await nuevaOperacion(t, admin, 'venta');
    return core.crearObligacion(t, admin, op, { naturaleza: 'por_cobrar', tercero_id: 'cli-1', tercero_nombre: 'Cliente Uno',
      documento_modulo: 'OrdenVenta', documento_id: 'venta-1', documento_numero: 'FV-TEST-0001', fecha: hoy, fecha_vencimiento: hoy,
      valor_original: 3000000, origen_clave: `v:${op.id}` });
  });

  const kCobro = key('cobro');
  const r1 = await tx((t) => OP.cobro(t, contador, { obligacion_id: cxc.id, cuenta_id: caja.id, valor: 1000000, idempotency_key: kCobro }));
  ok(r1.saldo_pendiente === 2000000 && (await saldo(caja.id)) === 1000000 && /^RC-\d{4}-0001$/.test(r1.documento.numero),
    `Venta 3M, abono 1M → CxC 2M, caja +1M y Recibo de Caja ${r1.documento.numero}`);
  const r1b = await tx((t) => OP.cobro(t, contador, { obligacion_id: cxc.id, cuenta_id: caja.id, valor: 1000000, idempotency_key: kCobro }));
  ok(r1b.duplicada && (await saldoObl(cxc.id)) === 2000000 && (await saldo(caja.id)) === 1000000, 'Doble envío del mismo cobro: no se cobra dos veces');
  await falla(() => tx((t) => OP.cobro(t, contador, { obligacion_id: cxc.id, cuenta_id: caja.id, valor: 2500000, idempotency_key: key('c') })),
    /supera el saldo/, 'Un cobro mayor al saldo pendiente se rechaza');

  const r2 = await tx((t) => OP.cobro(t, contador, { obligacion_id: cxc.id, cuenta_id: nequi.id, valor: 950000,
    retencion: { tipo: 'retefuente', valor: 50000 }, idempotency_key: key('c') }));
  ok(r2.saldo_pendiente === 1000000 && (await saldo(nequi.id)) === 950000, 'Cobro por Nequi de 950.000 con retención de 50.000 baja la CxC en 1.000.000');

  const rel = await tx((t) => C.relacionadosDeOrigen(t, 'OrdenVenta', 'venta-1'));
  const vinc = await tx((t) => C.listarVinculos(t, 'OrdenVenta', 'venta-1'));
  ok(vinc.filter((v) => v.tipo_relacion === 'documento_relacionado').length === 2 && rel.aplicaciones.length === 3,
    'Desde la venta se ven sus dos recibos de caja y los abonos (vinculación automática)');

  // CxP con pago bancario y GMF.
  const cxp = await tx(async (t) => {
    const op = await nuevaOperacion(t, admin, 'compra');
    return core.crearObligacion(t, admin, op, { naturaleza: 'por_pagar', tercero_id: 'prov-1', tercero_nombre: 'Proveedor Uno',
      documento_modulo: 'OrdenCompra', documento_id: 'compra-1', documento_numero: 'CP-TEST-0025', fecha: hoy, valor_original: 5000000,
      origen_clave: `c:${op.id}` });
  });
  const p1 = await tx((t) => OP.pago(t, contador, { obligacion_id: cxp.id, cuenta_id: banco.id, valor: 2000000, idempotency_key: key('p') }));
  ok(p1.saldo_pendiente === 3000000 && (await saldo(banco.id)) === 7992000 && /^CE-/.test(p1.documento.numero),
    `Compra 5M, pago 2M por banco → CxP 3M, banco −2.008.000 (incluye GMF) y ${p1.documento.numero}`);

  // Transferencia: no crea ingresos ni gastos.
  const totalAntes = (await saldo(caja.id)) + (await saldo(banco.id));
  await tx((t) => OP.transferencia(t, contador, { cuenta_origen_id: banco.id, cuenta_destino_id: caja.id, valor: 500000, exenta_gmf: true, idempotency_key: key('t') }));
  const totalDespues = (await saldo(caja.id)) + (await saldo(banco.id));
  const rolesTr = await tx((t) => t.query(`SELECT DISTINCT m.cuenta_rol FROM fin_mov_contables m JOIN fin_operaciones o ON o.id = m.operacion_id WHERE o.tipo_operacion = 'transferencia'`));
  ok(totalAntes === totalDespues && rolesTr.rows.every((r) => r.cuenta_rol === 'disponible'),
    'Transferencia banco → caja (exenta de GMF): el total no cambia y no genera ingreso ni gasto');
  await falla(() => tx((t) => OP.transferencia(t, contador, { cuenta_origen_id: caja.id, cuenta_destino_id: caja.id, valor: 1, idempotency_key: key('t') })),
    /distintas/, 'No se puede transferir a la misma cuenta');

  // Anticipo de cliente y cruce.
  const ant = await tx((t) => OP.anticipo(t, contador, { tipo: 'cliente', tercero_id: 'cli-1', tercero_nombre: 'Cliente Uno', cuenta_id: caja.id,
    valor: 300000, idempotency_key: key('a') }));
  const cr = await tx((t) => OP.cruceAnticipo(t, contador, { anticipo_id: ant.anticipo_id, obligacion_id: cxc.id, valor: 300000, idempotency_key: key('x') }));
  ok(cr.saldo_pendiente === 700000 && cr.saldo_anticipo === 0, 'Anticipo de 300.000 cruzado contra la CxC: CxC 700.000, anticipo agotado');

  // Notas crédito y débito.
  const nc = await tx((t) => OP.nota(t, contador, { obligacion_id: cxc.id, tipo: 'credito', valor: 100000, motivo: 'descuento comercial', idempotency_key: key('n') }));
  const nd = await tx((t) => OP.nota(t, contador, { obligacion_id: cxc.id, tipo: 'debito', valor: 40000, motivo: 'recargo transporte', idempotency_key: key('n') }));
  ok(nc.saldo_pendiente === 600000 && nd.saldo_pendiente === 640000 && /^NC-/.test(nc.documento.numero) && /^ND-/.test(nd.documento.numero),
    'Nota crédito −100.000 y nota débito +40.000 ajustan la CxC sin anular la venta');

  // Ajustes: solo administrador.
  await falla(() => tx((t) => OP.ajuste(t, contador, { cuenta_id: caja.id, naturaleza: 'salida', valor: 1000, motivo: 'faltante arqueo', idempotency_key: key('j') })),
    /permiso/, 'Un contador no puede hacer ajustes de caja');
  await tx((t) => OP.ajuste(t, admin, { cuenta_id: caja.id, naturaleza: 'salida', valor: 1000, motivo: 'faltante arqueo', idempotency_key: key('j') }));
  ok(true, 'El administrador sí registra el ajuste (queda con su motivo en la bitácora)');
  await falla(() => tx((t) => OP.egreso(t, operario, { cuenta_id: caja.id, valor: 1, concepto: 'x', idempotency_key: key('e') })),
    /permiso/, 'Un operario no puede registrar movimientos de dinero');

  // Anulaciones encadenadas.
  const cajaAntes = await saldo(caja.id);
  await tx((t) => core.anularOperacion(t, admin, { operacion_id: r1.operacion_id, motivo: 'cobro registrado por error', idempotency_key: key('an') }));
  ok((await saldoObl(cxc.id)) === 1640000 && (await saldo(caja.id)) === cajaAntes - 1000000,
    'Anular el primer cobro devuelve 1M a la CxC y lo saca de la caja');
  const rc = await tx((t) => t.query(`SELECT estado FROM fin_documentos WHERE numero = $1`, [r1.documento.numero]));
  ok(rc.rows[0].estado === 'anulado', `El recibo ${r1.documento.numero} queda marcado ANULADO (no se borra)`);
  await falla(() => tx((t) => core.anularOperacion(t, admin, { operacion_id: cxc.operacion_id, motivo: 'anular la venta', idempotency_key: key('an') })),
    /abonos posteriores/, 'No se puede anular una venta cuya CxC tiene cobros vigentes: primero se anulan los cobros');

  // Toda la contabilidad cuadra, operación por operación.
  const desc = await tx((t) => t.query(
    `SELECT operacion_id FROM fin_mov_contables GROUP BY operacion_id
     HAVING sum(CASE WHEN naturaleza = 'debito' THEN valor ELSE -valor END) <> 0`));
  ok(desc.rows.length === 0, 'Cada operación deja registros contables cuadrados (débitos = créditos)');
}

async function main() {
  console.log(`Esquema temporal: ${ESQUEMA} (se elimina al terminar)`);
  try {
    await prepararEsquema();
    await pruebasBase();
    await pruebasOperaciones();
    const extra = process.env.VERIF_EXTRA ? await import(process.env.VERIF_EXTRA) : null;
    if (extra?.default) await extra.default(util);
  } catch (e) {
    fallos++;
    console.error('\nError inesperado durante la verificación:', e);
  } finally {
    await withClient((c) => c.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`));
    console.log(`\nEsquema temporal eliminado. ${pruebas - fallos}/${pruebas} verificaciones correctas.`);
  }
  process.exit(fallos ? 1 : 0);
}

main();
