// Servidor de desarrollo local para la API (imita las funciones de Vercel).
// Uso: node server/dev-server.mjs  (vite hace proxy de /api hacia aquí)
import 'dotenv/config';
import http from 'node:http';
import { runHandler } from '../api/_lib/router.js';

const PORT = process.env.API_PORT || 3001;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith('/api/')) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const segments = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
    .map(decodeURIComponent);

  // req.query como en Vercel
  req.query = Object.fromEntries(url.searchParams.entries());

  // req.body como en Vercel (JSON)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length) {
    const raw = Buffer.concat(chunks).toString('utf-8');
    try { req.body = JSON.parse(raw); } catch { req.body = raw; }
  }

  await runHandler(req, res, segments);
});

server.listen(PORT, () => {
  console.log(`API de desarrollo escuchando en http://localhost:${PORT}/api`);
});
