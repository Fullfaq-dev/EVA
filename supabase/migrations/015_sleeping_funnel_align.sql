-- Align sleeping funnel copy with product spec.

-- DAY 1 welcome
UPDATE bot_funnel_messages SET
    message_text = $msg$Здравствуйте!
Я Ева — Ваш персональный помощник по питанию и здоровью 🤍
Теперь вместе со мной Вы сможете:
✨  Считать КБЖУ — просто сделайте фото или напишите что вы съели
🩺 Интерпретация анализов – загрузите результаты медицинских анализов, и я дам понятные пояснения и рекомендации.
📋  Персональные планы питания – составлю для вас индивидуальный рацион с учетом ваших целей и предпочтений.
💬 ИИ Нутрициолог 24/7: Задавайте любые вопросы прямо здесь!
🚀 Чтобы начать, заполните Анкету.
Это займёт 2 минуты и поможет мне узнать Вас лучше.$msg$,
    has_button = TRUE,
    button_text = 'Заполнить Анкету',
    button_action = 'open_onboarding'
WHERE funnel_type = 'sleeping' AND day_number = 1 AND block_id = '1';

-- DAY 2 evening nudge (no button per spec)
UPDATE bot_funnel_messages SET
    message_text = $msg$Привет ещё раз, {name}! 👋
Вижу, Вы пока не отправили мне ни одной тарелки 🙁
Не обязательно начинать с идеального блюда.

Отправьте ЛЮБОЙ свой следующий перекус или приём пищи.
Даже если это яблоко или бутерброд!
Даже если Вы не уверены, «правильно» ли Вы едите.
Обещаю: будет познавательно! ⚡️
Я не ругаю. Я просто помогаю увидеть то, что Вы раньше не замечали.$msg$,
    has_button = FALSE,
    button_text = NULL,
    button_action = NULL
WHERE funnel_type = 'sleeping' AND day_number = 2 AND block_id = '1';

-- DAY 4 — no app button in spec
UPDATE bot_funnel_messages SET
    has_button = FALSE,
    button_text = NULL,
    button_action = NULL,
    image_url = 'https://i.postimg.cc/VkqW4nrp/Snimok-ekrana-2026-05-16-v-20-57-25.png'
WHERE funnel_type = 'sleeping' AND day_number = 4 AND block_id = '1';

-- DAY 5 price pitch
UPDATE bot_funnel_messages SET
    message_text = $msg$Может быть Вам интересно почему всего 490₽?
Потому что я — AI-помощник. Это не значит «хуже, чем человек». Это значит «всегда рядом, без очередей и за стоимость кофе с шоколадкой ✨
А знания, которые во мне заложены, — от лучших нутрициологов и врачей.$msg$,
    has_button = FALSE,
    button_text = NULL,
    button_action = NULL,
    image_url = 'https://i.postimg.cc/qBNYwDJR/Snimok-ekrana-2026-05-16-v-20-58-11.png'
WHERE funnel_type = 'sleeping' AND day_number = 5 AND block_id = '1';

-- DAY 6 reviews (no button)
UPDATE bot_funnel_messages SET
    has_button = FALSE,
    button_text = NULL,
    button_action = NULL,
    image_url = 'https://i.postimg.cc/7Z0mcjcn/Snimok-ekrana-2026-05-16-v-20-55-53.png'
WHERE funnel_type = 'sleeping' AND day_number = 6 AND block_id = '1';

-- DAY 7 farewell
UPDATE bot_funnel_messages SET
    message_text = $msg$💌 Это моё последнее сообщение Вам, {name}

Я долго думала, писать ли Вам снова.
Но решила: лучше написать и получить тишину, чем не написать и оставить Вас без поддержки 🤍
Если однажды Вы захотите:
• узнать, хватает ли Вашему организму белка
• понять свои анализы простыми словами
• питаться вкусно, полезно и без срывов
• просто спросить совета у того, кто не осуждает

Пейте воду, отдыхайте и не ругайте себя за пропущенный завтрак 🤍$msg$,
    has_button = TRUE,
    button_text = 'Открыть приложение',
    button_action = 'open_app'
WHERE funnel_type = 'sleeping' AND day_number = 7 AND block_id = '1';
