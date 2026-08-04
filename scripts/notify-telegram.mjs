// Avisa por Telegram cuando se publica una versión completa (vN), nunca en
// sub-fases (vN.1, vN.2...). Se ejecuta como "postbuild" — pero solo hace algo
// cuando corre dentro de un deploy de PRODUCCIÓN en Vercel (VERCEL_ENV), así que
// un `npm run build` local nunca envía nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  if (process.env.VERCEL_ENV !== 'production') return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const versionFile = path.join(ROOT, 'src', 'version.json');
  if (!fs.existsSync(versionFile)) return;
  const { version, descripcion, advertencias } = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));

  // Solo versiones enteras (vN); las sub-fases (vN.1, vN.2...) no notifican.
  if (String(version).includes('.')) return;

  // La descripción/advertencias se escriben como puntos separados por "|"
  // (uno por módulo/tema); si no traen "|" se muestran como un único punto.
  const aBullets = (texto) => (texto || '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `• ${p}`)
    .join('\n\n');

  const bloqueCambios = aBullets(descripcion);
  const bloqueAdvertencias = aBullets(advertencias);

  let texto = `🚀 <b>Curtiembre Pro v${version}</b> publicada\n\n`;
  texto += `📋 <b>Cambios en esta versión:</b>\n${bloqueCambios || '—'}\n`;
  if (bloqueAdvertencias) {
    texto += `\n⚠️ <b>Recomendaciones / advertencias del ingeniero:</b>\n${bloqueAdvertencias}\n`;
  }
  texto += `\nhttps://curtiembre-pro.vercel.app`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('No se pudo notificar por Telegram:', e.message);
  }
}

await main();
