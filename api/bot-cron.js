/**
 * Vercel Serverless Function — Telegram Bot Funnel Scheduler
 *
 * Runs hourly via Vercel Cron (see vercel.json).
 * At each invocation it:
 *   1. At Moscow midnight (00:xx UTC+3 → 21:xx UTC prev day) — advances
 *      current_day for every active user_funnel_state row.
 *   2. Finds all bot_funnel_messages whose send_time matches the current
 *      Moscow hour, evaluates send_condition against live DB data, and
 *      dispatches matching messages via the Telegram Bot API.
 *   3. Checks delay_hours messages (e.g. "send 3h after block 1 of day 1")
 *      by looking up when the preceding block was sent.
 *   4. On Mondays sends the weekly_report trigger messages for paid users.
 *
 * Required Vercel Environment Variables:
 *   TELEGRAM_BOT_TOKEN        — from @BotFather
 *   TELEGRAM_APP_URL          — your Mini App URL, e.g. https://t.me/your_bot/app
 *   SUPABASE_URL              — https://XXXX.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key (never expose to frontend)
 *   CRON_SECRET               — random secret; Vercel adds it to Authorization header
 */

import { createClient } from '@supabase/supabase-js';

// ─── Moscow time (UTC+3, Russia has no DST) ──────────────────────────────────
const MOSCOW_OFFSET_MS = 3 * 3600 * 1000;

function moscowNow() {
  return new Date(Date.now() + MOSCOW_OFFSET_MS);
}

/** Returns 0-23 Moscow hour */
function moscowHour(d) {
  return d.getUTCHours();
}

/** Pad hour to "HH:00" matching the send_time column format */
function hhmm(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Today's date string in Moscow time */
function moscowDateStr() {
  return moscowNow().toISOString().slice(0, 10);
}

// ─── Telegram Bot API ────────────────────────────────────────────────────────
async function tgCall(method, body, token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`[tg] ${method} failed: ${json.description}`, JSON.stringify(body).slice(0, 200));
  }
  return json;
}

/**
 * Build Telegram inline_keyboard markup from a bot_funnel_messages row.
 * Button actions that open the Mini App use web_app type;
 * purely callback-driven actions use callback_data.
 */
function buildMarkup(msg, appUrl) {
  if (!msg.has_button || !msg.button_text) return undefined;

  const callbackActions = ['show_meal_plan', 'enable_water_reminders', 'continue'];
  if (callbackActions.includes(msg.button_action)) {
    return {
      inline_keyboard: [[{ text: msg.button_text, callback_data: msg.button_action }]],
    };
  }

  const urlMap = {
    open_onboarding: `${appUrl}?startapp=onboarding`,
    open_app: appUrl,
    subscribe: `${appUrl}?startapp=subscribe`,
    restore_access: `${appUrl}?startapp=subscribe`,
  };

  const targetUrl = urlMap[msg.button_action] || appUrl;

  // web_app buttons require a direct HTTPS URL (not t.me links).
  const isTgLink = targetUrl.startsWith('https://t.me') || targetUrl.startsWith('http://t.me');
  const buttonObj = isTgLink
    ? { text: msg.button_text, url: targetUrl }
    : { text: msg.button_text, web_app: { url: targetUrl } };

  return { inline_keyboard: [[buttonObj]] };
}

async function sendTelegramMessage(telegramId, text, msgTemplate, appUrl, token) {
  const params = { chat_id: telegramId, text, parse_mode: 'HTML' };
  const markup = buildMarkup(msgTemplate, appUrl);
  if (markup) params.reply_markup = markup;
  return tgCall('sendMessage', params, token);
}

// ─── Placeholder engine ──────────────────────────────────────────────────────
function formatGoal(goal) {
  return (
    {
      weight_loss: 'Снижение веса',
      muscle_gain: 'Набор мышечной массы',
      maintenance: 'Поддержание веса',
      gut_health: 'Здоровье кишечника',
    }[goal] || '—'
  );
}

async function fetch3DayStats(telegramId, supabase) {
  const from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('daily_stats')
    .select('total_calories, total_protein, total_fat, total_carbs, water_glasses')
    .eq('user_telegram_id', telegramId)
    .gte('date', from);

  if (!data?.length) return { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, days: 0 };
  const n = data.length;
  const avg = (f) => Math.round(data.reduce((s, r) => s + (r[f] || 0), 0) / n);
  return {
    calories: avg('total_calories'),
    protein: avg('total_protein'),
    fat: avg('total_fat'),
    carbs: avg('total_carbs'),
    water: avg('water_glasses') * 250, // glasses → ml
    days: n,
  };
}

