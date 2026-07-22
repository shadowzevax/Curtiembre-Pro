// Integración mínima con la API de bots de Telegram.
// Sólo responde/notifica al chat_id del dueño (TELEGRAM_CHAT_ID); cualquier
// otro usuario que le escriba al bot es ignorado en silencio.

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
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
      '👋 ¡Hola! Soy el bot de <b>Curtiembre Pro</b>.\n\nTe avisaré automáticamente aquí cada vez que se publique una nueva versión de la app (no en cada sub-fase, solo versiones completas).'
    );
  }
  return { ok: true };
}
