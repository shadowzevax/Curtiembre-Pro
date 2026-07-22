// Integración mínima con la API de bots de Telegram.
// Sólo responde/notifica al chat_id del dueño (TELEGRAM_CHAT_ID); cualquier
// otro usuario que le escriba al bot es ignorado en silencio.

const TELEGRAM_LIMIT = 4000;

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Telegram rechaza mensajes de más de 4096 caracteres: se parte en trozos.
  const trozos = [];
  let restante = text;
  while (restante.length > 0) {
    trozos.push(restante.slice(0, TELEGRAM_LIMIT));
    restante = restante.slice(TELEGRAM_LIMIT);
  }

  for (const trozo of trozos) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: trozo, parse_mode: 'HTML' }),
    });
  }
}

export async function handleTelegramWebhook(update) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const msg = update?.message;
  const incomingChatId = msg?.chat?.id != null ? String(msg.chat.id) : null;

  // Solo se responde al dueño configurado; cualquier otro remitente es ignorado.
  if (!msg || !chatId || incomingChatId !== String(chatId)) {
    return { ok: true };
  }

  const text = (msg.text || '').trim();

  if (text === '/start') {
    await sendTelegramMessage(
      '👋 ¡Hola! Soy el bot de <b>Curtiembre Pro</b>.\n\n' +
      '• Te aviso automáticamente aquí cada vez que se publique una versión nueva de la app (no en cada sub-fase).\n' +
      '• Escríbeme cualquier pregunta sobre el desarrollo de la página (de dónde salen los datos de tal pantalla, sugerencias, qué falta) y te respondo leyendo el código del repositorio. Solo leo, nunca modifico nada.'
    );
    return { ok: true };
  }

  if (text === '/ayuda' || text === '/help') {
    await sendTelegramMessage(
      '📋 Comandos:\n/start — mensaje de bienvenida\n/ayuda — esta ayuda\n\nCualquier otro mensaje se interpreta como una pregunta sobre el desarrollo de la app.'
    );
    return { ok: true };
  }

  if (text.startsWith('/')) {
    await sendTelegramMessage('No reconozco ese comando. Escribe /ayuda para ver las opciones.');
    return { ok: true };
  }

  if (text) {
    const { responderPreguntaDesarrollo } = await import('./devAssistant.js');
    const respuesta = await responderPreguntaDesarrollo(text);
    await sendTelegramMessage(respuesta);
  }

  return { ok: true };
}
