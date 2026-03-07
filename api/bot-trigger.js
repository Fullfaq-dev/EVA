/**
 * Vercel Serverless Function — Internal Bot Trigger Endpoint
 *
 * Called by the Mini App (or robokassa-result.js) to instantly fire
 * a named trigger_event for a specific user.
 *
 * POST /api/bot-trigger
 * Headers:
 *   Authorization: Bearer <BOT_TRIGGER_SECRET>
 * Body (JSON):
 *   {
 *     "telegram_id": "123456789",
 *     "event": "onboarding_completed",   // any trigger_event value from bot_funnel_messages
 *     "data": {}                         // optional — future use for dynamic placeholders
 *   }
 *
 * Known events (map to trigger_event column in bot_funnel_messages):
 *   onboarding_completed    — after user finishes the onboarding questionnaire
 *   trial_started           — immediately after onboarding (auto-fired together with above)
 *   subscription_paid       — after first successful Robokassa payment
 *   subscription_renewed    — after each subsequent successful Robokassa payment
 *   subscription_expired    — when subscription_end_date passes (called by cron or webhook)
 *
 * Example call from src/api/functions.js after onboarding update:
 *   await fetch('/api/bot-trigger', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       Authorization: `Bearer ${import.meta.env.VITE_BOT_TRIGGER_SECRET}`,
 *     },
 *     body: JSON.stringify({ telegram_id: profile.telegram_id, event: 'onboarding_completed' }),
 *   });
 *
 * Required Vercel Environment Variables:
 *   TELEGRAM_BOT_TOKEN        — from @BotFather
 *   TELEGRAM_APP_URL          — your Mini App URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BOT_TRIGGER_SECRET        — random shared secret (also set as VITE_BOT_TRIGGER_SECRET in Vercel)
 */

import { createClient } from '@supabase/supabase-js';

