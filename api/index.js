import { runHandler } from './_lib/router.js';

// El asistente de desarrollo (Telegram) llama a GitHub + OpenRouter, lo que
// puede tardar más que una consulta normal a la API.
export const config = { maxDuration: 30 };

// Punto de entrada único de la API en Vercel.
// vercel.json reescribe /api/* hacia esta función; el path real viene en req.url
// o en el query param __path que agrega el rewrite.
export default async function handler(req, res) {
  let pathname = '';
  const q = req.query || {};
  if (q.__path) {
    pathname = Array.isArray(q.__path) ? q.__path.join('/') : String(q.__path);
    delete req.query.__path;
  } else {
    const url = new URL(req.url, 'http://localhost');
    pathname = url.pathname.replace(/^\/api\/?/, '');
  }
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  await runHandler(req, res, segments);
}
