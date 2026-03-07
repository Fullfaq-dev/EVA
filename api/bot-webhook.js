/**
 * Vercel Serverless Function — Telegram Bot Webhook
 *
 * Responsibilities:
 *   1. Forward ALL Telegram updates to n8n (AI responses, food analysis, etc.)
 *   2. On /start: enroll user in the 'active' sales funnel and immediately
 *      send the Day 1 Block 1 welcome message without waiting for the cron.
 *
 * Both tasks run in parallel — n8n gets every update without delay.
 *
 * Register once via:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook\
 *     ?url=https://<your-domain>/api/bot-webhook\
 *     &secret_token=<WEBHOOK_SECRET>"
 *
 * Required Vercel Environment Variables:
 *   TELEGRAM_BOT_TOKEN        — from @BotFather
 *   TELEGRAM_APP_URL          — Mini App URL, e.g. https://t.me/your_bot/app
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WEBHOOK_SECRET            — random string set in setWebhook call above
 *   N8N_TELEGRAM_WEBHOOK_URL  — n8n Telegram Trigger production webhook URL
 *                               e.g. https://lavaproject.zeabur.app/webhook/<webhookId>
 */

import { createClient } from '@supabase/supabase-js';

// ─── Telegram Bot API ─────────────────────────────────────────────────────────
async function tgSend(chatId, text, replyMarkup, token) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return res.json();
  } catch (err) {
    console.error('[bot-webhook] tgSend error:', err.message);
    return { ok: false };
  }
}

/** Build Telegram inline_keyboard from a bot_funnel_messages row */
function buildMarkup(msg, appUrl) {
  if (!msg.has_button || !msg.button_text) return undefined;

  // Callback-only actions
  const callbackActions = ['show_meal_plan', 'enable_water_reminders', 'continue'];
  if (callbackActions.includes(msg.button_action)) {
    return { inline_keyboard: [[{ text: msg.button_text, callback_data: msg.button_action }]] };
  }

  const urlMap = {
    open_onboarding: `${appUrl}?startapp=onboarding`,
    open_app: appUrl,
    subscribe: `${appUrl}?startapp=subscribe`,
    restore_access: `${appUrl}?startapp=subscribe`,
  };
  const targetUrl = urlMap[msg.button_action] || appUrl;

  // web_app buttons require a direct HTTPS URL (not t.me links).
  // If the appUrl is a t.me link, fall back to a plain URL button so
  // Telegram doesn't reject it with BUTTON_URL_INVALID.
  const isTgLink = targetUrl.startsWith('https://t.me') || targetUrl.startsWith('http://t.me');
  const buttonObj = isTgLink
    ? { text: msg.button_text, url: targetUrl }
    : { text: msg.button_text, web_app: { url: targetUrl } };

  return { inline_keyboard: [[buttonObj]] };
}

/**
 * Forward the raw Telegram update to n8n's Telegram Trigger webhook.
 * Fire-and-forget style: errors are logged but never block the response.
 */
async function forwardToN8n(update) {
  const n8nUrl = process.env.N8N_TELEGRAM_WEBHOOK_URL;
  if (!n8nUrl) {
    console.warn('[bot-webhook] N8N_TELEGRAM_WEBHOOK_URL not set — skipping forward');
    return;
  }
  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      console.error(`[bot-webhook] n8n forward failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[bot-webhook] n8n forward error:', err.message);
  }
}

/**
 * Handle /start:
 *   1. Upsert a minimal user_profiles row (satisfies FK)
 *   2. Enroll in 'active' funnel (skip if already enrolled)
 *   3. Immediately send all Day 1, Block 1 messages so the user gets
 *      a welcome message right away instead of waiting until 10:00 cron.
 */
async function handleStart(update) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_APP_URL || 'https://t.me/your_bot';

  if (!supabaseUrl || !supabaseKey) {
    console.error('[bot-webhook] Missing Supabase env vars');
    return;
  }
  if (!token) {
    console.error('[bot-webhook] Missing TELEGRAM_BOT_TOKEN');
    return;
  }

  const from = update.message.from;
  const telegramId = String(from.id);
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Upsert minimal profile (FK guard). ignoreDuplicates keeps existing data intact.
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        { telegram_id: telegramId, full_name: fullName },
        { onConflict: 'telegram_id', ignoreDuplicates: true }
      );

    if (profileError) {
      console.error('[bot-webhook] Profile upsert error:', profileError.message);
      return;
    }

    // 2. Check for existing active funnel
    const { data: existing } = await supabase
      .from('user_funnel_state')
      .select('id')
      .eq('user_telegram_id', telegramId)
      .eq('funnel_type', 'active')
      .maybeSingle();

    if (existing) {
      console.log(`[bot-webhook] /start — funnel already exists for ${telegramId}`);
      return;
    }

    // 3. Enroll in 'active' funnel at day 1
    const { data: funnelRow, error: funnelError } = await supabase
      .from('user_funnel_state')
      .insert({
        user_telegram_id: telegramId,
        funnel_type: 'active',
        current_day: 1,
        is_active: true,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (funnelError) {
      console.error('[bot-webhook] Enroll error:', funnelError.message);
      return;
    }
    console.log(`[bot-webhook] ✓ Enrolled ${telegramId} in active funnel`);

    // 4. Fetch Day 1, Block 1 messages (send_time-based, no trigger_event)
    //    and send them immediately — the user gets the welcome right away.
    const { data: messages } = await supabase
      .from('bot_funnel_messages')
      .select('*')
      .eq('funnel_type', 'active')
      .eq('day_number', 1)
      .eq('block_id', '1')
      .is('trigger_event', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!messages?.length) {
      console.warn('[bot-webhook] No Day-1 Block-1 messages found in bot_funnel_messages');
      return;
    }

    for (const msg of messages) {
      const markup = buildMarkup(msg, appUrl);
      const result = await tgSend(telegramId, msg.message_text, markup, token);

      // Log delivery in bot_message_log
      await supabase.from('bot_message_log').insert({
        user_telegram_id: telegramId,
        funnel_message_id: msg.id,
        funnel_type: 'active',
        day_number: 1,
        block_id: msg.block_id,
        delivery_status: result.ok ? 'sent' : 'failed',
        telegram_message_id: result.result?.message_id ?? null,
        error_message: result.ok ? null : result.description,
      });

      if (result.ok) {
        console.log(`[bot-webhook] ✓ Welcome message sent to ${telegramId}`);
      } else {
        console.error(`[bot-webhook] Welcome message failed for ${telegramId}:`, result.description);
      }
    }

    // Update funnel state last_message_sent_at
    await supabase
      .from('user_funnel_state')
      .update({ last_message_sent_at: new Date().toISOString() })
      .eq('id', funnelRow.id);

  } catch (err) {
    console.error('[bot-webhook] handleStart error:', err.message);
  }
}

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Validate Telegram webhook secret token
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body;
  const text = update?.message?.text || '';

  // Run n8n forwarding and /start funnel logic in parallel.
  // forwardToN8n always runs; handleStart only for /start.
  const tasks = [forwardToN8n(update)];
  if (text.startsWith('/start')) {
    tasks.push(handleStart(update));
  }

  await Promise.allSettled(tasks);

  // Always respond 200 — Telegram requires it
  return res.status(200).json({ ok: true });
}
