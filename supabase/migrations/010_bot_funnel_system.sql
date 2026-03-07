-- =============================================================
-- Migration 010: Telegram Bot Sales Funnel System
-- =============================================================
-- Creates three tables:
--   1. bot_funnel_messages  — message template catalog
--   2. user_funnel_state    — per-user funnel progress tracker
--   3. bot_message_log      — delivery audit trail
--
-- Three funnel types:
--   'active'   — newly registered users (7-day onboarding + trial)
--   'sleeping' — users who haven't engaged (7-day re-engagement)
--   'paid'     — subscribers (weekly reports + lifecycle events)
--
-- Required Vercel environment variable: TELEGRAM_BOT_TOKEN
-- =============================================================

-- ============================================================
-- TABLE 1: bot_funnel_messages — message template catalog
-- ============================================================
CREATE TABLE bot_funnel_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Which funnel this message belongs to
    funnel_type TEXT NOT NULL
        CHECK (funnel_type IN ('active', 'sleeping', 'paid')),

    -- Day number within the funnel.
    --   active/sleeping : 1–7
    --   paid            : 14, 27, 30, 31, 35  (milestone days)
    --                     NULL = recurring / event-only (weekly report)
    day_number INTEGER,

    -- Block identifier within a day: '1', '1.1', '2', '3' …
    -- Used to group and sequence multiple messages in one slot.
    block_id TEXT NOT NULL,

    -- Scheduled wall-clock send time (Moscow UTC+3).
    -- NULL  → message is event-triggered or delay-triggered.
    send_time TIME,

    -- Delay in hours from day start (for "push after N hours" blocks).
    -- E.g. Block 1.1 of day 1 is sent 3 hours after Block 1.
    delay_hours INTEGER,

    -- Condition that gates whether this message is actually sent:
    --   'always'                  — unconditional
    --   'if_onboarding_incomplete'— only when onboarding NOT done
    --   'if_no_food_logged'       — only when no food logged today
    --   'after_food_logged'       — only when ≥1 food entry today
    --   'after_question_answered' — only after user answered free-question prompt
    --   'after_onboarding'        — only after onboarding_completed event
    --   'after_subscription'      — only after subscription_renewed / subscription_paid
    send_condition TEXT NOT NULL DEFAULT 'always',

    -- Event name that triggers this message (NULL = schedule-based).
    -- Known events:
    --   'onboarding_completed'         'trial_started'
    --   'food_logged'                  'question_answered'
    --   'user_replied_yes_to_meal_plan' 'sample_meal_plan_shown'
    --   'weekly_report'
    --   'subscription_paid'            'subscription_renewed'
    --   'subscription_expired'
    --   'subscription_day_14'          'subscription_day_27'
    --   'subscription_day_35_lapsed'
    trigger_event TEXT,

    -- Message body.
    -- Supported placeholders:
    --   {name}               — user's first name
    --   {goal}               — user's stated goal
    --   {kbju_norm}          — daily KBJU target summary
    --   {water_norm}         — daily water target in litres
    --   {avg_calories}       — 3-day average calories
    --   {avg_protein}        — 3-day average protein (g)
    --   {avg_fat}            — 3-day average fat (g)
    --   {avg_carbs}          — 3-day average carbs (g)
    --   {avg_water}          — 3-day average water (l)
    --   {personalized_insight} — AI-generated diet observation
    --   {protein_insight}    — protein delta insight text
    --   {calorie_pattern}    — calorie timing pattern text
    --   {main_insight}       — main weekly insight
    --   {risk_insight}       — risk/warning insight
    --   {sample_breakfast}   — sample meal plan breakfast
    --   {sample_lunch}       — sample meal plan lunch
    --   {sample_snack}       — sample meal plan snack
    --   {sample_dinner}      — sample meal plan dinner
    --   {protein_delta}      — % change in protein vs prior week
    --   {water_days}         — number of days water norm was met
    --   {goal_progress}      — % progress toward user goal
    --   {favorite_food}      — user's preferred dish type
    message_text TEXT NOT NULL,

    -- Optional single inline button attached to the message
    has_button    BOOLEAN DEFAULT FALSE,
    button_text   TEXT,
    -- Action key consumed by the bot to build the callback/URL:
    --   'open_onboarding'        'open_app'         'subscribe'
    --   'restore_access'         'enable_water_reminders'
    --   'show_meal_plan'         'continue'
    button_action TEXT,

    -- Ordering within the same (funnel_type, day_number, block_id) group.
    -- Allows two messages to share a block and be sent sequentially.
    sort_order INTEGER DEFAULT 0,

    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: user_funnel_state — per-user funnel progress
