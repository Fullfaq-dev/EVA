import { buildMarkup } from './bot-markup.js';

const TG_CAPTION_MAX = 1024;

/** Env override: FUNNEL_IMAGE_ACTIVE_D1_B1_1_S0 or image_url in DB */
export function resolveFunnelImageUrl(msg) {
  if (msg?.image_url) return msg.image_url;
  if (!msg?.funnel_type || msg.day_number == null) return null;
  const block = String(msg.block_id || '0').replace(/\./g, '_');
  const key = `FUNNEL_IMAGE_${String(msg.funnel_type).toUpperCase()}_D${msg.day_number}_B${block}_S${msg.sort_order ?? 0}`;
  return process.env[key] || null;
}

async function tgCall(method, body, token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`[tg] ${method} failed: ${json.description}`);
  }
  return json;
}

/**
 * Send a funnel template: photo+caption if image_url/env is set, else text message.
 * Falls back to sendMessage when caption exceeds Telegram limit or sendPhoto fails.
 */
export async function sendFunnelMessage(chatId, text, msgTemplate, appUrl, token) {
  const markup = buildMarkup(msgTemplate, appUrl);
  const photo = resolveFunnelImageUrl(msgTemplate);

  if (photo && text.length > TG_CAPTION_MAX) {
    await tgCall('sendPhoto', { chat_id: chatId, photo }, token);
    const body = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (markup) body.reply_markup = markup;
    return tgCall('sendMessage', body, token);
  }

  if (photo && text.length <= TG_CAPTION_MAX) {
    const body = { chat_id: chatId, photo, caption: text, parse_mode: 'HTML' };
    if (markup) body.reply_markup = markup;
    const result = await tgCall('sendPhoto', body, token);
    if (result.ok) return result;
  }

  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (markup) body.reply_markup = markup;
  return tgCall('sendMessage', body, token);
}
