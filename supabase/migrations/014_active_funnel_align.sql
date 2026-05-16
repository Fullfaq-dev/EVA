-- Align active funnel copy with product spec + optional message images.
-- image_url: public HTTPS URL or Telegram file_id; can also set via Vercel env FUNNEL_IMAGE_ACTIVE_D*_B*_S*

ALTER TABLE bot_funnel_messages
    ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN bot_funnel_messages.image_url IS
    'Optional photo for sendPhoto. Override via FUNNEL_IMAGE_{FUNNEL}_D{day}_B{block}_S{sort} env.';

-- ── DAY 1 ────────────────────────────────────────────────────

UPDATE bot_funnel_messages SET
    message_text = $msg$Давайте познакомимся?
Расскажите о ваших целях в приложении 🌿
Обещаю, это не займет много времени$msg$,
    has_button = TRUE,
    button_text = 'Заполнить Анкету',
    button_action = 'open_onboarding'
WHERE funnel_type = 'active' AND day_number = 1 AND block_id = '1.1';

UPDATE bot_funnel_messages SET
    message_text = $msg$Спасибо, что заполнили Анкету, {name} 💗
Я внимательно изучила её и теперь буду давать рекомендации, опираясь именно на Ваши цели 🎯
🔹 Основная цель: {goal}
🔹 Норма КБЖУ в день: {kbju_norm}
🔹 Норма воды в день: {water_norm} 💧

Теперь Вы можете внести первый приём пищи!
Отправьте мне фото или просто напишите в чат 🥦$msg$
WHERE funnel_type = 'active' AND day_number = 1 AND block_id = '2';

UPDATE bot_funnel_messages SET
    message_text = $msg$EVA создана совместно с врачами и нутрициологами на базе искусственного интеллекта 👩‍⚕️👨‍⚕️
Поэтому мои рекомендации — не «шаблон», а персонализированный подход с учётом Вашей физиологии, целей и образа жизни.

И кстати, целую неделю у Вас будет доступ к возможностям EVA — чтобы Вы успели познакомиться с функционалом и ощутить реальную пользу 💚$msg$
WHERE funnel_type = 'active' AND day_number = 1 AND block_id = '3';

-- ── DAY 2 ────────────────────────────────────────────────────

UPDATE bot_funnel_messages SET
    message_text = $msg$Доброе утро ☀️
Сфотографируйте Ваш завтрак — я расскажу о нём всё: калории, белки, жиры, углеводы 💡
Если не любите фотографировать — просто напишите что Вы съели ✏️$msg$,
    has_button = FALSE,
    button_text = NULL,
    button_action = NULL
WHERE funnel_type = 'active' AND day_number = 2 AND block_id = '1';

UPDATE bot_funnel_messages SET
    message_text = $msg$Супер! Первый день вместе позади 🎉
Думаю, сегодня Вы узнали кое-что новое о своём привычном рационе. Даже небольшие открытия — это большой шаг к изменениям 🤍
А завтра я расскажу, как легко и без насилия восполнять Вашу норму воды 💧
Спойлер: не нужно пить через силу. Всё проще, чем кажется 😉
Увидимся утром ☀️$msg$
WHERE funnel_type = 'active' AND day_number = 2 AND block_id = '2';

-- ── DAY 4 block 2 — анализы (длинный текст; image_url или FUNNEL_IMAGE_ACTIVE_D4_B2_S0) ──

UPDATE bot_funnel_messages SET
    message_text = $msg$🧪 Есть свежие анализы? Давайте подберём витамины!

Часто усталость, тяга к сладкому или выпадение волос — не «особенности организма», а конкретные дефициты.
Но покупать добавки наугад — выбрасывать деньги. Сначала нужно понять, чего именно не хватает.
В полном доступе к Еве будет неограниченный доступ к этой функции!
📸 Отправьте фото бланка с анализами

Ева расшифрует и объяснит:
— Какие показатели в норме, а где риск дефицита
— Какие витамины и минералы стоит добавить (с дозировками и формами)
— С чем именно лучше сходить к врачу
🌿 Нет анализов? Не проблема
Опишите, что вас беспокоит:
«усталость», «ломкие ногти», «тянет на сладкое», «сухая кожа»

Ева даст общие рекомендации, и подскажет, что сдать в первую очередь!

🎯 Результат:
— Никаких лишних баночек
— Никаких догадок
— Чёткий план: что пить, в какой дозе, как долго$msg$,
    has_button = TRUE,
    button_text = 'Получить полный доступ',
    button_action = 'subscribe',
    image_url = 'https://i.postimg.cc/jqTKFrF8/Snimok-ekrana-2026-05-16-v-20-52-20.png'
WHERE funnel_type = 'active' AND day_number = 4 AND block_id = '2';

-- ── DAY 5 block 1 — идеальный день ──

UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/76VRRjCr/Snimok-ekrana-2026-05-16-v-20-53-37.png'
WHERE funnel_type = 'active' AND day_number = 5 AND block_id = '1';

-- ── DAY 7 ────────────────────────────────────────────────────

UPDATE bot_funnel_messages SET
    message_text = $msg$С подпиской, по цене кофе с шоколадкой ☕️🍫 — Вы получаете:

✅ Подсчёт КБЖУ по фото
✅ Недельные планы питания с рецептами
✅ План БАДов на основе Ваших данных
✅ Анализ ЛЮБЫХ медицинских отчётов
✅ Чат с AI-нутрициологом без ограничений

Ваша цена: 490₽ 🤍
Суммарная ценность: от 9000₽

И никаких списаний без Вашего ведома, ведь я не храню данные карты$msg$,
    image_url = 'https://i.postimg.cc/sD1Ln63d/Snimok-ekrana-2026-05-16-v-20-54-33.png'
WHERE funnel_type = 'active' AND day_number = 7 AND block_id = '1' AND sort_order = 1;

UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/7Z0mcjcn/Snimok-ekrana-2026-05-16-v-20-55-53.png'
WHERE funnel_type = 'active' AND day_number = 7 AND block_id = '2';

UPDATE bot_funnel_messages SET
    message_text = $msg$Я создана чтобы помогать, а не надоедать 🌸
Если сейчас не время — ничего страшного.
Вы всегда можете вернуться, когда будет удобно$msg$
WHERE funnel_type = 'active' AND day_number = 7 AND block_id = '3';