-- ============================================================
CREATE TABLE user_funnel_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_telegram_id TEXT NOT NULL
        REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,

    funnel_type TEXT NOT NULL
        CHECK (funnel_type IN ('active', 'sleeping', 'paid')),

    -- Current day within the funnel (incremented by the daily scheduler).
    current_day INTEGER DEFAULT 1,

    -- When the user entered this funnel.
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Timestamp of the most recently dispatched message in this funnel.
    last_message_sent_at TIMESTAMP WITH TIME ZONE,

    -- Funnel lifecycle status:
    --   'in_progress' — funnel is running normally
    --   'completed'   — all days/events exhausted without conversion
    --   'converted'   — user purchased subscription (exits active/sleeping)
    --   'paused'      — temporarily halted (e.g. user blocked the bot)
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'converted', 'paused')),

    -- Whether this record is the currently active entry for the user+funnel pair.
    is_active BOOLEAN DEFAULT TRUE,

    -- Flexible state bag for fine-grained tracking, e.g.:
    --   { "blocks_sent": ["1", "1.1", "2"],
    --     "answered_free_question": true,
    --     "viewed_meal_plan": false }
    extra_data JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Only one active record per user per funnel type.
    UNIQUE(user_telegram_id, funnel_type)
);

-- ============================================================
-- TABLE 3: bot_message_log — delivery audit trail
-- ============================================================
CREATE TABLE bot_message_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_telegram_id TEXT NOT NULL
        REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,

    -- Reference to the template that was sent (nullable for ad-hoc messages).
    funnel_message_id UUID
        REFERENCES bot_funnel_messages(id) ON DELETE SET NULL,

    -- Denormalised for fast querying without joins.
    funnel_type TEXT,
    day_number  INTEGER,
    block_id    TEXT,

    -- When the message was dispatched to the Telegram Bot API.
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Delivery lifecycle:
    --   'pending'   — queued, not yet sent
    --   'sent'      — dispatched to Telegram API
    --   'delivered' — Telegram confirmed delivery (webhook ack)
    --   'failed'    — error during send
    --   'skipped'   — send_condition not met; message intentionally skipped
    delivery_status TEXT DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),

    -- Telegram's message_id returned on success (useful for edits / analytics).
    telegram_message_id BIGINT,

    -- Error payload when delivery_status = 'failed'.
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_bfm_funnel_day
    ON bot_funnel_messages(funnel_type, day_number, sort_order);
CREATE INDEX idx_bfm_trigger
    ON bot_funnel_messages(trigger_event)
    WHERE trigger_event IS NOT NULL;
CREATE INDEX idx_bfm_active
    ON bot_funnel_messages(is_active, funnel_type);

CREATE INDEX idx_ufs_user
    ON user_funnel_state(user_telegram_id);
CREATE INDEX idx_ufs_active_status
    ON user_funnel_state(is_active, status, funnel_type);
CREATE INDEX idx_ufs_current_day
    ON user_funnel_state(funnel_type, current_day)
    WHERE is_active = TRUE AND status = 'in_progress';

CREATE INDEX idx_bml_user_sent
    ON bot_message_log(user_telegram_id, sent_at DESC);
CREATE INDEX idx_bml_funnel_message
    ON bot_message_log(funnel_message_id);
CREATE INDEX idx_bml_status
    ON bot_message_log(delivery_status);

-- ============================================================
-- updated_at auto-refresh triggers
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bfm_updated_at
    BEFORE UPDATE ON bot_funnel_messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ufs_updated_at
    BEFORE UPDATE ON user_funnel_state
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bot_funnel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_funnel_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_message_log     ENABLE ROW LEVEL SECURITY;

