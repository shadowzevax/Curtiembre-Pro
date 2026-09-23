// Snapshots de la base de datos Neon, usados por scripts/version.mjs para que
// cada versión guardada pueda restaurarse con TODO incluido (código + datos).
//
// No usa pg_dump ni branches de Neon (el plan gratis solo permite 10 branches):
// exporta el contenido íntegro de las 3 tablas de la app (records, app_users,
// app_files) a JSON y lo comprime con gzip.
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SNAPSHOT_DIR = path.join(ROOT, 'db-snapshots');
const TABLES = ['records', 'app_users', 'app_files'];

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está configurada (revisa .env)');
  return neon(url);
}

export async function dumpSnapshot(version) {
  const db = sql();
  const dump = { version, fecha: new Date().toISOString(), tablas: {} };
  for (const t of TABLES) {
    dump.tablas[t] = await db.query(`SELECT * FROM ${t}`);
  }
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const file = path.join(SNAPSHOT_DIR, `v${version}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(dump)));
  return file;
}

export async function restoreSnapshot(version) {
  const file = path.join(SNAPSHOT_DIR, `v${version}.json.gz`);
  if (!fs.existsSync(file)) throw new Error(`No existe snapshot de datos para v${version} (${file})`);
  const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8'));
  const db = sql();

  // Respaldo de seguridad de la base ACTUAL antes de sobreescribir, por si algo sale mal.
  const safety = path.join(SNAPSHOT_DIR, `_pre-restore-${Date.now()}.json.gz`);
  const actual = { version: 'pre-restore', fecha: new Date().toISOString(), tablas: {} };
  for (const t of TABLES) actual.tablas[t] = await db.query(`SELECT * FROM ${t}`);
  fs.writeFileSync(safety, zlib.gzipSync(JSON.stringify(actual)));

  for (const t of TABLES) {
    const rows = dump.tablas[t] || [];
    await db.query(`TRUNCATE TABLE ${t}`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map((c) => row[c]);
      await db.query(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`, values);
    }
  }
  return { restaurado: file, respaldoPrevio: safety, filas: Object.fromEntries(TABLES.map((t) => [t, (dump.tablas[t] || []).length])) };
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
