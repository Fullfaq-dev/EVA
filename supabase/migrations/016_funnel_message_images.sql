-- Funnel message images (Telegram sendPhoto — direct HTTPS URLs)

-- ── ACTIVE ───────────────────────────────────────────────────

-- Д4: анализы / витамины
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/jqTKFrF8/Snimok-ekrana-2026-05-16-v-20-52-20.png'
WHERE funnel_type = 'active' AND day_number = 4 AND block_id = '2';

-- Д5: идеальный день питания
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/76VRRjCr/Snimok-ekrana-2026-05-16-v-20-53-37.png'
WHERE funnel_type = 'active' AND day_number = 5 AND block_id = '1';

-- Д7: подписка (sort_order 1 — второе утреннее сообщение)
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/sD1Ln63d/Snimok-ekrana-2026-05-16-v-20-54-33.png'
WHERE funnel_type = 'active' AND day_number = 7 AND block_id = '1' AND sort_order = 1;

-- Д7: отзывы 18:00
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/7Z0mcjcn/Snimok-ekrana-2026-05-16-v-20-55-53.png'
WHERE funnel_type = 'active' AND day_number = 7 AND block_id = '2';

-- ── SLEEPING ─────────────────────────────────────────────────

-- Д4: 3 ошибки в питании
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/VkqW4nrp/Snimok-ekrana-2026-05-16-v-20-57-25.png'
WHERE funnel_type = 'sleeping' AND day_number = 4 AND block_id = '1';

-- Д5: почему 490₽
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/qBNYwDJR/Snimok-ekrana-2026-05-16-v-20-58-11.png'
WHERE funnel_type = 'sleeping' AND day_number = 5 AND block_id = '1';

-- Д6: отзывы (та же картинка, что active Д7 block 2)
UPDATE bot_funnel_messages SET
    image_url = 'https://i.postimg.cc/7Z0mcjcn/Snimok-ekrana-2026-05-16-v-20-55-53.png'
WHERE funnel_type = 'sleeping' AND day_number = 6 AND block_id = '1';