-- Templates are read-only for all; only service_role can mutate.
CREATE POLICY "Public read funnel messages"
    ON bot_funnel_messages FOR SELECT USING (true);

CREATE POLICY "Service role manages funnel messages"
    ON bot_funnel_messages FOR ALL
    USING (true) WITH CHECK (true);

-- Users may read their own funnel state; service_role manages it.
CREATE POLICY "Users view own funnel state"
    ON user_funnel_state FOR SELECT USING (true);

CREATE POLICY "Service role manages funnel state"
    ON user_funnel_state FOR ALL
    USING (true) WITH CHECK (true);

-- Users may read their own message log; service_role manages it.
CREATE POLICY "Users view own message log"
    ON bot_message_log FOR SELECT USING (true);

CREATE POLICY "Service role manages message log"
    ON bot_message_log FOR ALL
    USING (true) WITH CHECK (true);

-- ============================================================
-- SEED HELPER
-- All message_text values use $msg$...$msg$ dollar-quoting so that
-- Cyrillic text, emoji, single-quotes and newlines need no escaping.
-- {placeholders} are replaced at runtime by the bot worker.
-- ============================================================

-- ============================================================
-- SEED: ACTIVE FUNNEL — 7-day onboarding + trial funnel
-- ============================================================

-- ── DAY 1 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Welcome + onboarding CTA
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 1, '1', '10:00', 'always',
    $msg$Здравствуйте!
Я Ева — Ваш персональный помощник по питанию и здоровью 🤍
Теперь вместе со мной Вы сможете:
✨  Считать КБЖУ — просто сделайте фото или напишите что вы съели
🩺 Интерпретация анализов – загрузите результаты медицинских анализов, и я дам понятные пояснения и рекомендации.
📋  Персональные планы питания – составлю для вас индивидуальный рацион с учетом ваших целей и предпочтений.
💬 Экспертная поддержка 24/7: Задавайте любые вопросы прямо здесь!
🚀 Чтобы начать, заполните Анкету.
Это займёт 2 минуты и поможет мне узнать Вас лучше.$msg$,
    TRUE, 'Заполнить Анкету', 'open_onboarding', 0
);

-- Block 1.1 · delay 3h · Push if onboarding not done
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, delay_hours, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 1, '1.1', 3, 'if_onboarding_incomplete',
    $msg$Для того, чтобы начать Ваш путь к здоровью, расскажите о ваших целях в приложении 🌿$msg$,
    TRUE, 'Заполнить Анкету', 'open_onboarding', 0
);

-- Block 2 · event: onboarding_completed · Thanks + profile summary
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 1, '2', 'onboarding_completed', 'after_onboarding',
    $msg$Спасибо, что заполнили Анкету, {name} 💗
Я внимательно изучила её и теперь буду давать рекомендации, опираясь именно на Ваши цели 🎯
🔹 Основная цель: {goal}
🔹 Норма КБЖУ в день: {kbju_norm}
🔹 Норма воды в день: {water_norm} 💧
Теперь Вы можете внести первый приём пищи в пищевой дневник в приложении, а я подскажу, что делать дальше 👀$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 3 · event: trial_started · Trial period announcement
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 1, '3', 'trial_started', 'after_onboarding',
    $msg$Ура 🎉
С сегодняшнего дня для Вас активирован бесплатный пробный период на 7 дней ✨
Целую неделю у Вас будет полный доступ ко всем возможностям EVA — чтобы Вы успели познакомиться с функционалом и ощутить реальную пользу 💚

Кстати, EVA создана совместно с врачами и нутрициологами на базе искусственного интеллекта 👩‍⚕️👨‍⚕️
Поэтому мои рекомендации — не «шаблон», а персонализированный подход с учётом Вашей физиологии, целей и образа жизни.$msg$,
    FALSE, NULL, NULL, 0
);

-- ── DAY 2 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Morning food-photo prompt
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 2, '1', '10:00', 'always',
    $msg$Доброе утро ☀️
Готовы начать заботиться о себе по-новому?
Сфотографируйте Ваш завтрак — я расскажу о нём всё: калории, белки, жиры, углеводы 💡
Если не любите фотографировать — просто напишите в приложении, что Вы съели ✏️
Каждый приём пищи — это шаг к Вашей цели. Давайте сделаем его осознанным 🤍$msg$,
    TRUE, 'Перейти в приложение', 'open_app', 0
);

