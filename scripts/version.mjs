// Sistema de versiones de Curtiembre ERP.
//
//   node scripts/version.mjs guardar "descripcion del cambio"
//     → crea la versión entera siguiente (v2, v3...). Úsalo para cambios
//       independientes y ya terminados.
//
//   node scripts/version.mjs fase "descripcion de esta fase"
//     → crea una sub-versión (v3.1, v3.2...) dentro del mismo requerimiento,
//       cuando un cambio grande se libera por fases para reducir riesgo.
//       La primera fase de un requerimiento pasa de vN a vN.1; cada fase
//       siguiente incrementa el decimal. Cuando todo el requerimiento queda
//       completo, la fase final se cierra con "guardar" (pasa a vN+1 entero).
//
//   node scripts/version.mjs listar
//     → muestra las últimas 5 versiones guardadas.
//
//   node scripts/version.mjs restaurar [numero]
//     → deja TODA la página exactamente como estaba en esa versión y la
//       publica. Si no se pasa número, pregunta de forma interactiva.
//
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILE = path.join(ROOT, 'src', 'version.json');
const KEEP = 5;

function git(cmd, opts = {}) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function listVersionTags() {
  const out = git('tag --list "v*" --sort=-creatordate');
  return out ? out.split('\n').filter((t) => /^v\d+(\.\d+)?$/.test(t)) : [];
}

function tagInfo(tag) {
  const fecha = git(`log -1 --format=%ad --date=format:"%Y-%m-%d %H:%M" ${tag}`);
  const msg = git(`tag -l --format="%(contents:subject)" ${tag}`) || git(`log -1 --format=%s ${tag}`);
  return { tag, fecha, msg };
}

function readVersion() {
  return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));
}

function writeVersion(v, descripcion) {
  const fecha = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(VERSION_FILE, JSON.stringify({ version: v, fecha, descripcion }, null, 2) + '\n');
}

function pruneOldTags(tags) {
  for (const old of tags.slice(KEEP)) {
    try {
      git(`tag -d ${old}`);
      git(`push origin :refs/tags/${old}`);
      console.log(`  (se eliminó la versión antigua ${old})`);
    } catch { /* sin conexión o ya borrada */ }
  }
}

function publicar(nueva, desc) {
  writeVersion(nueva, desc);
  git('add -A');
  const hayCambios = git('status --porcelain');
  if (!hayCambios) {
    console.log('No hay cambios para guardar.');
    return false;
  }
  git(`commit -m "v${nueva}: ${desc.replace(/"/g, "'")}"`);
  git(`tag -a v${nueva} -m "${desc.replace(/"/g, "'")}"`);
  git('push origin main --follow-tags');
  console.log(`\n✅ Versión v${nueva} guardada y publicándose en https://curtiembre-pro.vercel.app`);
  console.log('   (el deploy tarda ~1 minuto)');
  pruneOldTags(listVersionTags());
  return true;
}

// vN → vN+1 (cambio independiente y terminado)
function guardar(descripcion) {
  const actual = String(readVersion().version);
  const enteroActual = Math.trunc(parseFloat(actual));
  const nueva = String(enteroActual + 1);
  publicar(nueva, descripcion || `Version ${nueva}`);
}

// vN → vN.1, vN.1 → vN.2... (fase dentro del mismo requerimiento grande)
function fase(descripcion) {
  const actual = String(readVersion().version);
  const [enteroStr, decStr] = actual.split('.');
  const entero = parseInt(enteroStr, 10);
  const siguienteDecimal = (decStr ? parseInt(decStr, 10) : 0) + 1;
  const nueva = `${entero}.${siguienteDecimal}`;
  publicar(nueva, descripcion || `Fase ${nueva}`);
}

function listar() {
  const tags = listVersionTags().slice(0, KEEP);
  if (!tags.length) {
    console.log('Aún no hay versiones guardadas.');
    return [];
  }
  const actual = String(readVersion().version);
  console.log('\nVersiones disponibles (más reciente primero):\n');
  tags.forEach((t, i) => {
    const { fecha, msg } = tagInfo(t);
    const marca = t === `v${actual}` ? '  ← ACTUAL' : '';
    console.log(`  ${i + 1}) ${t}  ${fecha}  ${msg}${marca}`);
  });
  console.log('');
  return tags;
}

async function restaurar(arg) {
  const tags = listar();
  if (!tags.length) return;

  let objetivo = arg;
  if (!objetivo) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    objetivo = await new Promise((res) => rl.question('¿Qué versión quieres restaurar? (número de la lista o vN): ', (a) => { rl.close(); res(a.trim()); }));
  }
  let tag = null;
  if (/^\d+$/.test(objetivo) && Number(objetivo) >= 1 && Number(objetivo) <= tags.length) {
    tag = tags[Number(objetivo) - 1];
  } else if (tags.includes(objetivo)) {
    tag = objetivo;
  } else if (tags.includes(`v${objetivo}`)) {
    tag = `v${objetivo}`;
  }
  if (!tag) {
    console.log(`No se encontró la versión "${objetivo}".`);
    process.exit(1);
  }

  const actual = String(readVersion().version);
  if (tag === `v${actual}`) {
    console.log(`La página ya está en la versión ${tag}.`);
    return;
  }

  console.log(`\nRestaurando todo el proyecto al estado de ${tag}...`);
  // Trae el contenido exacto de esa versión sin borrar el historial
  git(`checkout ${tag} -- .`);
  git('clean -fd -e node_modules -e .env -e migration/export -e .playwright-mcp');

  // La restauración se guarda como una versión NUEVA (así siempre se puede volver)
  const enteroActual = Math.trunc(parseFloat(actual));
  const nueva = String(enteroActual + 1);
  const ok = publicar(nueva, `Restauración de ${tag}`);
  if (ok) {
    console.log(`\n✅ Listo: la página quedó como en ${tag} (guardado como versión v${nueva}).`);
  }
}

const [, , comando, ...resto] = process.argv;
if (comando === 'guardar') guardar(resto.join(' '));
else if (comando === 'fase') fase(resto.join(' '));
else if (comando === 'listar') listar();
else if (comando === 'restaurar') await restaurar(resto[0]);
else {
  console.log('Uso: node scripts/version.mjs [guardar "descripcion" | fase "descripcion" | listar | restaurar [N]]');
}
