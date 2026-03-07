/**
 * Vercel Serverless Function — Telegram Bot Webhook
 *
 * Responsibilities:
 *   1. Forward ALL Telegram updates to n8n (AI responses, food analysis, etc.)
 *   2. On /start: enroll user in the 'active' sales funnel (user_funnel_state row)
 *      so the hourly cron (api/bot-cron.js) can send scheduled funnel messages.
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
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WEBHOOK_SECRET            — random string set in setWebhook call above
 *   N8N_TELEGRAM_WEBHOOK_URL  — n8n Telegram Trigger production webhook URL
 *                               e.g. https://lavaproject.zeabur.app/webhook/<webhookId>
 */

import { createClient } from '@supabase/supabase-js';

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
 * Handle /start: upsert a minimal user_profiles row (satisfies FK constraint),
 * then enroll the user in the 'active' funnel if not already enrolled.
 */
async function handleStart(update) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[bot-webhook] Missing Supabase env vars', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
    });
    return;
  }

  const from = update.message.from;
  const telegramId = String(from.id);
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Ensure a user_profiles row exists (FK required by user_funnel_state).
    //    ignoreDuplicates: true — never overwrites a completed onboarding profile.
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

    // 2. Skip if already enrolled in the active funnel
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
    const { error: funnelError } = await supabase.from('user_funnel_state').insert({
      user_telegram_id: telegramId,
      funnel_type: 'active',
      current_day: 1,
      is_active: true,
      status: 'in_progress',
    });

    if (funnelError) {
      console.error('[bot-webhook] Enroll error:', funnelError.message);
    } else {
      console.log(`[bot-webhook] ✓ Enrolled ${telegramId} in active funnel`);
    }
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