-- Block 2 · 20:00 · Evening wrap-up (only if food was logged today)
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 2, '2', '20:00', 'after_food_logged',
    $msg$Супер! Первый день вместе позади 🎉
Думаю, сегодня Вы узнали кое-что новое о своём привычном рационе. Даже небольшие открытия — это большой шаг к изменениям 🤍
А завтра Вас ждёт кое-что интересное.
Я расскажу, как легко и без насилия восполнять Вашу норму воды 💧
Спойлер: не нужно пить через силу. Всё проще, чем кажется 😉
Увидимся утром ☀️$msg$,
    FALSE, NULL, NULL, 0
);

-- ── DAY 3 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Water intake guide
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 3, '1', '10:00', 'always',
    $msg$Доброе утро! ☀️
Как и обещала, делюсь советами, которые помогут Вам выпивать свою норму воды легко и без напряжения 💧
📊 Исходя из Ваших данных, Ваша норма воды — {water_norm} литров в день.

1. Пейте равномерно 🕒
🥛 1 стакан сразу после пробуждения.
🥛 За 20–30 минут до каждого основного приёма пищи.
🥛 По несколько глотков каждые 30–60 минут.
🥛 За 1–2 часа до сна — умеренно, чтобы сон был спокойным.

2. Сделайте воду доступной 🚰
• Держите бутылку воды на столе, берите с собой.
• Выберите удобный объём (0,5–1 л) — так легче отслеживать прогресс.

3. Используйте напоминания 🔔
Я могу напоминать Вам о воде в приложении.
Функцию можно включить или отключить в любой момент.
✨ Лайфхак: привяжите глоток к действию: встали — глоток, сели за компьютер — глоток.

4. Улучшайте вкус без сахара 🍋
Добавляйте в воду:
🍋 лимон
🥒 огурец
🌱 мяту
🍓 ягоды
Чередуйте тёплую и прохладную воду — так пить не надоедает.

5. Ориентируйтесь на сигналы тела 🧠
✅ Светлая моча — признак хорошего баланса.
⚠️ Жажда, сухость во рту, усталость — повод сделать глоток прямо сейчас.

⚠️ Важно знать
🔸 Не нужно «заливать» норму за раз — это неэффективно.
🔸 При заболеваниях почек, сердца, а также во время беременности норму воды обязательно согласовывают с врачом.

💚 Резюме
Пить воду — просто, когда есть система.
Вы уже сделали первый шаг, узнав свою норму. Теперь дело за малым — внедрить привычку 🤍$msg$,
    TRUE, 'Включить напоминания о воде', 'enable_water_reminders', 0
);

-- ── DAY 4 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · 3-day nutrition summary + motivational fact
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 4, '1', '10:00', 'always',
    $msg$Доброе утро! ☀️
Я проанализировала Ваши приёмы пищи за последние 3 дня и подготовила персональную сводку 📊
Что удалось заметить:
🔹 Средняя калорийность: {avg_calories} ккал
🔹 Белки: {avg_protein} г | Жиры: {avg_fat} г | Углеводы: {avg_carbs} г
🔹 Вода: в среднем {avg_water} л в день
💡 Вывод:
{personalized_insight}

🧠 Небольшой, но важный факт:
В 80% случаев усталость и тяга к сладкому связаны не с «силой воли»,
а с дефицитами и несбалансированным питанием 🤍
Организм просто просит помочь ему восполнить ресурсы. И я знаю, как это сделать правильно.$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 2 · 12:00 · Offer to upload lab results
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 4, '2', '12:00', 'always',
    $msg$🩺 Есть свежие анализы? Посмотрим, чего не хватает
Чтобы быстро восполнить возможные пробелы, можно использовать добавки 🌿
Но! Сначала важно понять, каких витаминов действительно не хватает.

