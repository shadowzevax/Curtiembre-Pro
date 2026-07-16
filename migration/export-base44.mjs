// Exporta TODOS los registros de la app Base44 "Curtiembre" a migration/export/*.json
// (SOLO LECTURA: no modifica nada en Base44)
// Requiere en .env: BASE44_APP_ID y BASE44_API_KEY
// Uso: npm run export:base44
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'export');

const APP_ID = process.env.BASE44_APP_ID;
const API_KEY = process.env.BASE44_API_KEY;
const BASE_URL = `https://app.base44.com/api/apps/${APP_ID}/entities`;
const PAGE = 500;

const entityNames = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'entity-names.json'), 'utf-8')
);

async function fetchPage(entity, skip) {
  const url = `${BASE_URL}/${entity}?limit=${PAGE}&skip=${skip}&sort=created_date`;
  const resp = await fetch(url, { headers: { api_key: API_KEY } });
  if (!resp.ok) {
    throw new Error(`${entity}: HTTP ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data : (data.results || data.entities || []);
}

async function exportEntity(entity) {
  const all = [];
  let skip = 0;
  while (true) {
    const page = await fetchPage(entity, skip);
    all.push(...page);
    if (page.length < PAGE) break;
    skip += PAGE;
  }
  fs.writeFileSync(
    path.join(OUT_DIR, `${entity}.json`),
    JSON.stringify({ entityName: entity, count: all.length, entities: all }, null, 1)
  );
  return all.length;
}

async function main() {
  if (!APP_ID || !API_KEY) {
    console.error('Faltan BASE44_APP_ID o BASE44_API_KEY en .env');
    console.error('La API key se obtiene en Base44: Dashboard de la app → Settings → API Keys');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  const failed = [];
  for (const entity of [...entityNames, 'User']) {
    try {
      const n = await exportEntity(entity);
      total += n;
      console.log(`${entity}: ${n} registros`);
    } catch (e) {
      failed.push(entity);
      console.error(`${entity}: ERROR - ${e.message}`);
    }
  }
  console.log(`\nTotal exportado: ${total} registros en ${OUT_DIR}`);
  if (failed.length) {
    console.log(`Fallaron: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
