import { runHandler } from './_lib/router.js';

// Punto de entrada único de la API en Vercel: /api/* llega aquí.
export default async function handler(req, res) {
  const segments = [].concat(req.query.path || []);
  delete req.query.path;
  await runHandler(req, res, segments);
}