Просто сфотографируйте бланк и загрузите через приложение — я расшифрую его простыми словами и скажу, на что обратить внимание.
📝 Если анализов нет — не беда.
Вы можете описать здесь, что Вас беспокоит (усталость, ломкость ногтей, тяга к сладкому), и я дам общие рекомендации.$msg$,
    TRUE, 'Загрузить анализы', 'open_app', 0
);

-- ── DAY 5 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Ideal-day meal plan offer
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 5, '1', '10:00', 'always',
    $msg$🎯 Хотите увидеть Ваш идеальный день питания?

У меня теперь достаточно данных, чтобы не просто анализировать, а проектировать ✨
Хотите увидеть, как выглядит Ваш ИДЕАЛЬНЫЙ день питания — именно под Вашу цель и Ваши предпочтения? 🎯
Я соберу для Вас персональный сет:
🥣 завтрак
🥗 обед
🍎 перекус
🍲 ужин
— с конкретными блюдами и идеальным балансом КБЖУ.$msg$,
    TRUE, 'Да, покажи мой идеальный день', 'show_meal_plan', 0
);

-- Block 1.1 · event: user_replied_yes_to_meal_plan · Sample meal plan
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 5, '1.1', 'user_replied_yes_to_meal_plan', 'always',
    $msg$С удовольствием делюсь! 🤍
Ваш ИДЕАЛЬНЫЙ день (образец):
🥣 Завтрак: {sample_breakfast}
🥗 Обед: {sample_lunch}
🍎 Перекус: {sample_snack}
🍲 Ужин: {sample_dinner}
Всё подобрано под Ваши параметры, КБЖУ и вкусовые предпочтения.
Попробуйте — и почувствуете разницу в энергии и лёгкости 💪✨$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 2 · event: sample_meal_plan_shown · Upsell to full weekly plan
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 5, '2', 'sample_meal_plan_shown', 'always',
    $msg$А знаете, что самое интересное? 🤍
Этот идеальный день — всего 10% от моих возможностей.
По Вашему запросу я могу составить:
📅 Полноценный план питания на неделю
— с учётом разнообразия, сезонности продуктов и Вашей реальной загруженности.
🔄 И это не статичный документ.
Я буду адаптировать план под любые Ваши пожелания:
— устали от гречки? 🥲 → заменю на булгур.
— захотелось больше рыбы? 🐟 → легко.
— тренировка перенеслась? 🏋️‍♀️ → пересчитаю КБЖУ.$msg$,
    FALSE, NULL, NULL, 0
);

-- ── DAY 6 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Free question of the day
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 6, '1', '10:00', 'always',
    $msg$🎁 Ваш бесплатный вопрос дня — задайте ЛЮБОЙ
Сегодня у Вас есть возможность 🤍
Вы можете задать мне ЛЮБОЙ вопрос о питании, БАДах или анализах.
Я объясню всё простыми словами, честно и без воды.

Например:
🩺 «Какие анализы стоит сдать после зимы?»
☀️ «Всем ли нужен витамин D?»
☕️ «Можно ли пить кофе натощак?»
👇 Просто напишите свой вопрос в чат ✏️$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 2 · event: question_answered · Wrap-up + teaser for day 7
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 6, '2', 'question_answered', 'after_question_answered',
    $msg$💬 Рада была помочь! А теперь —
Знаете, что самое ценное?
Таких вопросов можно задавать без ограничений.
Это как Ваш личный нутрициолог в телефоне — всегда на связи, 24/7 🌸

А завтра — финальный день Вашего знакомства со мной.
И я подготовила кое-что особенное…
Ваш персональный итоговый отчёт за 6 дней 📊✨$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 3 · 20:00 · 6-day personal analytics report
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 6, '3', '20:00', 'always',
    $msg$📊 Ваш итоговый отчёт за 6 дней — главные выводы
Вот и прошло 6 дней нашего путешествия 🤍
Я проанализировала Ваши данные и подготовила персональный итоговый отчёт.

🎯 Ваша цель: {goal}
📉 Факт: {protein_insight}
🕰 Паттерн: {calorie_pattern}
💡 Главный инсайт: {main_insight}
⚠️ Потенциальный риск: {risk_insight}
🔮 Ваш следующий шаг: Получить персональный план питания и рекомендации по БАДам.$msg$,
    FALSE, NULL, NULL, 0
);

