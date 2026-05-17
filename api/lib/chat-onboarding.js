/**
 * In-chat onboarding flow — mirrors the Mini App questionnaire.
 * State is stored in chat_onboarding_sessions (Vercel is stateless).
 */

import { calculateNutrition } from './nutritionCalculator.js';
import { fireEvent } from '../bot-trigger.js';

const STEPS = {
  AGREEMENT: 0,
  NAME: 1,
  GENDER: 2,
  HEIGHT: 3,
  WEIGHT: 4,
  AGE: 5,
  ACTIVITY: 6,
  GOAL: 7,
  PROBLEMS: 8,
  ALLERGIES: 9,
  RESULT: 10,
};

const GOAL_LABELS = {
  gut_health: 'Здоровье ЖКТ',
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  maintenance: 'Поддержание веса',
};

const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: 'Низкая активность' },
  { id: 'moderate', label: 'Умеренная' },
  { id: 'active', label: 'Высокая' },
  { id: 'very_active', label: 'Очень высокая' },
];

const GOAL_OPTIONS = [
  { id: 'gut_health', label: 'Наладить ЖКТ' },
  { id: 'weight_loss', label: 'Похудеть' },
  { id: 'muscle_gain', label: 'Набор массы' },
  { id: 'maintenance', label: 'Поддержание веса' },
];

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function tgSend(chatId, text, replyMarkup, token) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

