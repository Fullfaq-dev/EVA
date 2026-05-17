/**
 * Создание записи еды из текста в Telegram-чате + webhook в n8n.
 */

const MEAL_HINTS = [
  { type: 'breakfast', words: ['завтрак', 'утром', 'утра'] },
  { type: 'lunch', words: ['обед', 'обедал'] },
  { type: 'dinner', words: ['ужин', 'ужинал', 'вечером'] },
  { type: 'snack', words: ['перекус', 'полдник', 'снэк'] },
];

function guessMealType(text) {
  const t = text.toLowerCase();
  for (const { type, words } of MEAL_HINTS) {
    if (words.some((w) => t.includes(w))) return type;
  }
  return 'snack';
}

function shouldSkipFoodText(text) {
  const t = text.trim();
  if (!t || t.startsWith('/')) return true;
  if (t.length < 3) return true;
  return false;
}

async function sendFoodWebhooks(payload) {
  const urls = [
    process.env.N8N_FOOD_WEBHOOK_URL,
    process.env.N8N_FOOD_WEBHOOK_TEST_URL,
    'https://lavaproject.zeabur.app/webhook/food',
  ].filter(Boolean);

  const unique = [...new Set(urls)];
  for (const url of unique) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error(`[bot-food] webhook ${url}:`, err.message);
    }
  }
}

/**
 * @returns {boolean} true если сообщение обработано как еда
 */
export async function handleFoodTextMessage(text, telegramId, supabase) {
  if (shouldSkipFoodText(text)) return false;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('telegram_id', String(telegramId))
    .maybeSingle();

  if (!profile?.onboarding_completed) return false;

  const meal_type = guessMealType(text);
  const description = text.trim();

  const { data: entry, error } = await supabase
    .from('food_entries')
    .insert({
      user_telegram_id: String(telegramId),
      description,
      meal_type,
      photo_url: null,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    })
    .select('id, created_date')
    .single();

  if (error) {
    console.error('[bot-food] insert failed:', error.message);
    return false;
  }

  await sendFoodWebhooks({
    entry_id: entry.id,
    telegram_id: String(telegramId),
    description,
    meal_type,
    photo_url: null,
    photo_urls: [],
    created_date: entry.created_date,
    status: 'new',
    source: 'telegram_chat',
    timestamp: new Date().toISOString(),
  });

  return true;
}