-- ── DAY 7 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Last trial day warning (message 1 of 2)
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 7, '1', '10:00', 'always',
    $msg$⚠️ Сегодня — последний день Вашей полной истории
Сегодня последний день, когда Вы видите свою полную историю питания, аналитику и инсайты.
Завтра она будет скрыта 🔒
Ваши наблюдения и открытия за 7 дней бесценны — не теряйте их! 🤍$msg$,
    FALSE, NULL, NULL, 0
);

-- Block 1 · 10:00 · Subscription pitch (message 2 of 2, same slot)
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 7, '1', '10:00', 'always',
    $msg$С подпиской — по цене кофе с шоколадкой ☕️🍫 — Вы получаете:
✅ Подсчёт КБЖУ по фото
🍽 Недельный рацион с рецептами
🌿 План БАДов на основе Ваших данных
💬 Чат с AI-нутрициологом без ограничений
📄 Анализ ЛЮБЫХ медицинских отчётов
Суммарная ценность: от 9000₽
Ваша цена: 499₽ 🤍
И если что, я не спишу деньги без вашего ведома$msg$,
    TRUE, 'Оформить подписку', 'subscribe', 1
);

-- Block 2 · 18:00 · Social proof
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 7, '2', '18:00', 'always',
    $msg$Кстати, вот что пишут наши прекрасные пользователи о Еве:
⭐️ «Честно говоря, я сначала расстроилась, когда поняла, что рацион мой такой себе... Но зато сейчас пришла стадия принятия, и я стала питаться лучше) и даже вкуснее!»
— Рита, 43 года, цель: похудение
💪 «Классно, удобно! То, что прям в телеге — вообще супер!»
— Андрей, 27 лет, цель: набор мышечной массы
✨ «Скептически относилась к ИИ, но сейчас не могу жить без советов Евы. Калории по фото для меня вообще волшебство какое-то!»
— Мария, 38 лет, цель: поддержание веса

Хотите так же? 🤍$msg$,
    TRUE, 'Оформить подписку', 'subscribe', 0
);

-- Block 3 · 22:00 · Soft close
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'active', 7, '3', '22:00', 'always',
    $msg$Я создана чтобы помогать, а не надоедать 🌸
Если сейчас не время — ничего страшного.
Вы всегда можете вернуться, когда будет удобно$msg$,
    TRUE, 'Оформить подписку', 'subscribe', 0
);

-- ============================================================
-- SEED: SLEEPING FUNNEL — 7-day re-engagement funnel
-- ============================================================

-- ── DAY 1 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Welcome
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 1, '1', '10:00', 'always',
    $msg$Здравствуйте!
Я Ева — Ваш персональный помощник по питанию и здоровью 🤍
Теперь вместе со мной Вы сможете:
✨  Считать КБЖУ — просто сделайте фото или напишите что вы съели
🩺 Интерпретация анализов – загрузите результаты медицинских анализов, и я дам понятные пояснения и рекомендации.
📋  Персональные планы питания – составлю для вас индивидуальный рацион с учетом ваших целей и предпочтений.
💬 Экспертная поддержка 24/7: Задавайте любые вопросы прямо здесь!
🚀 Чтобы начать, заполните Анкету.
Это займёт 2 минуты и поможет мне узнать Вас лучше.$msg$,
    TRUE, 'Заполнить Анкету', 'open_onboarding', 0
);

-- Block 1.1 · delay 3h · Push if onboarding not done
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, delay_hours, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 1, '1.1', 3, 'if_onboarding_incomplete',
    $msg$Для того, чтобы начать Ваш путь к здоровью, расскажите о ваших целях в приложении 🌿$msg$,
    TRUE, 'Продолжить', 'open_onboarding', 0
);

-- ── DAY 2 ────────────────────────────────────────────────────

-- Block 1 · 20:00 · No food logged nudge
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 2, '1', '20:00', 'if_no_food_logged',
    $msg$Привет ещё раз, {name}! 👋
Вижу, Вы пока не отправили мне ни одной тарелки 🙁
Не обязательно начинать с идеального блюда.