// ─── Telegram API ─────────────────────────────────────────────────────────────
async function tgCall(method, body, token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function buildMarkup(msg, appUrl) {
  if (!msg.has_button || !msg.button_text) return undefined;

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

  return {
    inline_keyboard: [[{ text: msg.button_text, web_app: { url: urlMap[msg.button_action] || appUrl } }]],
  };
}

// ─── Placeholder fill ─────────────────────────────────────────────────────────
function formatGoal(goal) {
  return (
    { weight_loss: 'Снижение веса', muscle_gain: 'Набор мышечной массы', maintenance: 'Поддержание веса', gut_health: 'Здоровье кишечника' }[goal] || '—'
  );
}

function fillPlaceholders(text, user) {
  const name = (user?.full_name || 'Вы').split(' ')[0];
  const waterL = ((user?.water_norm || 2000) / 1000).toFixed(1);
  const kbju = user
    ? `${user.daily_calories || '?'} ккал (Б:${user.daily_protein || '?'}г / Ж:${user.daily_fat || '?'}г / У:${user.daily_carbs || '?'}г)`
    : 'рассчитаем после анкеты';

  return text
    .replace(/\{name\}/g, name)
    .replace(/\{goal\}/g, formatGoal(user?.goal))
    .replace(/\{water_norm\}/g, waterL)
    .replace(/\{kbju_norm\}/g, kbju)
    .replace(/\{favorite_food\}/g, 'полезные блюда')
    .replace(/\{avg_calories\}/g, '—')
    .replace(/\{avg_protein\}/g, '—')
    .replace(/\{avg_fat\}/g, '—')
    .replace(/\{avg_carbs\}/g, '—')
    .replace(/\{avg_water\}/g, '—')
    .replace(/\{personalized_insight\}/g, 'Продолжайте вносить приёмы пищи — анализ уже скоро!')
    .replace(/\{protein_insight\}/g, 'Отслеживайте белок — это ключ к Вашей цели')
    .replace(/\{calorie_pattern\}/g, 'Данные накапливаются')
    .replace(/\{main_insight\}/g, 'Продолжайте в том же темпе')
    .replace(/\{risk_insight\}/g, 'Явных рисков не выявлено')
    .replace(/\{protein_delta\}/g, '0')
    .replace(/\{water_days\}/g, '0')
    .replace(/\{goal_progress\}/g, '0')
    .replace(/\{sample_breakfast\}/g, 'Овсяноблин с творогом и ягодами')
    .replace(/\{sample_lunch\}/g, 'Куриная грудка с гречкой и овощами')
    .replace(/\{sample_snack\}/g, 'Яблоко + 10 орехов миндаля')
    .replace(/\{sample_dinner\}/g, 'Запечённая рыба с киноа и фасолью');
}

// ─── Funnel state helpers ─────────────────────────────────────────────────────
async function getActiveFunnelState(telegramId, supabase) {
  const { data } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('user_telegram_id', telegramId)
    .eq('is_active', true)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function enrollPaidFunnel(telegramId, supabase) {
  // Close out any active/sleeping funnels as converted
  await supabase
    .from('user_funnel_state')
    .update({ status: 'converted', is_active: false, updated_at: new Date().toISOString() })
    .eq('user_telegram_id', telegramId)
    .in('funnel_type', ['active', 'sleeping'])
    .eq('is_active', true);

  // Upsert paid funnel state
  const { data } = await supabase
    .from('user_funnel_state')
    .upsert(
      {
        user_telegram_id: telegramId,
        funnel_type: 'paid',
        current_day: 1,
        is_active: true,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      },
      { onConflict: 'user_telegram_id,funnel_type' }
    )
    .select()
    .single();
  return data;
}

// ─── Core: fire event messages ────────────────────────────────────────────────
async function fireEvent(telegramId, eventName, supabase, token, appUrl) {
  const state = await getActiveFunnelState(telegramId, supabase);

  // For subscription events we don't filter by funnel_type
  const subscriptionEvents = ['subscription_paid', 'subscription_renewed', 'subscription_expired'];
  const isSubscriptionEvent = subscriptionEvents.includes(eventName);

  let query = supabase
    .from('bot_funnel_messages')
    .select('*')
    .eq('trigger_event', eventName)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Filter by funnel_type only for non-subscription events
  if (!isSubscriptionEvent && state) {
    query = query.eq('funnel_type', state.funnel_type);
  }

  const { data: messages, error } = await query;

  if (error) throw error;
  if (!messages?.length) {
    console.log(`[trigger] No messages for event: ${eventName}`);
    return 0;
  }

  // Get user profile
  const { data: user } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;

  for (const msg of messages) {
    // Dedup: skip if this specific message was already sent today
    const { count } = await supabase
      .from('bot_message_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_telegram_id', telegramId)
      .eq('funnel_message_id', msg.id)
      .gte('sent_at', today)
      .in('delivery_status', ['sent', 'skipped']);

    if (count > 0) continue;

    const text = fillPlaceholders(msg.message_text, user);
    const params = { chat_id: telegramId, text, parse_mode: 'HTML' };
    const markup = buildMarkup(msg, appUrl);
    if (markup) params.reply_markup = markup;

    const result = await tgCall('sendMessage', params, token);

    await supabase.from('bot_message_log').insert({
      user_telegram_id: telegramId,
      funnel_message_id: msg.id,
      funnel_type: state?.funnel_type || msg.funnel_type,
      day_number: msg.day_number,
      block_id: msg.block_id,
      delivery_status: result.ok ? 'sent' : 'failed',
      telegram_message_id: result.result?.message_id ?? null,
      error_message: result.ok ? null : result.description,
    });

    if (result.ok) {
      sent++;
      console.log(`[trigger] ✓ ${eventName} block${msg.block_id} → ${telegramId}`);
    }

    await new Promise((r) => setTimeout(r, 60));
  }

  // Update last_message_sent_at
  if (sent > 0 && state) {
    await supabase
      .from('user_funnel_state')
      .update({ last_message_sent_at: new Date().toISOString() })
      .eq('id', state.id);
  }

  return sent;
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Auth: shared secret known to both Mini App and server
  const triggerSecret = process.env.BOT_TRIGGER_SECRET;
  const authHeader = req.headers.authorization || '';
  if (triggerSecret && authHeader !== `Bearer ${triggerSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.TELEGRAM_APP_URL || 'https://t.me/your_bot';

  if (!token || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const { telegram_id, event } = req.body || {};

  if (!telegram_id || !event) {
    return res.status(400).json({ error: 'telegram_id and event are required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const telegramId = String(telegram_id);

    // Special lifecycle handling for subscription events
    if (event === 'subscription_paid' || event === 'subscription_renewed') {
      await enrollPaidFunnel(telegramId, supabase);
    }

    const sent = await fireEvent(telegramId, event, supabase, token, appUrl);

    // For onboarding_completed: also fire trial_started right after
    if (event === 'onboarding_completed') {
      await new Promise((r) => setTimeout(r, 1000));
      await fireEvent(telegramId, 'trial_started', supabase, token, appUrl);
    }

    return res.status(200).json({ ok: true, sent, event, telegram_id: telegramId });
  } catch (err) {
    console.error('[bot-trigger] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
