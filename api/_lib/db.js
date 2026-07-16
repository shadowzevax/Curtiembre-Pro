import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no está configurada');
    _sql = neon(url);
  }
  return _sql;
}

export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS records (
    id text PRIMARY KEY,
    entity text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_date timestamptz NOT NULL DEFAULT now(),
    updated_date timestamptz NOT NULL DEFAULT now(),
    created_by text
  )`,
  `CREATE INDEX IF NOT EXISTS records_entity_created_idx ON records (entity, created_date DESC)`,
  `CREATE INDEX IF NOT EXISTS records_data_gin ON records USING gin (data jsonb_path_ops)`,
  `CREATE TABLE IF NOT EXISTS app_users (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    full_name text,
    role text NOT NULL DEFAULT 'operario',
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    disabled boolean NOT NULL DEFAULT false,
    created_date timestamptz NOT NULL DEFAULT now(),
    updated_date timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_files (
    id text PRIMARY KEY,
    name text,
    mime text,
    size integer,
    content_b64 text NOT NULL,
    created_date timestamptz NOT NULL DEFAULT now(),
    created_by text
  )`,
];

let _ensured = null;

export function ensureSchema() {
  if (!_ensured) {
    const sql = getSql();
    _ensured = (async () => {
      for (const stmt of SCHEMA_SQL) await sql.query(stmt);
    })();
    _ensured.catch(() => { _ensured = null; });
  }
  return _ensured;
}