Отправьте через приложение ЛЮБОЙ свой следующий перекус или приём пищи.
Даже если это яблоко или бутерброд!
Даже если Вы не уверены, «правильно» ли Вы едите.
Обещаю: будет познавательно! ⚡️
Я не ругаю. Я просто помогаю увидеть то, что Вы раньше не замечали.$msg$,
    TRUE, 'Открыть приложение', 'open_app', 0
);

-- ── DAY 3 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · Free question invitation
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 3, '1', '10:00', 'always',
    $msg$🧠 Есть вопрос о питании? Спросите Еву
Сегодня Вам не нужно ничего фотографировать.
Вы можете просто спросить меня о том, что Вас волнует. 🎁
Напишите мне как нутрициологу — самым простым языком:
❓ «Почему я всё время хочу сладкого?»
❓ «Какой протеин выбрать?»
❓ «Правда ли, что глютен — это зло?»
Задайте один вопрос — и я отвечу максимально подробно, понятно и без заумных терминов.
Это Ваш бесплатный вопрос дня ✨
👇 Просто напишите в чат 👆$msg$,
    FALSE, NULL, NULL, 0
);

-- ── DAY 4 ────────────────────────────────────────────────────

-- Block 1 · 10:00 · 3 common nutrition mistakes
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 4, '1', '10:00', 'always',
    $msg$📊 3 ошибки в питании, которые совершают 80% людей
Возможно, Вам будет интересно это почитать 🤍
Я проанализировала данные тысяч пользователей и обнаружила 3 самых частых ошибки в питании:
🥤 1. Пить калории
Соки, сладкий кофе, газировка — Вы можете не есть, но при этом набирать вес.
🍕 2. Хронический переизбыток калорий
Даже «правильная» еда большими порциями даёт профицит.
🥩 3. Недостаток белка в рационе
Мышцы не растут, энергия падает, голод возвращается быстрее.

Если захотите — отправьте мне фото еды или напишите текстом, и мы вместе разберём, есть ли у Вас такие ошибки 🌸
Это бесплатно, быстро и без обязательств.
Кстати, EVA создана совместно с врачами и нутрициологами на базе искусственного интеллекта 👩‍⚕️👨‍⚕️
Поэтому рекомендации — не «шаблон», а персонализированный подход с учётом Вашей физиологии, целей и образа жизни 🤍$msg$,
    TRUE, 'Открыть приложение', 'open_app', 0
);

-- ── DAY 5 ────────────────────────────────────────────────────

-- Block 1 · 12:00 · Price justification + empathy
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 5, '1', '12:00', 'always',
    $msg$Знаете, {name}, я всё ещё здесь 🤍
Я не напоминаю Вам каждый день не потому, что жду идеального момента.
А потому что знаю: у каждого свой темп.
Может быть Вам интересно почему всего 499₽?
Потому что я — AI-помощник. Это не значит «хуже, чем человек». Это значит «всегда рядом, без очередей и за стоимость кофе с шоколадкой ✨
А знания, которые во мне заложены, — от лучших нутрициологов и врачей.$msg$,
    TRUE, 'Оформить подписку', 'subscribe', 0
);

-- ── DAY 6 ────────────────────────────────────────────────────

-- Block 1 · 11:00 · Social proof reviews
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 6, '1', '11:00', 'always',
    $msg$Кстати, вот что пишут наши прекрасные пользователи о Еве:
⭐️ «Честно говоря, я сначала расстроилась, когда поняла, что рацион мой такой себе... Но зато сейчас пришла стадия принятия, и я стала питаться лучше) и даже вкуснее!»
— Рита, 43 года, цель: похудение
💪 «Классно, удобно! То, что прям в телеге вообще супер»
— Андрей, 27 лет, цель: набор мышечной массы
✨ «Скептически относилась к ИИ, но сейчас не могу жить без советов Евы. Калории по фото для меня вообще волшебство какое-то 😂»
— Мария, 38 лет, цель: поддержание веса$msg$,
    TRUE, 'Оформить подписку', 'subscribe', 0
);

-- ── DAY 7 ────────────────────────────────────────────────────

-- Block 1 · 12:00 · Farewell message
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, send_time, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'sleeping', 7, '1', '12:00', 'always',
    $msg$💌 Это моё последнее сообщение Вам, {name}

