import { Pool, types } from '@neondatabase/serverless';

// date (1082) como texto 'YYYY-MM-DD': convertirlo a Date lo corre de día por la zona horaria.
types.setTypeParser(1082, (v) => v);

// Transacción interactiva: el driver HTTP (neon()) no la soporta. En funciones serverless
// el Pool se crea y se cierra dentro de cada solicitud (documentación oficial de Neon).
export async function withTx(fn, { searchPath } = {}) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está configurada');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    if (searchPath) await client.query(`SET search_path TO ${searchPath}`);
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '25s'");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* conexión ya cerrada */ }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Una conexión suelta (sin transacción) para scripts que controlan sus propias transacciones.
export async function withClient(fn, { searchPath } = {}) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    if (searchPath) await client.query(`SET search_path TO ${searchPath}`);
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}
