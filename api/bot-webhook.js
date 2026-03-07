/**
 * Vercel Serverless Function — Telegram Bot Webhook (minimal)
 *
 * Only responsibility: when a user sends /start, enroll them in the
 * 'active' sales funnel (creates a user_funnel_state row).
 * The hourly cron (api/bot-cron.js) then takes over and sends all
 * scheduled funnel messages automatically.
 *
 * All other bot logic (AI responses, food analysis, etc.) lives in n8n.
 *
 * Register once via:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook\
 *     ?url=https://<your-domain>/api/bot-webhook\
 *     &secret_token=<WEBHOOK_SECRET>"
 *
 * Required Vercel Environment Variables:
 *   TELEGRAM_BOT_TOKEN        — from @BotFather
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WEBHOOK_SECRET            — random string set in setWebhook call above
 */

import { createClient } from '@supabase/supabase-js';

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

  // Always respond 200 immediately — Telegram requires a fast response
  res.status(200).json({ ok: true });

  const update = req.body;

  // Only care about /start messages
  const text = update?.message?.text || '';
  if (!text.startsWith('/start')) return;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[bot-webhook] Missing Supabase env vars');
    return;
  }

  const telegramId = String(update.message.from.id);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if this user already has an active funnel state
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

    // Enroll in 'active' funnel at day 1
    const { error } = await supabase.from('user_funnel_state').insert({
      user_telegram_id: telegramId,
      funnel_type: 'active',
      current_day: 1,
      is_active: true,
      status: 'in_progress',
    });

    if (error) {
      console.error('[bot-webhook] Enroll error:', error.message);
    } else {
      console.log(`[bot-webhook] ✓ Enrolled ${telegramId} in active funnel`);
    }
  } catch (err) {
    console.error('[bot-webhook] Error:', err.message);
  }
}