Я долго думала, писать ли Вам снова.
Но решила: лучше написать и получить тишину, чем не написать и оставить Вас без поддержки 🤍
Это моё последнее сообщение Вам — не прощание, а «до встречи».
Если однажды Вы захотите:
• узнать, хватает ли Вашему организму белка
• понять свои анализы простыми словами
• питаться вкусно, полезно и без срывов
• просто спросить совета у того, кто не осуждает
— я буду здесь. Всегда 🌸
А пока — берегите себя.
Пейте воду, отдыхайте и не ругайте себя за пропущенный завтрак.$msg$,
    TRUE, 'Открыть приложение', 'open_app', 0
);

-- ============================================================
-- SEED: PAID FUNNEL — subscriber lifecycle messages
-- day_number = days since subscription start (NULL = recurring)
-- ============================================================

-- Weekly Monday report · trigger: weekly_report
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', NULL, '1', 'weekly_report', 'always',
    $msg$📊 Ваша неделя с EVA: прогресс и инсайты
{name}, смотрите, что я заметила за эту неделю:
✅ Вы съели на {protein_delta}% больше белка, чем на прошлой неделе
💧 Норма воды выполнена {water_days} дней из 7
🎯 Вы на {goal_progress}% ближе к Вашей цели
Вы молодец! 🤍$msg$,
    FALSE, NULL, NULL, 0
);

-- Day 14 · subscription milestone gift
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', 14, '1', 'subscription_day_14', 'always',
    $msg$🎁 Сюрприз от Евы!

{name}, Вы уже 2 недели со мной — это повод для подарка! 🎉
Я подготовила для Вас персональный рецепт недели, который:
• Вписывается в Ваши КБЖУ
• Готовится за 15 минут
• Подходит под Ваши вкусы (Вы же любите {favorite_food}!)$msg$,
    TRUE, 'Посмотреть рецепт', 'open_app', 0
);

-- Day 27 · renewal warning — 3 days before end of billing period
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', 27, '1', 'subscription_day_27', 'always',
    $msg$⏳ {name}, через 3 дня заканчивается Ваш месяц с EVA

{name}, спасибо Вам за этот месяц вместе 🤍
Ваша подписка заканчивается через 3 дня.
🍃 Никаких автоматических списаний
Я не храню Вашу карту. Деньги не спишутся без Вашего ведома.
Вам нужно сделать выбор:
✅ Продлить — если EVA была полезна, и Вы хотите продолжить путь к цели
❌ Ничего не делать — доступ закроется, но Ваши данные сохранятся$msg$,
    TRUE, 'Продлить подписку', 'subscribe', 0
);

-- Day 30 · successful renewal celebration
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', 30, '1', 'subscription_renewed', 'after_subscription',
    $msg$🎉 Спасибо, {name}! Мы начинаем второй месяц
Спасибо, что остаётесь со мной 🤍
Ваш подарок за доверие:
🔥 Персональный план на следующую неделю — я уже начала его собирать под Ваши новые данные.$msg$,
    TRUE, 'Открыть план питания', 'open_app', 0
);

-- Day 31 · subscription expired — data retention reassurance
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', 31, '1', 'subscription_expired', 'always',
    $msg$Сегодня заканчивается подписка 🙁
🌸 Я не удаляю Ваши данные.
Все Ваши записи, инсайты, прогресс — они здесь. Просто закрыты за экраном 🔒$msg$,
    TRUE, 'Восстановить доступ', 'subscribe', 0
);

-- Day 35 · win-back (user did not renew within 5 days of expiry)
INSERT INTO bot_funnel_messages
    (funnel_type, day_number, block_id, trigger_event, send_condition,
     message_text, has_button, button_text, button_action, sort_order)
VALUES (
    'paid', 35, '1', 'subscription_day_35_lapsed', 'always',
    $msg$💌 Просто захотела написать: Вы были замечательным пользователем 🤍
Если однажды снова захотите следить за питанием, разобрать анализы или просто спросить совета — я здесь.
Ваша Ева 🌸$msg$,
    TRUE, 'Открыть приложение', 'open_app', 0
);