export async function getSession(telegramId, supabase) {
  const { data } = await supabase
    .from('chat_onboarding_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return data;
}

async function upsertSession(telegramId, step, data, supabase) {
  const { error } = await supabase.from('chat_onboarding_sessions').upsert(
    { telegram_id: telegramId, step, data },
    { onConflict: 'telegram_id' }
  );
  if (error) throw error;
}

async function clearSession(telegramId, supabase) {
  await supabase.from('chat_onboarding_sessions').delete().eq('telegram_id', telegramId);
}

export async function hasActiveSession(telegramId, supabase) {
  const session = await getSession(telegramId, supabase);
  return !!session;
}

// ─── Profile save ───────────────────────────────────────────────────────────────

async function createDefaultReminders(telegramId, supabase) {
  const rows = [
    { user_telegram_id: telegramId, type: 'water', enabled: true, interval_hours: 2 },
    { user_telegram_id: telegramId, type: 'food_photo', enabled: true, interval_hours: 4 },
    { user_telegram_id: telegramId, type: 'exercise', enabled: true, interval_hours: 24 },
  ];
  const { error } = await supabase.from('reminders').insert(rows);
  if (error) console.warn('[chat-onboarding] reminders insert:', error.message);
}

/** Одно итоговое сообщение после сохранения в чате (без дубля воронки). */
function buildChatCompleteMessage(formData, nutrition) {
  const name = (formData.full_name || 'друг').trim().split(/\s+/)[0] || 'друг';
  const waterL = (nutrition.waterNorm / 1000).toFixed(1);
  return (
    `🎉 <b>${name}, регистрация завершена!</b>\n\n` +
    `Спасибо, что заполнили анкету 💗 Теперь рекомендации будут опираться на ваши цели.\n\n` +
    `🔹 Цель: ${GOAL_LABELS[formData.goal] || formData.goal}\n` +
    `🔹 КБЖУ: <b>${Math.round(nutrition.dailyCalories)}</b> ккал ` +
    `(Б:${Math.round(nutrition.dailyProtein)} / Ж:${Math.round(nutrition.dailyFat)} / У:${Math.round(nutrition.dailyCarbs)})\n` +
    `🔹 Вода: <b>${waterL}</b> л/день 💧\n\n` +
    `На <b>7 дней</b> активирован бесплатный доступ ко всем возможностям EVA ✨\n\n` +
    `Отправьте фото еды или напишите в чат — я на связи!`
  );
}

/** Помечаем event-сообщения дня 1, чтобы cron/trigger не дублировали после чат-онбординга. */
async function markActiveOnboardingFunnelSent(telegramId, supabase) {
  const { data: msgs } = await supabase
    .from('bot_funnel_messages')
    .select('id, day_number, block_id, funnel_type')
    .eq('funnel_type', 'active')
    .eq('day_number', 1)
    .in('block_id', ['2', '3'])
    .in('trigger_event', ['onboarding_completed', 'trial_started']);

  if (!msgs?.length) return;

  const rows = msgs.map((msg) => ({
    user_telegram_id: telegramId,
    funnel_message_id: msg.id,
    funnel_type: msg.funnel_type,
    day_number: msg.day_number,
    block_id: msg.block_id,
    delivery_status: 'skipped',
    error_message: 'chat_onboarding_complete',
  }));

  await supabase.from('bot_message_log').insert(rows);
}

async function saveProfile(telegramId, formData, supabase, token, appUrl, { skipFunnelNotify = false } = {}) {
  const nutrition = calculateNutrition(formData);

  const profileData = {
    telegram_id: telegramId,
    full_name: formData.full_name || 'Пользователь',
    gender: formData.gender,
    height: parseInt(formData.height, 10),
    weight: parseFloat(formData.weight),
    age: parseInt(formData.age, 10),
    activity_level: formData.activity_level,
    goal: formData.goal,
    problems: formData.problems || '',
    allergies: formData.allergies || '',
    daily_calories: Math.round(nutrition.dailyCalories),
    daily_protein: Math.round(nutrition.dailyProtein),
    daily_fat: Math.round(nutrition.dailyFat),
    daily_carbs: Math.round(nutrition.dailyCarbs),
    water_norm: Math.round(nutrition.waterNorm),
    bmi: nutrition.bmi,
    weight_status: nutrition.weightStatus,
    total_points: 0,
    onboarding_completed: true,
  };

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (existing) {
    const trialData = {};
    if (!existing.is_subscription_active && !existing.subscription_end_date) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      trialData.is_subscription_active = true;
      trialData.subscription_end_date = trialEnd.toISOString();
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...profileData, ...trialData })
      .eq('telegram_id', telegramId);
    if (error) throw error;
  } else {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const { error } = await supabase.from('user_profiles').insert({
      ...profileData,
      is_subscription_active: true,
      subscription_end_date: trialEnd.toISOString(),
    });
    if (error) throw error;
    await createDefaultReminders(telegramId, supabase);
  }

  if (token && !skipFunnelNotify) {
    await fireEvent(telegramId, 'onboarding_completed', supabase, token, appUrl);
    await new Promise((r) => setTimeout(r, 1000));
    await fireEvent(telegramId, 'trial_started', supabase, token, appUrl);
  }

  if (skipFunnelNotify) {
    await markActiveOnboardingFunnelSent(telegramId, supabase);
  }

  return { nutrition };
}

// ─── Step prompts ─────────────────────────────────────────────────────────────

function agreementMarkup(appUrl) {
  const isTgLink = appUrl.startsWith('https://t.me') || appUrl.startsWith('http://t.me');
  const legalBtn = isTgLink
    ? { text: '📄 Документы в приложении', url: appUrl }
    : { text: '📄 Документы в приложении', web_app: { url: appUrl } };

  return {
    inline_keyboard: [
      [{ text: '✅ Принимаю и продолжаю', callback_data: 'ob_agree' }],
      [legalBtn],
      [{ text: '❌ Отмена', callback_data: 'ob_cancel' }],
    ],
  };
}

