// Snapshots de la base de datos Neon, usados por scripts/version.mjs para que
// cada versión guardada pueda restaurarse con TODO incluido (código + datos).
//
// No usa pg_dump ni branches de Neon (el plan gratis solo permite 10 branches):
// exporta el contenido íntegro de las tablas de la app (records, app_users, app_files
// y las tablas fin_* del motor financiero) a JSON comprimido con gzip. Los archivos de
// soportes viven en Cloudflare R2: aquí solo quedan sus referencias (fin_soportes).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { withClient } from '../api/_lib/fin/pool.js';
import { FIN_TABLES, aplicarEsquemaFin } from '../api/_lib/fin/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SNAPSHOT_DIR = path.join(ROOT, 'db-snapshots');
const TABLES = ['records', 'app_users', 'app_files', ...FIN_TABLES];

async function tablasExistentes(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1)`, [TABLES]);
  const set = new Set(rows.map((r) => r.table_name));
  return TABLES.filter((t) => set.has(t));
}

export async function volcar(client) {
  const tablas = {};
  for (const t of await tablasExistentes(client)) {
    tablas[t] = (await client.query(`SELECT * FROM ${t} ORDER BY 1`)).rows;
  }
  return tablas;
}

export async function dumpSnapshot(version) {
  const tablas = await withClient(volcar);
  const dump = { version, fecha: new Date().toISOString(), tablas };
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const file = path.join(SNAPSHOT_DIR, `v${version}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(dump)));
  return file;
}

// Restauración ATÓMICA: todo en una transacción. Si algo falla, la base queda exactamente
// como estaba. fin.restauracion='si' es la única vía que permite a los disparadores de
// protección del motor financiero vaciar y recargar sus tablas.
export async function restoreSnapshot(version) {
  const file = path.join(SNAPSHOT_DIR, `v${version}.json.gz`);
  if (!fs.existsSync(file)) throw new Error(`No existe snapshot de datos para v${version} (${file})`);
  const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8'));

  return withClient(async (client) => {
    // Respaldo de seguridad de la base ACTUAL antes de sobreescribir, por si algo sale mal.
    const safety = path.join(SNAPSHOT_DIR, `_pre-restore-${Date.now()}.json.gz`);
    fs.writeFileSync(safety, zlib.gzipSync(JSON.stringify({ version: 'pre-restore', fecha: new Date().toISOString(),
      tablas: await volcar(client) })));

    await client.query('BEGIN');
    try {
      const filas = await aplicarDump(client, dump, `v${version}`);
      await client.query('COMMIT');
      return { restaurado: file, respaldoPrevio: safety, filas };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
}

// Debe llamarse dentro de una transacción abierta.
export async function aplicarDump(client, dump, etiqueta) {
  await client.query(`SET LOCAL fin.restauracion = 'si'`);
  if (Object.keys(dump.tablas).some((t) => t.startsWith('fin_'))) await aplicarEsquemaFin(client);
  const existentes = await tablasExistentes(client);
  // Las tablas que no existían en esa versión quedan vacías (así eran en ese momento).
  await client.query(`TRUNCATE ${existentes.join(', ')}`);
  const filas = {};
  for (const t of existentes) {
    const rows = dump.tablas[t] || [];
    filas[t] = rows.length;
    if (!rows.length) continue;
    // jsonb_populate_recordset convierte cada campo a su tipo real (numeric, date, jsonb…).
    await client.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_recordset(NULL::${t}, $1::jsonb)`, [JSON.stringify(rows)]);
  }
  if (existentes.includes('fin_auditoria')) {
    await client.query(
      `INSERT INTO fin_auditoria (id, usuario, rol, accion, entidad, motivo)
       VALUES (md5(random()::text || clock_timestamp()::text), 'sistema', 'sistema', 'version:restaurar', 'base_de_datos', $1)`,
      [`Datos restaurados desde el snapshot ${etiqueta}`]);
  }
  return filas;
}

export function pruneSnapshots(keep) {
  if (!fs.existsSync(SNAPSHOT_DIR)) return;
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter((f) => /^v\d+(\.\d+)?\.json\.gz$/.test(f))
    .map((f) => ({ f, n: parseFloat(f.slice(1, -8)) }))
    .sort((a, b) => b.n - a.n);
  for (const { f } of files.slice(keep)) {
    fs.unlinkSync(path.join(SNAPSHOT_DIR, f));
  }
}
