// Asistente de desarrollo vía Telegram: responde preguntas sobre EL CÓDIGO del
// propio repo (de dónde salen los datos de tal botón, sugerencias de mejora, etc).
// Es de SOLO LECTURA: nunca escribe, nunca modifica nada del repo ni de la app.
// Fuente de contexto: GitHub Code Search sobre el repo público (sin necesitar
// tener el código descargado en el servidor). Respuesta: modelo gratuito de
// OpenRouter, con lista de modelos de respaldo si el primero está saturado.

const REPO = 'shadowzevax/Curtiembre-Pro';
const BRANCH = 'main';

// Modelos gratuitos de OpenRouter, en orden de preferencia. Si uno falla
// (saturado / error), se intenta el siguiente automáticamente.
const MODELOS_GRATIS = [
  'deepseek/deepseek-chat-v3.1:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
];

async function buscarArchivosRelevantes(pregunta) {
  const terminos = pregunta
    .replace(/[¿?¡!.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join(' ');
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(terminos)}+repo:${REPO}`;
  const headers = { 'User-Agent': 'curtiembre-dev-bot', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).slice(0, 4).map((it) => it.path);
  } catch {
    return [];
  }
}

async function leerArchivo(path) {
  try {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const texto = await res.text();
    return texto.length > 6000 ? texto.slice(0, 6000) + '\n... (truncado)' : texto;
  } catch {
    return null;
  }
}

async function preguntarOpenRouter(mensajes) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return '⚠️ Falta configurar OPENROUTER_API_KEY.';

  for (const modelo of MODELOS_GRATIS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://curtiembre-pro.vercel.app',
          'X-Title': 'Curtiembre Pro - Dev Assistant',
        },
        body: JSON.stringify({ model: modelo, messages: mensajes, max_tokens: 900 }),
      });
      if (!res.ok) continue; // modelo saturado o con error: probar el siguiente
      const data = await res.json();
      const texto = data?.choices?.[0]?.message?.content;
      if (texto) return texto;
    } catch {
      continue;
    }
  }
  return '⚠️ Todos los modelos gratuitos están saturados en este momento. Intenta de nuevo en unos minutos.';
}

export async function responderPreguntaDesarrollo(pregunta) {
  const paths = await buscarArchivosRelevantes(pregunta);
  const archivos = (await Promise.all(paths.map(async (p) => ({ path: p, contenido: await leerArchivo(p) }))))
    .filter((a) => a.contenido);

  const contexto = archivos.length
    ? archivos.map((a) => `--- ${a.path} ---\n${a.contenido}`).join('\n\n')
    : '(No se encontraron archivos relacionados con esta pregunta en el repositorio.)';

  const mensajes = [
    {
      role: 'system',
      content:
        'Eres un asistente de desarrollo de SOLO LECTURA para el repositorio "Curtiembre Pro", un ERP de curtiembre (React + Vite + Postgres/Neon + Vercel serverless). ' +
        'Respondes en español, de forma clara y concreta, citando archivo y función/línea cuando sea relevante. ' +
        'Puedes explicar de dónde salen los datos de una pantalla/botón, sugerir mejoras de desarrollo, señalar riesgos o cosas por completar. ' +
        'NUNCA generas instrucciones para modificar, borrar o desplegar nada — solo explicas y sugieres. ' +
        'Si el contexto de código que te dan no alcanza para responder con certeza, dilo explícitamente en vez de inventar.',
    },
    { role: 'user', content: `Contexto de archivos del repo relacionados con la pregunta:\n\n${contexto}\n\nPregunta: ${pregunta}` },
  ];

  return preguntarOpenRouter(mensajes);
}