async function sendStepPrompt(chatId, step, data, token, appUrl) {
  switch (step) {
    case STEPS.AGREEMENT:
      await tgSend(
        chatId,
        `📋 <b>Регистрация в чате</b>\n\n` +
          `Проходя регистрацию, вы соглашаетесь с <b>публичной офертой</b> и <b>правилами бота</b>, ` +
          `а также даёте согласие на обработку персональных данных.\n\n` +
          `Полные тексты документов можно ознакомиться в мини-приложении.\n\n` +
          `Нажмите «Принимаю и продолжаю», чтобы начать анкету.`,
        agreementMarkup(appUrl),
        token
      );
      break;

    case STEPS.NAME:
      await tgSend(
        chatId,
        `👤 <b>Как вас зовут?</b>\n\nНапишите имя, которым к вам обращаться:`,
        null,
        token
      );
      break;

    case STEPS.GENDER:
      await tgSend(chatId, `⚧ <b>Ваш пол</b>`, {
        inline_keyboard: [
          [
            { text: 'Мужской', callback_data: 'ob_g:male' },
            { text: 'Женский', callback_data: 'ob_g:female' },
          ],
        ],
      }, token);
      break;

    case STEPS.HEIGHT:
      await tgSend(chatId, `📏 <b>Рост</b>\n\nУкажите рост в сантиметрах (например: 175):`, null, token);
      break;

    case STEPS.WEIGHT:
      await tgSend(chatId, `⚖️ <b>Вес</b>\n\nУкажите вес в кг (например: 70):`, null, token);
      break;

    case STEPS.AGE:
      await tgSend(chatId, `🎂 <b>Возраст</b>\n\nСколько вам полных лет?`, null, token);
      break;

    case STEPS.ACTIVITY: {
      const rows = ACTIVITY_OPTIONS.map((o) => [
        { text: o.label, callback_data: `ob_a:${o.id}` },
      ]);
      await tgSend(chatId, `🏃 <b>Уровень активности</b>\n\nНасколько вы физически активны?`, {
        inline_keyboard: rows,
      }, token);
      break;
    }

    case STEPS.GOAL: {
      const rows = GOAL_OPTIONS.map((o) => [
        { text: o.label, callback_data: `ob_gl:${o.id}` },
      ]);
      await tgSend(chatId, `🎯 <b>Ваша цель</b>\n\nЧего хотите достичь?`, {
        inline_keyboard: rows,
      }, token);
      break;
    }

    case STEPS.PROBLEMS:
      await tgSend(
        chatId,
        `💬 <b>Проблемы и жалобы</b> (необязательно)\n\n` +
          `Опишите, что вас беспокоит, или нажмите «Пропустить»:`,
        { inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'ob_skip_problems' }]] },
        token
      );
      break;

    case STEPS.ALLERGIES:
      await tgSend(
        chatId,
        `🚫 <b>Аллергии и ограничения</b> (необязательно)\n\n` +
          `Укажите продукты, которые нельзя, или нажмите «Пропустить»:`,
        { inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'ob_skip_allergies' }]] },
        token
      );
      break;

    case STEPS.RESULT: {
      await tgSend(
        chatId,
        `✨ <b>Проверьте анкету</b>\n\n` +
          `Если всё верно — нажмите «Сохранить профиль». ` +
          `Я сохраню данные и пришлю ваш персональный план с нормами КБЖУ.`,
        { inline_keyboard: [[{ text: '✅ Сохранить профиль', callback_data: 'ob_save' }]] },
        token
      );
      break;
    }

    default:
      break;
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function parsePositiveInt(text, min, max) {
  const n = parseInt(text.replace(/\s/g, ''), 10);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

function parsePositiveFloat(text, min, max) {
  const n = parseFloat(text.replace(',', '.').replace(/\s/g, ''));
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/** Сообщение с выбором: приложение или чат */
export async function sendOnboardingChoice(chatId, token, appUrl) {
  const { buildOnboardingChoiceMarkup } = await import('./bot-markup.js');
  await tgSend(
    chatId,
    `📝 <b>Заполните анкету</b>\n\n` +
      `Это займёт около 2 минут и поможет мне давать персональные рекомендации.\n\n` +
      `Выберите, где удобнее пройти регистрацию:`,
    buildOnboardingChoiceMarkup(appUrl),
    token
  );
}

/** Начать онбординг в чате */
export async function startChatOnboarding(chatId, telegramId, defaultName, supabase, token, appUrl) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (profile?.onboarding_completed) {
    await tgSend(chatId, '✅ Анкета уже заполнена. Можете пользоваться ботом!', null, token);
    return true;
  }

  await upsertSession(
    telegramId,
    STEPS.AGREEMENT,
    { full_name: defaultName || '', agreement: false },
    supabase
  );
  await sendStepPrompt(chatId, STEPS.AGREEMENT, {}, token, appUrl);
  return true;
}

/** Обработка callback_data, связанных с онбордингом */
export async function handleOnboardingCallback(callbackData, chatId, telegramId, from, supabase, token, appUrl) {
  if (callbackData === 'choose_onboarding') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (profile?.onboarding_completed) {
      await tgSend(chatId, '✅ Анкета уже заполнена. Можете пользоваться ботом!', null, token);
      return true;
    }

    const active = await getSession(telegramId, supabase);
    if (active) {
      await tgSend(
        chatId,
        'У вас уже идёт регистрация в чате — ответьте на текущий вопрос или нажмите «Отмена» в первом сообщении анкеты.',
        null,
        token
      );
      return true;
    }

    await sendOnboardingChoice(chatId, token, appUrl);
    return true;
  }

  if (callbackData === 'onboard_chat') {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    await startChatOnboarding(chatId, telegramId, name, supabase, token, appUrl);
    return true;
  }

  const session = await getSession(telegramId, supabase);
  if (!session && !callbackData.startsWith('ob_')) return false;

  if (callbackData === 'ob_cancel') {
    await clearSession(telegramId, supabase);
    await tgSend(chatId, 'Регистрация отменена. Когда будете готовы — нажмите «Заполнить анкету».', null, token);
    return true;
  }

  if (!session) return false;

  const data = { ...session.data };

  if (callbackData === 'ob_agree' && session.step === STEPS.AGREEMENT) {
    data.agreement = true;
    const nextStep =
      data.full_name && String(data.full_name).trim().length > 0 ? STEPS.GENDER : STEPS.NAME;
    await upsertSession(telegramId, nextStep, data, supabase);
    await sendStepPrompt(chatId, nextStep, data, token, appUrl);
    return true;
  }

  if (callbackData.startsWith('ob_g:') && session.step === STEPS.GENDER) {
    data.gender = callbackData.slice(5);
    await upsertSession(telegramId, STEPS.HEIGHT, data, supabase);
    await sendStepPrompt(chatId, STEPS.HEIGHT, data, token, appUrl);
    return true;
  }

  if (callbackData.startsWith('ob_a:') && session.step === STEPS.ACTIVITY) {
    data.activity_level = callbackData.slice(5);
    await upsertSession(telegramId, STEPS.GOAL, data, supabase);
    await sendStepPrompt(chatId, STEPS.GOAL, data, token, appUrl);
    return true;
  }

  if (callbackData.startsWith('ob_gl:') && session.step === STEPS.GOAL) {
    data.goal = callbackData.slice(6);
    await upsertSession(telegramId, STEPS.PROBLEMS, data, supabase);
    await sendStepPrompt(chatId, STEPS.PROBLEMS, data, token, appUrl);
    return true;
  }

  if (callbackData === 'ob_skip_problems' && session.step === STEPS.PROBLEMS) {
    data.problems = '';
    await upsertSession(telegramId, STEPS.ALLERGIES, data, supabase);
    await sendStepPrompt(chatId, STEPS.ALLERGIES, data, token, appUrl);
    return true;
  }

  if (callbackData === 'ob_skip_allergies' && session.step === STEPS.ALLERGIES) {
    data.allergies = '';
    await upsertSession(telegramId, STEPS.RESULT, data, supabase);
    await sendStepPrompt(chatId, STEPS.RESULT, data, token, appUrl);
    return true;
  }

  if (callbackData === 'ob_save' && session.step === STEPS.RESULT) {
    try {
      const { nutrition } = await saveProfile(telegramId, data, supabase, token, appUrl, {
        skipFunnelNotify: true,
      });
      await clearSession(telegramId, supabase);
      await tgSend(chatId, buildChatCompleteMessage(data, nutrition), null, token);
    } catch (err) {
      console.error('[chat-onboarding] save error:', err.message);
      await tgSend(chatId, '❌ Ошибка сохранения. Попробуйте ещё раз или заполните анкету в приложении.', null, token);
    }
    return true;
  }

  return false;
}

