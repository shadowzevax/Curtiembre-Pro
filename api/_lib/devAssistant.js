// Asistente de desarrollo vía Telegram: responde preguntas sobre EL CÓDIGO del
// propio repo (de dónde salen los datos de tal botón, sugerencias de mejora, etc).
// Es de SOLO LECTURA: nunca escribe, nunca modifica nada del repo ni de la app.
// Fuente de contexto: GitHub Code Search sobre el repo público (sin necesitar
// tener el código descargado en el servidor). Respuesta: Groq (gratis, sin
// tarjeta), con un segundo modelo de Groq como respaldo si el primero falla.
// El contexto y el límite de tokens de salida se mantienen bajos a propósito
// para no gastar cuota de más en cada pregunta.

const REPO = 'shadowzevax/Curtiembre-Pro';
const BRANCH = 'main';
const MAX_ARCHIVOS = 3;
const MAX_CHARS_POR_ARCHIVO = 3500;
const MAX_TOKENS_RESPUESTA = 500;

// Modelos gratuitos de Groq, en orden de preferencia.
const MODELOS_GROQ = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

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
    return (data.items || []).slice(0, MAX_ARCHIVOS).map((it) => it.path);
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
    return texto.length > MAX_CHARS_POR_ARCHIVO ? texto.slice(0, MAX_CHARS_POR_ARCHIVO) + '\n... (truncado)' : texto;
  } catch {
    return null;
  }
}

async function preguntarGroq(mensajes) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return '⚠️ Falta configurar GROQ_API_KEY.';

  for (const modelo of MODELOS_GROQ) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, messages: mensajes, max_tokens: MAX_TOKENS_RESPUESTA }),
      });
      if (!res.ok) continue; // modelo saturado o con error: probar el siguiente
      const data = await res.json();
      const texto = data?.choices?.[0]?.message?.content;
      if (texto) return texto;
    } catch {
      continue;
    }
  }
  return '⚠️ Los modelos gratuitos están saturados en este momento. Intenta de nuevo en unos minutos.';
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
        'Respondes en español, breve y concreto (máximo un par de párrafos), citando archivo y función/línea cuando sea relevante. ' +
        'Puedes explicar de dónde salen los datos de una pantalla/botón, sugerir mejoras de desarrollo, señalar riesgos o cosas por completar. ' +
        'NUNCA generas instrucciones para modificar, borrar o desplegar nada — solo explicas y sugieres. ' +
        'Si el contexto de código que te dan no alcanza para responder con certeza, dilo explícitamente en vez de inventar.',
    },
    { role: 'user', content: `Contexto de archivos del repo relacionados con la pregunta:\n\n${contexto}\n\nPregunta: ${pregunta}` },
  ];

  return preguntarGroq(mensajes);
}
