import { getSql } from '../db.js';
import { withTx } from './pool.js';

// Versión del esquema financiero. Subirla cuando cambie FIN_SCHEMA_SQL.
export const FIN_SCHEMA_VERSION = 1;

// Dinero en numeric(18,2): nunca punto flotante. Todas las sentencias son idempotentes.
export const FIN_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS fin_meta (clave text PRIMARY KEY, valor text NOT NULL)`,

  `CREATE TABLE IF NOT EXISTS fin_cuentas_dinero (
    id text PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('caja','banco','otro_medio')),
    nombre text NOT NULL,
    entidad text, tipo_cuenta text, numero text, titular text,
    saldo_inicial numeric(18,2) NOT NULL DEFAULT 0,
    fecha_saldo_inicial date,
    saldo_inicial_confirmado boolean NOT NULL DEFAULT false,
    permite_saldo_negativo boolean NOT NULL DEFAULT false,
    aplica_gmf boolean NOT NULL DEFAULT false,
    estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva')),
    fecha_apertura date,
    observaciones text,
    legacy_ref text,
    created_date timestamptz NOT NULL DEFAULT now(),
    updated_date timestamptz NOT NULL DEFAULT now(),
    created_by text,
    UNIQUE (tipo, nombre)
  )`,

  `CREATE TABLE IF NOT EXISTS fin_operaciones (
    id text PRIMARY KEY,
    tipo_operacion text NOT NULL,
    fecha date NOT NULL,
    tercero_id text, tercero_nombre text,
    valor numeric(18,2),
    concepto text,
    estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','anulada','pendiente_aprobacion','rechazada')),
    idempotency_key text NOT NULL UNIQUE,
    origen_modulo text, origen_id text,
    anula_a text REFERENCES fin_operaciones(id),
    anulada_por text,
    motivo text,
    datos jsonb NOT NULL DEFAULT '{}'::jsonb,
    resultado jsonb,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS fin_operaciones_origen_idx ON fin_operaciones (origen_modulo, origen_id)`,

  `CREATE TABLE IF NOT EXISTS fin_consecutivos (
    tipo text NOT NULL, anio int NOT NULL, ultimo int NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, anio)
  )`,

  `CREATE TABLE IF NOT EXISTS fin_documentos (
    id text PRIMARY KEY,
    tipo text NOT NULL,
    anio int NOT NULL,
    consecutivo int NOT NULL,
    numero text NOT NULL UNIQUE,
    fecha date NOT NULL,
    tercero_id text, tercero_nombre text,
    concepto text,
    valor numeric(18,2) NOT NULL DEFAULT 0,
    medio_pago text,
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    estado text NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido','anulado')),
    datos jsonb NOT NULL DEFAULT '{}'::jsonb,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tipo, anio, consecutivo)
  )`,

  `CREATE TABLE IF NOT EXISTS fin_movimientos_dinero (
    id text PRIMARY KEY,
    cuenta_id text NOT NULL REFERENCES fin_cuentas_dinero(id),
    fecha date NOT NULL,
    naturaleza text NOT NULL CHECK (naturaleza IN ('entrada','salida')),
    clase text NOT NULL CHECK (clase IN ('ingreso','egreso','transferencia','ajuste','gmf','comision','interes')),
    valor numeric(18,2) NOT NULL CHECK (valor > 0),
    concepto text,
    tercero_id text, tercero_nombre text,
    documento_id text REFERENCES fin_documentos(id),
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    origen_clave text NOT NULL UNIQUE,
    estado text NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado','anulado','reversa')),
    reversa_de text REFERENCES fin_movimientos_dinero(id),
    conciliado boolean NOT NULL DEFAULT false,
    conciliacion_id text,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS fin_mov_cuenta_fecha_idx ON fin_movimientos_dinero (cuenta_id, fecha, created_date)`,
  `CREATE INDEX IF NOT EXISTS fin_mov_operacion_idx ON fin_movimientos_dinero (operacion_id)`,

  `CREATE TABLE IF NOT EXISTS fin_obligaciones (
    id text PRIMARY KEY,
    naturaleza text NOT NULL CHECK (naturaleza IN ('por_cobrar','por_pagar','anticipo_cliente','anticipo_proveedor')),
    clase text NOT NULL DEFAULT 'documento' CHECK (clase IN ('documento','saldo_inicial','anticipo','proceso_externo','otro')),
    tercero_id text, tercero_nombre text, tercero_nit text,
    documento_modulo text, documento_id text, documento_numero text,
    fecha date NOT NULL,
    fecha_vencimiento date,
    valor_original numeric(18,2) NOT NULL CHECK (valor_original > 0),
    concepto text,
    anulada boolean NOT NULL DEFAULT false,
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    origen_clave text NOT NULL UNIQUE,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS fin_oblig_tercero_idx ON fin_obligaciones (naturaleza, tercero_id)`,
  `CREATE INDEX IF NOT EXISTS fin_oblig_doc_idx ON fin_obligaciones (documento_modulo, documento_id)`,

  // valor > 0 disminuye el saldo pendiente (abono, nota crédito, retención, cruce, devolución);
  // valor < 0 lo aumenta (nota débito o reversa de una aplicación).
  `CREATE TABLE IF NOT EXISTS fin_aplicaciones (
    id text PRIMARY KEY,
    obligacion_id text NOT NULL REFERENCES fin_obligaciones(id),
    tipo text NOT NULL CHECK (tipo IN ('abono','nota_credito','nota_debito','retencion','cruce_anticipo','devolucion','reversa')),
    valor numeric(18,2) NOT NULL CHECK (valor <> 0),
    fecha date NOT NULL,
    concepto text,
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    movimiento_id text REFERENCES fin_movimientos_dinero(id),
    documento_id text REFERENCES fin_documentos(id),
    reversa_de text REFERENCES fin_aplicaciones(id),
    origen_clave text NOT NULL UNIQUE,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS fin_aplic_oblig_idx ON fin_aplicaciones (obligacion_id)`,

  `CREATE TABLE IF NOT EXISTS fin_retenciones (
    id text PRIMARY KEY,
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    obligacion_id text REFERENCES fin_obligaciones(id),
    rol text NOT NULL CHECK (rol IN ('practicada','recibida')),
    tipo text NOT NULL CHECK (tipo IN ('retefuente','reteiva','reteica','otra')),
    base numeric(18,2), tarifa numeric(9,6),
    valor numeric(18,2) NOT NULL,
    tercero_id text, tercero_nombre text,
    fecha date NOT NULL,
    anulada boolean NOT NULL DEFAULT false,
    origen_clave text NOT NULL UNIQUE,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS fin_vinculos (
    id text PRIMARY KEY,
    desde_modulo text NOT NULL, desde_id text NOT NULL,
    hacia_modulo text NOT NULL, hacia_id text NOT NULL,
    tipo_relacion text NOT NULL,
    created_date timestamptz NOT NULL DEFAULT now(),
    UNIQUE (desde_modulo, desde_id, hacia_modulo, hacia_id, tipo_relacion)
  )`,
  `CREATE INDEX IF NOT EXISTS fin_vinc_desde_idx ON fin_vinculos (desde_modulo, desde_id)`,
  `CREATE INDEX IF NOT EXISTS fin_vinc_hacia_idx ON fin_vinculos (hacia_modulo, hacia_id)`,

  `CREATE TABLE IF NOT EXISTS fin_soportes (
    id text PRIMARY KEY,
    documento_modulo text NOT NULL, documento_id text NOT NULL,
    tipo_soporte text NOT NULL,
    nombre text NOT NULL,
    clave_almacen text,
    url_externa text,
    mime text, tamano bigint,
    observacion text,
    estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('pendiente','activo','eliminado')),
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now(),
    eliminado_por text, eliminado_en timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS fin_soportes_doc_idx ON fin_soportes (documento_modulo, documento_id)`,

  // cuenta_rol = cuenta conceptual (caja, cxc, ingreso_ventas...). Cuando exista el plan de
  // cuentas, fin_parametrizacion_contable traduce cada rol a su cuenta contable.
  `CREATE TABLE IF NOT EXISTS fin_mov_contables (
    id text PRIMARY KEY,
    operacion_id text NOT NULL REFERENCES fin_operaciones(id),
    fecha date NOT NULL,
    documento_numero text,
    modulo_origen text,
    tipo_operacion text NOT NULL,
    tercero_id text, tercero_nombre text,
    concepto text,
    naturaleza text NOT NULL CHECK (naturaleza IN ('debito','credito')),
    cuenta_rol text NOT NULL,
    cuenta_dinero_id text,
    valor numeric(18,2) NOT NULL CHECK (valor > 0),
    cuenta_contable_id text,
    referencia text,
    estado text NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado','anulado','reversa')),
    origen_clave text NOT NULL UNIQUE,
    usuario text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS fin_movcont_op_idx ON fin_mov_contables (operacion_id)`,
  `CREATE INDEX IF NOT EXISTS fin_movcont_fecha_idx ON fin_mov_contables (fecha)`,

  `CREATE TABLE IF NOT EXISTS fin_parametrizacion_contable (
    cuenta_rol text PRIMARY KEY, cuenta_contable_id text, updated_date timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS fin_periodos (
    id text PRIMARY KEY,
    desde date NOT NULL, hasta date NOT NULL CHECK (hasta >= desde),
    estado text NOT NULL DEFAULT 'cerrado' CHECK (estado IN ('cerrado','reabierto')),
    usuario text, observacion text,
    created_date timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS fin_parametros (
    clave text PRIMARY KEY, valor jsonb NOT NULL, descripcion text,
    updated_date timestamptz NOT NULL DEFAULT now()
  )`,
  `INSERT INTO fin_parametros (clave, valor, descripcion) VALUES
    ('gmf_tasa', '0.004', 'Gravamen a los Movimientos Financieros (4 por mil) sobre salidas bancarias'),
    ('soporte_max_mb', '10', 'Tamaño máximo por archivo de soporte, en MB'),
    ('almacen_alerta_gb', '8', 'Alerta de uso del almacenamiento de soportes (GB)'),
    ('almacen_limite_gratis_gb', '10', 'Capacidad gratuita del almacenamiento de soportes (GB)')
   ON CONFLICT (clave) DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS fin_terceros_config (
    tercero_id text PRIMARY KEY,
    plazo_dias int, cupo_credito numeric(18,2), bloqueo_automatico boolean NOT NULL DEFAULT false,
    updated_date timestamptz NOT NULL DEFAULT now(), updated_by text
  )`,

  `CREATE TABLE IF NOT EXISTS fin_auditoria (
    id text PRIMARY KEY,
    fecha_hora timestamptz NOT NULL DEFAULT now(),
    usuario text, rol text,
    accion text NOT NULL,
    entidad text, entidad_id text,
    operacion_id text,
    antes jsonb, despues jsonb,
    motivo text
  )`,
  `CREATE INDEX IF NOT EXISTS fin_audit_entidad_idx ON fin_auditoria (entidad, entidad_id)`,
  `CREATE INDEX IF NOT EXISTS fin_audit_fecha_idx ON fin_auditoria (fecha_hora)`,

  // ── Protección en la base de datos (no depende de que el código se porte bien) ──
  // La única excepción es la restauración de versiones, que activa fin.restauracion='si'.
  `CREATE OR REPLACE FUNCTION fin_proteger() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF coalesce(current_setting('fin.restauracion', true), '') = 'si' THEN
       IF TG_OP = 'DELETE' THEN RETURN OLD; ELSIF TG_OP = 'UPDATE' THEN RETURN NEW; ELSE RETURN NULL; END IF;
     END IF;
     RAISE EXCEPTION 'Registro financiero protegido: no se permite % en %', TG_OP, TG_TABLE_NAME;
   END $$`,
  `CREATE OR REPLACE FUNCTION fin_campos_inmutables() RETURNS trigger LANGUAGE plpgsql AS $$
   DECLARE c text; n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD);
   BEGIN
     IF coalesce(current_setting('fin.restauracion', true), '') = 'si' THEN RETURN NEW; END IF;
     FOREACH c IN ARRAY TG_ARGV LOOP
       IF (n -> c) IS DISTINCT FROM (o -> c) THEN
         RAISE EXCEPTION 'El campo % de % no se puede modificar después de confirmado (se corrige con una anulación)', c, TG_TABLE_NAME;
       END IF;
     END LOOP;
     RETURN NEW;
   END $$`,
  ...['fin_cuentas_dinero', 'fin_operaciones', 'fin_documentos', 'fin_movimientos_dinero', 'fin_obligaciones',
    'fin_aplicaciones', 'fin_retenciones', 'fin_mov_contables', 'fin_auditoria'].flatMap((t) => [
    `CREATE OR REPLACE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION fin_proteger()`,
    `CREATE OR REPLACE TRIGGER ${t}_no_truncate BEFORE TRUNCATE ON ${t} FOR EACH STATEMENT EXECUTE FUNCTION fin_proteger()`,
  ]),
  `CREATE OR REPLACE TRIGGER fin_auditoria_no_update BEFORE UPDATE ON fin_auditoria FOR EACH ROW EXECUTE FUNCTION fin_proteger()`,
  `CREATE OR REPLACE TRIGGER fin_operaciones_inmutable BEFORE UPDATE ON fin_operaciones FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('tipo_operacion','fecha','valor','idempotency_key','origen_modulo','origen_id','anula_a')`,
  `CREATE OR REPLACE TRIGGER fin_documentos_inmutable BEFORE UPDATE ON fin_documentos FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('tipo','anio','consecutivo','numero','fecha','valor','operacion_id')`,
  `CREATE OR REPLACE TRIGGER fin_movimientos_inmutable BEFORE UPDATE ON fin_movimientos_dinero FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('cuenta_id','fecha','naturaleza','clase','valor','operacion_id','origen_clave','reversa_de')`,
  `CREATE OR REPLACE TRIGGER fin_obligaciones_inmutable BEFORE UPDATE ON fin_obligaciones FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('naturaleza','valor_original','tercero_id','operacion_id','origen_clave')`,
  `CREATE OR REPLACE TRIGGER fin_aplicaciones_inmutable BEFORE UPDATE ON fin_aplicaciones FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('obligacion_id','tipo','valor','fecha','operacion_id','origen_clave','reversa_de')`,
  `CREATE OR REPLACE TRIGGER fin_retenciones_inmutable BEFORE UPDATE ON fin_retenciones FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('operacion_id','rol','tipo','valor','origen_clave')`,
  `CREATE OR REPLACE TRIGGER fin_movcont_inmutable BEFORE UPDATE ON fin_mov_contables FOR EACH ROW
     EXECUTE FUNCTION fin_campos_inmutables('operacion_id','fecha','naturaleza','cuenta_rol','valor','origen_clave')`,
];

// Tablas en orden de dependencia (para respaldos y restauraciones).
export const FIN_TABLES = [
  'fin_meta', 'fin_parametros', 'fin_parametrizacion_contable', 'fin_terceros_config', 'fin_periodos',
  'fin_cuentas_dinero', 'fin_consecutivos', 'fin_operaciones', 'fin_documentos', 'fin_movimientos_dinero',
  'fin_obligaciones', 'fin_aplicaciones', 'fin_retenciones', 'fin_vinculos', 'fin_soportes',
  'fin_mov_contables', 'fin_auditoria',
];

export async function aplicarEsquemaFin(tx) {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext('fin_schema'))`);
  for (const stmt of FIN_SCHEMA_SQL) await tx.query(stmt);
  await tx.query(
    `INSERT INTO fin_meta (clave, valor) VALUES ('schema_version', $1)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
    [String(FIN_SCHEMA_VERSION)]
  );
}

let _finReady = null;

// Se ejecuta una vez por instancia del servidor; si el esquema ya está al día solo cuesta una consulta.
export function ensureFinSchema() {
  if (!_finReady) {
    _finReady = (async () => {
      const sql = getSql();
      let version = 0;
      try {
        const rows = await sql.query(`SELECT valor FROM fin_meta WHERE clave = 'schema_version'`);
        version = Number(rows[0]?.valor || 0);
      } catch { /* la tabla aún no existe */ }
      if (version >= FIN_SCHEMA_VERSION) return;
      await withTx((tx) => aplicarEsquemaFin(tx));
    })();
    _finReady.catch(() => { _finReady = null; });
  }
  return _finReady;
}
