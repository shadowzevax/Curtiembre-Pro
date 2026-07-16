// Crea las tablas en Neon y el primer usuario administrador.
// Uso: npm run db:init -- admin@email.com contraseña "Nombre Completo"
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { SCHEMA_SQL } from '../api/_lib/db.js';

const [email, password, fullName] = process.argv.slice(2);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  console.log('Creando tablas...');
  for (const stmt of SCHEMA_SQL) await sql.query(stmt);
  console.log('Tablas listas.');

  if (email && password) {
    const id = crypto.randomBytes(12).toString('hex');
    const hash = bcrypt.hashSync(password, 10);
    await sql.query(
      `INSERT INTO app_users (id, email, password_hash, full_name, role)
       VALUES ($1, lower($2), $3, $4, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'admin', updated_date = now()`,
      [id, email.trim(), hash, fullName || email.split('@')[0]]
    );
    console.log(`Usuario admin listo: ${email}`);
  } else {
    console.log('(No se creó admin: pasa email y contraseña como argumentos si lo necesitas)');
  }

  const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM app_users');
  console.log(`Usuarios en la base: ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