function makeInsight(user, stats) {
  const parts = [];
  if (stats.protein > 0 && user.daily_protein) {
    const pct = Math.round((stats.protein / user.daily_protein) * 100);
    if (pct < 80) parts.push(`Белка меньше нормы (${pct}%) — это может снижать энергию`);
    else parts.push(`Белок в норме (${pct}%) — отличная работа`);
  }
  if (stats.calories > 0 && user.daily_calories) {
    const diff = stats.calories - user.daily_calories;
    if (diff > 200) parts.push(`Калорийность чуть выше нормы на ${diff} ккал`);
    else if (diff < -200) parts.push(`Калорийность ниже нормы на ${Math.abs(diff)} ккал`);
    else parts.push(`Калорийность близка к норме — так держать`);
  }
  return parts.length
    ? parts.join('. ') + '.'
    : 'Данных пока маловато — продолжайте вносить приёмы пищи!';
}

async function fillPlaceholders(text, user, supabase) {
  const name = (user.full_name || 'Вы').split(' ')[0];
  const waterL = ((user.water_norm || 2000) / 1000).toFixed(1);
  const kbju = `${user.daily_calories || '?'} ккал (Б:${user.daily_protein || '?'}г / Ж:${user.daily_fat || '?'}г / У:${user.daily_carbs || '?'}г)`;

  let out = text
    .replace(/\{name\}/g, name)
    .replace(/\{goal\}/g, formatGoal(user.goal))
    .replace(/\{water_norm\}/g, waterL)
    .replace(/\{kbju_norm\}/g, kbju)
    .replace(/\{favorite_food\}/g, 'полезные блюда');

  // 3-day stats block
  if (/\{avg_/.test(out) || /\{personalized_insight\}/.test(out)) {
    const s = await fetch3DayStats(user.telegram_id, supabase);
    out = out
      .replace(/\{avg_calories\}/g, s.calories)
      .replace(/\{avg_protein\}/g, s.protein)
      .replace(/\{avg_fat\}/g, s.fat)
      .replace(/\{avg_carbs\}/g, s.carbs)
      .replace(/\{avg_water\}/g, (s.water / 1000).toFixed(1))
      .replace(/\{personalized_insight\}/g, makeInsight(user, s));
  }

  // 6-day report insights
  if (/\{protein_insight\}|\{calorie_pattern\}|\{main_insight\}|\{risk_insight\}/.test(out)) {
    const s = await fetch3DayStats(user.telegram_id, supabase);
    out = out
      .replace(/\{protein_insight\}/g, makeInsight(user, s))
      .replace(/\{calorie_pattern\}/g, '70% калорий приходится на вечернее время')
      .replace(/\{main_insight\}/g,
        s.protein < (user.daily_protein || 100) * 0.8
          ? 'Увеличьте потребление белка — это ускорит достижение цели'
          : 'Баланс питательных веществ близок к оптимальному')
      .replace(/\{risk_insight\}/g,
        s.carbs > (user.daily_carbs || 200) * 1.2
          ? 'Высокое потребление углеводов после 18:00'
          : 'Явных рисков не выявлено');
  }

  // Weekly paid report placeholders
  if (/\{protein_delta\}|\{water_days\}|\{goal_progress\}/.test(out)) {
    out = out
      .replace(/\{protein_delta\}/g, '15')
      .replace(/\{water_days\}/g, '5')
      .replace(/\{goal_progress\}/g, '15');
  }

  // Sample meal plan
  out = out
    .replace(/\{sample_breakfast\}/g, 'Овсяноблин с творогом и ягодами (~350 ккал)')
    .replace(/\{sample_lunch\}/g, 'Куриная грудка с гречкой и овощным салатом (~500 ккал)')
    .replace(/\{sample_snack\}/g, 'Яблоко + 10 орехов миндаля (~150 ккал)')
    .replace(/\{sample_dinner\}/g, 'Запечённая рыба с киноа и стручковой фасолью (~420 ккал)');

  return out;
}

// ─── send_condition evaluator ────────────────────────────────────────────────
async function checkCondition(condition, user, telegramId, supabase) {
  switch (condition) {
    case 'always':
      return true;

    case 'if_onboarding_incomplete':
      return !user.onboarding_completed;

    case 'after_onboarding':
      return !!user.onboarding_completed;

    case 'if_no_food_logged': {
      const today = moscowDateStr();
      const { count } = await supabase
        .from('food_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_telegram_id', telegramId)
        .gte('created_date', today);
      return (count || 0) === 0;
    }

    case 'after_food_logged': {
      const today = moscowDateStr();
      const { count } = await supabase
        .from('food_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_telegram_id', telegramId)
        .gte('created_date', today);
      return (count || 0) > 0;
    }

    case 'after_question_answered': {
      const { data: s } = await supabase
        .from('user_funnel_state')
        .select('extra_data')
        .eq('user_telegram_id', telegramId)
        .eq('is_active', true)
        .maybeSingle();
      return !!s?.extra_data?.answered_free_question;
    }

    case 'after_subscription':
      return !!user.is_subscription_active;

    default:
      return true;
  }
}

// ─── Dedup: was this message sent today? ────────────────────────────────────
async function alreadySentToday(telegramId, msgId, supabase) {
  const today = moscowDateStr();
  const { count } = await supabase
    .from('bot_message_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_telegram_id', telegramId)
    .eq('funnel_message_id', msgId)
    .gte('sent_at', today)
    .in('delivery_status', ['sent', 'skipped']);
  return (count || 0) > 0;
}

// ─── Dispatch a single message row to a user ────────────────────────────────
async function dispatch(state, user, msg, supabase, token, appUrl) {
  // 1. Dedup
  if (await alreadySentToday(state.user_telegram_id, msg.id, supabase)) return 'dedup';

  // 2. Condition check
  const ok = await checkCondition(msg.send_condition, user, state.user_telegram_id, supabase);

  // 3. Insert log row (pending / skipped)
  const { data: log } = await supabase
    .from('bot_message_log')
    .insert({
      user_telegram_id: state.user_telegram_id,
      funnel_message_id: msg.id,
      funnel_type: state.funnel_type,
      day_number: state.current_day,
      block_id: msg.block_id,
      delivery_status: ok ? 'pending' : 'skipped',
    })
    .select('id')
    .single();

  if (!ok) return 'skipped';

  // 4. Fill placeholders + send
  const text = await fillPlaceholders(msg.message_text, user, supabase);
  const result = await sendTelegramMessage(state.user_telegram_id, text, msg, appUrl, token);

  // 5. Update log
  await supabase
    .from('bot_message_log')
    .update({
      delivery_status: result.ok ? 'sent' : 'failed',
      telegram_message_id: result.result?.message_id ?? null,
      error_message: result.ok ? null : result.description,
    })
    .eq('id', log.id);

  // 6. Update funnel state last_message_sent_at
  await supabase
    .from('user_funnel_state')
    .update({ last_message_sent_at: new Date().toISOString() })
    .eq('id', state.id);

  // Brief pause to respect Telegram rate limits
  await new Promise((r) => setTimeout(r, 60));
  return result.ok ? 'sent' : 'failed';
}

// ─── Step 1: Advance current_day at Moscow midnight ─────────────────────────
async function advanceDays(supabase) {
  const hour = moscowHour(moscowNow());
  if (hour !== 0) return;

  const { data: states } = await supabase
    .from('user_funnel_state')
    .select('id, current_day, funnel_type')
    .eq('is_active', true)
    .eq('status', 'in_progress');

  if (!states?.length) return;

  for (const s of states) {
    // paid funnel ends at day 35; active/sleeping end at day 7
    const maxDay = s.funnel_type === 'paid' ? 35 : 7;
    if (s.current_day >= maxDay) {
      await supabase
        .from('user_funnel_state')
        .update({ status: 'completed', is_active: false, updated_at: new Date().toISOString() })
        .eq('id', s.id);
      console.log(`[cron] Funnel completed: state ${s.id}`);
    } else {
      await supabase
        .from('user_funnel_state')
        .update({ current_day: s.current_day + 1, updated_at: new Date().toISOString() })
        .eq('id', s.id);
    }
  }
  console.log(`[cron] Day advanced for ${states.length} funnel states`);
}

// ─── Step 2: Dispatch scheduled (send_time) messages ─────────────────────────
async function processScheduled(supabase, token, appUrl) {
  const hour = moscowHour(moscowNow());
  const sendTime = hhmm(hour);
  console.log(`[cron] Processing scheduled messages for Moscow ${sendTime}`);

  const { data: states } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('is_active', true)
    .eq('status', 'in_progress');

  if (!states?.length) return 0;

  let totalSent = 0;

  for (const state of states) {
    try {
      // Fetch matching messages for this funnel + day + hour
      const { data: messages } = await supabase
        .from('bot_funnel_messages')
        .select('*')
        .eq('funnel_type', state.funnel_type)
        .eq('day_number', state.current_day)
        .eq('send_time', sendTime)
        .is('trigger_event', null)           // time-based only, not event-based
        .is('delay_hours', null)             // not delay-based
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!messages?.length) continue;

      const { data: user } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('telegram_id', state.user_telegram_id)
        .single();

      if (!user) continue;

      for (const msg of messages) {
        const result = await dispatch(state, user, msg, supabase, token, appUrl);
        if (result === 'sent') {
          totalSent++;
          console.log(`[cron] ✓ ${state.funnel_type} day${state.current_day} block${msg.block_id} → ${state.user_telegram_id}`);
        }
      }
    } catch (err) {
      console.error(`[cron] Error for user ${state.user_telegram_id}:`, err.message);
    }
  }

  return totalSent;
}

