// Importa los JSON de migration/export/ a la base de datos Neon.
// Conserva ids, fechas y created_by originales de Base44.
// Uso: npm run import:neon            (agrega/actualiza registros)
//      npm run import:neon -- --wipe  (borra los registros existentes primero)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from '../api/_lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, 'export');
const WIPE = process.argv.includes('--wipe');
// Contraseña temporal para los usuarios importados de Base44 (deben cambiarla)
const DEFAULT_PASSWORD = process.env.IMPORT_USER_PASSWORD || 'Cambiar123';

const SKIP_FILES = new Set(['schemas.json']);

function readExport(file) {
  const data = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, file), 'utf-8'));
  return Array.isArray(data) ? data : (data.entities || []);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  for (const stmt of SCHEMA_SQL) await sql.query(stmt);

  if (WIPE) {
    console.log('Borrando registros existentes...');
    await sql.query('DELETE FROM records');
  }

  const files = fs.readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith('.json') && !SKIP_FILES.has(f));

  let total = 0;
  for (const file of files) {
    const entity = path.basename(file, '.json');
    const rows = readExport(file);

    if (entity === 'User') {
      for (const u of rows) {
        if (!u.email) continue;
        await sql.query(
          `INSERT INTO app_users (id, email, password_hash, full_name, role, data, created_date, updated_date)
           VALUES ($1, lower($2), $3, $4, $5, $6::jsonb, $7, $8)
           ON CONFLICT (email) DO UPDATE SET
             full_name = EXCLUDED.full_name, role = EXCLUDED.role,
             data = app_users.data || EXCLUDED.data, updated_date = now()`,
          [
            u.id, u.email, bcrypt.hashSync(DEFAULT_PASSWORD, 10),
            u.full_name || '', u.role === 'admin' ? 'admin' : (u.role || 'operario'),
            JSON.stringify({ pinned_shortcuts: u.pinned_shortcuts || [] }),
            u.created_date || new Date().toISOString(),
            u.updated_date || new Date().toISOString(),
          ]
        );
      }
      console.log(`User: ${rows.length} usuarios (contraseña temporal: ${DEFAULT_PASSWORD})`);
      continue;
    }

    for (const r of rows) {
      const { id, created_date, updated_date, created_by, created_by_id, is_sample, app_id, ...data } = r;
      await sql.query(
        `INSERT INTO records (id, entity, data, created_date, updated_date, created_by)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data, updated_date = EXCLUDED.updated_date`,
        [
          id, entity, JSON.stringify(data),
          created_date || new Date().toISOString(),
          updated_date || new Date().toISOString(),
          created_by || null,
        ]
      );
    }
    total += rows.length;
    console.log(`${entity}: ${rows.length} registros`);
  }
  console.log(`\nImportación completa: ${total} registros + usuarios.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