/** Обработка текстовых ответов во время активной сессии */
export async function handleOnboardingText(text, chatId, telegramId, supabase, token, appUrl) {
  const session = await getSession(telegramId, supabase);
  if (!session) return false;

  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('/')) return false;

  const data = { ...session.data };

  switch (session.step) {
    case STEPS.NAME: {
      if (trimmed.length < 1 || trimmed.length > 80) {
        await tgSend(chatId, 'Введите имя (от 1 до 80 символов):', null, token);
        return true;
      }
      data.full_name = trimmed;
      await upsertSession(telegramId, STEPS.GENDER, data, supabase);
      await sendStepPrompt(chatId, STEPS.GENDER, data, token, appUrl);
      return true;
    }

    case STEPS.HEIGHT: {
      const h = parsePositiveInt(trimmed, 100, 250);
      if (!h) {
        await tgSend(chatId, 'Укажите рост числом от 100 до 250 см:', null, token);
        return true;
      }
      data.height = h;
      await upsertSession(telegramId, STEPS.WEIGHT, data, supabase);
      await sendStepPrompt(chatId, STEPS.WEIGHT, data, token, appUrl);
      return true;
    }

    case STEPS.WEIGHT: {
      const w = parsePositiveFloat(trimmed, 30, 300);
      if (!w) {
        await tgSend(chatId, 'Укажите вес числом от 30 до 300 кг:', null, token);
        return true;
      }
      data.weight = w;
      await upsertSession(telegramId, STEPS.AGE, data, supabase);
      await sendStepPrompt(chatId, STEPS.AGE, data, token, appUrl);
      return true;
    }

    case STEPS.AGE: {
      const a = parsePositiveInt(trimmed, 14, 120);
      if (!a) {
        await tgSend(chatId, 'Укажите возраст числом от 14 до 120:', null, token);
        return true;
      }
      data.age = a;
      await upsertSession(telegramId, STEPS.ACTIVITY, data, supabase);
      await sendStepPrompt(chatId, STEPS.ACTIVITY, data, token, appUrl);
      return true;
    }

    case STEPS.PROBLEMS: {
      data.problems = trimmed;
      await upsertSession(telegramId, STEPS.ALLERGIES, data, supabase);
      await sendStepPrompt(chatId, STEPS.ALLERGIES, data, token, appUrl);
      return true;
    }

    case STEPS.ALLERGIES: {
      data.allergies = trimmed;
      await upsertSession(telegramId, STEPS.RESULT, data, supabase);
      await sendStepPrompt(chatId, STEPS.RESULT, data, token, appUrl);
      return true;
    }

    default:
      await tgSend(
        chatId,
        'Сейчас жду ответ на предыдущий вопрос — используйте кнопки под сообщением или введите текст, как указано выше.',
        null,
        token
      );
      return true;
  }
}

/** Проверка: нужно ли перехватить update (не слать в n8n) */
export function isOnboardingCallback(callbackData) {
  return (
    callbackData === 'choose_onboarding' ||
    callbackData === 'onboard_chat' ||
    callbackData === 'onboard_app' ||
    callbackData.startsWith('ob_')
  );
}