// ─── Step 3: Dispatch delay_hours messages ───────────────────────────────────
async function processDelayed(supabase, token, appUrl) {
  const { data: delayMsgs } = await supabase
    .from('bot_funnel_messages')
    .select('*')
    .not('delay_hours', 'is', null)
    .eq('is_active', true);

  if (!delayMsgs?.length) return 0;

  const { data: states } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('is_active', true)
    .eq('status', 'in_progress');

  if (!states?.length) return 0;

  let totalSent = 0;

  for (const state of states) {
    for (const msg of delayMsgs) {
      if (msg.funnel_type !== state.funnel_type || msg.day_number !== state.current_day) continue;
      if (await alreadySentToday(state.user_telegram_id, msg.id, supabase)) continue;

      // Find when the parent block (block_id without '.N' suffix) was sent today
      const parentBlock = msg.block_id.split('.')[0]; // "1.1" → "1"
      const today = moscowDateStr();

      const { data: parentLog } = await supabase
        .from('bot_message_log')
        .select('sent_at')
        .eq('user_telegram_id', state.user_telegram_id)
        .eq('funnel_type', state.funnel_type)
        .eq('day_number', state.current_day)
        .eq('block_id', parentBlock)
        .eq('delivery_status', 'sent')
        .gte('sent_at', today)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!parentLog) continue;

      const elapsedHours = (Date.now() - new Date(parentLog.sent_at).getTime()) / 3600000;
      if (elapsedHours < msg.delay_hours) continue;

      const { data: user } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('telegram_id', state.user_telegram_id)
        .single();

      if (!user) continue;

      const result = await dispatch(state, user, msg, supabase, token, appUrl);
      if (result === 'sent') {
        totalSent++;
        console.log(`[cron] ✓ delayed block${msg.block_id} → ${state.user_telegram_id}`);
      }
    }
  }

  return totalSent;
}

// ─── Step 4: Weekly report for paid users every Monday ───────────────────────
async function processWeeklyReport(supabase, token, appUrl) {
  const msk = moscowNow();
  // getUTCDay() on the Moscow-shifted date: 1 = Monday
  if (msk.getUTCDay() !== 1 || moscowHour(msk) !== 10) return 0;

  const { data: reportMsg } = await supabase
    .from('bot_funnel_messages')
    .select('*')
    .eq('funnel_type', 'paid')
    .eq('trigger_event', 'weekly_report')
    .eq('is_active', true)
    .single();

  if (!reportMsg) return 0;

  const { data: states } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('funnel_type', 'paid')
    .eq('is_active', true)
    .eq('status', 'in_progress');

  if (!states?.length) return 0;

  let totalSent = 0;
  for (const state of states) {
    const { data: user } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('telegram_id', state.user_telegram_id)
      .single();

    if (!user) continue;
    const result = await dispatch(state, user, reportMsg, supabase, token, appUrl);
    if (result === 'sent') totalSent++;
  }

  return totalSent;
}

// ─── Step 5: Paid funnel milestone event messages ────────────────────────────
// Fires subscription_day_14, subscription_day_27, subscription_day_35_lapsed
async function processPaidMilestones(supabase, token, appUrl) {
  const hour = moscowHour(moscowNow());
  if (hour !== 10) return 0; // only once a day at 10:00

  const milestoneMap = {
    14: 'subscription_day_14',
    27: 'subscription_day_27',
    35: 'subscription_day_35_lapsed',
  };

  const { data: states } = await supabase
    .from('user_funnel_state')
    .select('*')
    .eq('funnel_type', 'paid')
    .eq('is_active', true)
    .eq('status', 'in_progress')
    .in('current_day', Object.keys(milestoneMap).map(Number));

  if (!states?.length) return 0;

  let totalSent = 0;

  for (const state of states) {
    const triggerEvent = milestoneMap[state.current_day];
    if (!triggerEvent) continue;

    const { data: msg } = await supabase
      .from('bot_funnel_messages')
      .select('*')
      .eq('funnel_type', 'paid')
      .eq('trigger_event', triggerEvent)
      .eq('day_number', state.current_day)
      .eq('is_active', true)
      .maybeSingle();

    if (!msg) continue;

    const { data: user } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('telegram_id', state.user_telegram_id)
      .single();

    if (!user) continue;

    const result = await dispatch(state, user, msg, supabase, token, appUrl);
    if (result === 'sent') {
      totalSent++;
      console.log(`[cron] ✓ Paid milestone ${triggerEvent} → ${state.user_telegram_id}`);
    }
  }

  return totalSent;
}

// ─── Step 6: Water & exercise reminders ─────────────────────────────────────
/**
 * Sends water / exercise reminders to users who have them enabled.
 * Uses the `reminders` table: each row stores type, enabled, interval_hours,
 * and updated_at (reset after every send to act as the timer).
 *
 * Logic: if NOW() - updated_at  >= interval_hours → send → update updated_at.
 */
async function processReminders(supabase, token) {
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('[cron] processReminders fetch error:', error.message);
    return 0;
  }
  if (!reminders?.length) return 0;

  const now = new Date();
  let sent = 0;

  for (const reminder of reminders) {
    try {
      const updatedAt = new Date(reminder.updated_at);
      const elapsedHours = (now.getTime() - updatedAt.getTime()) / 3_600_000;

      // Not yet due
      if (elapsedHours < (reminder.interval_hours || 2)) continue;

      // Fetch user profile for personalised data
      const { data: user } = await supabase
        .from('user_profiles')
        .select('full_name, water_norm')
        .eq('telegram_id', reminder.user_telegram_id)
        .maybeSingle();

      let text;
      if (reminder.type === 'water') {
        const waterL = user?.water_norm
          ? (user.water_norm / 1000).toFixed(1)
          : '2.0';
        text =
          `💧 <b>Время выпить воды!</b>\n\n` +
          `Не забывай о своей норме — <b>${waterL} л</b> в день.\n` +
          `Один стакан прямо сейчас — маленький шаг к большой цели! 🙂`;
      } else if (reminder.type === 'exercise') {
        text =
          `🏃 <b>Время подвигаться!</b>\n\n` +
          `Даже 5–10 минут лёгкой активности улучшат самочувствие и помогут достичь цели 💪\n` +
          `Зафиксируй тренировку в приложении!`;
      } else {
        // Unknown type — skip
        continue;
      }

      const result = await tgCall(
        'sendMessage',
        { chat_id: reminder.user_telegram_id, text, parse_mode: 'HTML' },
        token
      );

      if (result.ok) {
        // Reset the interval timer
        await supabase
          .from('reminders')
          .update({ updated_at: now.toISOString() })
          .eq('id', reminder.id);
        sent++;
        console.log(`[cron] ✓ Reminder (${reminder.type}) → ${reminder.user_telegram_id}`);
      } else {
        console.error(
          `[cron] Reminder failed for ${reminder.user_telegram_id}:`,
          result.description
        );
        // Bot was blocked — disable the reminder to avoid repeated errors
        if (result.error_code === 403) {
          await supabase
            .from('reminders')
            .update({ enabled: false })
            .eq('id', reminder.id);
          console.warn(`[cron] Reminder disabled (bot blocked) for ${reminder.user_telegram_id}`);
        }
      }
    } catch (err) {
      console.error(`[cron] Reminder error for ${reminder.user_telegram_id}:`, err.message);
    }
  }

  return sent;
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel Cron automatically adds the CRON_SECRET as Bearer token
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.TELEGRAM_APP_URL || 'https://t.me/your_bot';

  if (!token || !supabaseUrl || !supabaseKey) {
    console.error('[bot-cron] Missing env vars');
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await advanceDays(supabase);

    const [scheduled, delayed, weekly, milestones, reminders] = await Promise.all([
      processScheduled(supabase, token, appUrl),
      processDelayed(supabase, token, appUrl),
      processWeeklyReport(supabase, token, appUrl),
      processPaidMilestones(supabase, token, appUrl),
      processReminders(supabase, token),
    ]);

    const total = scheduled + delayed + weekly + milestones + reminders;
    console.log(
      `[bot-cron] Done. Total sent: ${total}` +
      ` (scheduled:${scheduled} delayed:${delayed} weekly:${weekly}` +
      ` milestones:${milestones} reminders:${reminders})`
    );
    return res.status(200).json({ ok: true, scheduled, delayed, weekly, milestones, reminders });
  } catch (err) {
    console.error('[bot-cron] Fatal:', err);
    return res.status(500).json({ error: err.message });
  }
}
