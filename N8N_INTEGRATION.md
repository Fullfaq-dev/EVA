# 🔗 Интеграция с n8n для AI анализа еды

## 📋 Обзор

При добавлении фотографии еды, приложение автоматически отправляет вебхуки на n8n для AI анализа. После обработки, n8n обновляет данные в Supabase.

## 🔄 Поток данных

```
1. Пользователь загружает фото еды в приложение
   ↓
2. Фото загружается в Supabase Storage
   ↓
3. Создаётся запись в food_entries (calories=0, protein=0, fat=0, carbs=0)
   ↓
4. Отправляются webhook'и на n8n:
   - https://lavaproject.zeabur.app/webhook/food (production)
   - https://lavaproject.zeabur.app/webhook-test/food (test)
   ↓
5. n8n обрабатывает фото через AI
   ↓
6. n8n обновляет запись в Supabase через API или callback
   ↓
7. Приложение подхватывает обновлённые данные (React Query auto-refresh)
```

## 📤 Формат исходящего webhook (приложение → n8n)

### Endpoint
- **Production:** `https://lavaproject.zeabur.app/webhook/food`
- **Test:** `https://lavaproject.zeabur.app/webhook-test/food`

### Method
`POST`

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Payload
```json
{
  "entry_id": "uuid-записи-в-food_entries",
  "telegram_id": "123456789",
  "description": "Описание блюда от пользователя",
  "meal_type": "breakfast|lunch|dinner|snack",
  "photo_url": "https://xxxxx.supabase.co/storage/v1/object/public/uploads/filename.jpg",
  "created_date": "2024-01-15T12:30:00.000Z",
  "timestamp": "2024-01-15T12:30:05.123Z"
}
```

### Пример
```json
{
  "entry_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "telegram_id": "987654321",
  "description": "Овсянка с бананом и мёдом",
  "meal_type": "breakfast",
  "photo_url": "https://abcdef.supabase.co/storage/v1/object/public/uploads/1706184605123-oatmeal.jpg",
  "created_date": "2024-01-25T08:30:05.000Z",
  "timestamp": "2024-01-25T08:30:10.456Z"
}
```

## 📥 Формат входящих данных (n8n → Supabase)

После AI анализа, n8n должен обновить запись в Supabase напрямую через Supabase API.

### Вариант 1: Прямое обновление через Supabase REST API

```http
POST https://your-project.supabase.co/rest/v1/food_entries?id=eq.{entry_id}
Headers:
  apikey: your-supabase-anon-key
  Authorization: Bearer your-supabase-anon-key
  Content-Type: application/json
  Prefer: return=representation

Body:
{
  "calories": 320,
  "protein": 12.5,
  "fat": 8.2,
  "carbs": 48.3
}
```

### Вариант 2: Через Edge Function (если создадите)

```http
POST https://your-project.supabase.co/functions/v1/update-food-nutrition
Headers:
  apikey: your-supabase-anon-key
  Authorization: Bearer your-supabase-anon-key
  Content-Type: application/json

Body:
{
  "entry_id": "uuid",
  "calories": 320,
  "protein": 12.5,
  "fat": 8.2,
  "carbs": 48.3,
  "analysis_text": "Овсянка с бананом - полезный завтрак, богатый углеводами..."
}
```

## 🛠️ Настройка n8n workflow

### Шаг 1: Webhook Trigger
```
Webhook Node:
- HTTP Method: POST
- Path: /webhook/food (или /webhook-test/food)
- Response Mode: Immediately
```

### Шаг 2: AI Analysis
```
HTTP Request или OpenAI Node:
- Provider: OpenAI / Anthropic / Google Vision
- Model: gpt-4-vision / claude-3 / gemini-pro-vision
- Prompt: "Analyze this food image and return JSON with calories, protein, fat, carbs"
```

Пример промпта:
```
Analyze this food image and provide nutritional information in JSON format:
{
  "calories": number,
  "protein": number (grams),
  "fat": number (grams),
  "carbs": number (grams),
  "description": "detailed description of the dish"
}

Image URL: {{ $json.photo_url }}
User description: {{ $json.description }}
```

### Шаг 3: Update Supabase
```
HTTP Request Node:
- Method: PATCH
- URL: https://your-project.supabase.co/rest/v1/food_entries?id=eq.{{ $json.entry_id }}
- Headers:
    apikey: {{ $credentials.supabase.anonKey }}
    Authorization: Bearer {{ $credentials.supabase.anonKey }}
    Content-Type: application/json
    Prefer: return=representation
- Body:
    {
      "calories": {{ $json.ai_response.calories }},
      "protein": {{ $json.ai_response.protein }},
      "fat": {{ $json.ai_response.fat }},
      "carbs": {{ $json.ai_response.carbs }}
    }
```

### Шаг 4: Update Daily Stats (опционально)
После обновления food_entries, можно автоматически пересчитать daily_stats.

## 🔐 Безопасность

### В приложении
Webhook URL хранятся в `.env` и не компилируются в production build:
```env
VITE_N8N_FOOD_WEBHOOK_URL=https://lavaproject.zeabur.app/webhook/food
VITE_N8N_FOOD_WEBHOOK_TEST_URL=https://lavaproject.zeabur.app/webhook-test/food
```

### В n8n
Рекомендуется добавить авторизацию:
1. **Header Auth:** Проверять секретный токен
2. **IP Whitelist:** Ограничить доступ к webhook
3. **HMAC Signature:** Подписывать payload

Пример с токеном:
```javascript
// В src/api/functions.js добавить:
headers: {
  'Content-Type': 'application/json',
  'X-Webhook-Secret': import.meta.env.VITE_N8N_WEBHOOK_SECRET
}

// В n8n проверять:
if (request.headers['x-webhook-secret'] !== 'your-secret-token') {
  return { error: 'Unauthorized' };
}
```

## 📊 Мониторинг

### Логи в приложении
```javascript
// Уже добавлены в src/api/functions.js
console.log('Food analysis webhook sent to production:', webhookUrl);
console.log('Food analysis webhook sent to test:', webhookTestUrl);
```

### Логи в n8n
- n8n Dashboard → Executions
- Проверяйте успешность обработки
- Смотрите ошибки AI анализа

### Логи в Supabase
- Table Editor → food_entries (проверяйте обновления calories/protein/fat/carbs)
- Logs & Analytics → API logs

## 🧪 Тестирование

### 1. Проверка отправки webhook
```bash
# Откройте DevTools в браузере
# Network → Filter: webhook
# Загрузите фото еды
# Должны увидеть 2 POST запроса:
# - webhook/food
# - webhook-test/food
```

### 2. Проверка получения в n8n
```bash
# В n8n откройте workflow
# Нажмите "Execute Workflow"
# Загрузите фото в приложении
# Проверьте, что workflow выполнился
```

### 3. Проверка обновления в Supabase
```sql
-- В Supabase SQL Editor
SELECT * FROM food_entries 
ORDER BY created_date DESC 
LIMIT 10;

-- Проверьте, что calories, protein, fat, carbs обновились
```

## 🐛 Troubleshooting

### Webhook не отправляется
- ✅ Проверьте `.env` файл
- ✅ Убедитесь что переменные начинаются с `VITE_`
- ✅ Перезапустите dev сервер после изменения `.env`

### n8n не получает данные
- ✅ Проверьте URL webhook в n8n
- ✅ Убедитесь что workflow активен
- ✅ Проверьте CORS настройки

### Данные не обновляются в Supabase
- ✅ Проверьте Supabase API keys в n8n
- ✅ Проверьте RLS политики таблицы food_entries
- ✅ Проверьте формат данных от AI (должны быть числа, не строки)

### AI возвращает неверные данные
- ✅ Улучшите промпт для AI
- ✅ Добавьте валидацию результатов
- ✅ Используйте более точную модель (gpt-4-vision вместо gpt-3.5)

## 📝 Пример полного n8n workflow

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "webhook/food",
        "responseMode": "responseNode",
        "httpMethod": "POST"
      }
    },
    {
      "name": "OpenAI Vision",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "operation": "message",
        "model": "gpt-4-vision-preview",
        "messages": {
          "values": [
            {
              "content": "=Analyze this food image and return ONLY a valid JSON object with this exact structure: {\"calories\": number, \"protein\": number, \"fat\": number, \"carbs\": number}. Image: {{ $json.photo_url }}. Description: {{ $json.description }}"
            }
          ]
        }
      }
    },
    {
      "name": "Parse JSON",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "code": "const ai_response = JSON.parse($input.first().json.message.content);\nreturn { json: { ...items[0].json, ...ai_response } };"
      }
    },
    {
      "name": "Update Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "PATCH",
        "url": "=https://your-project.supabase.co/rest/v1/food_entries?id=eq.{{ $json.entry_id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "apikey", "value": "={{ $credentials.supabase.anonKey }}"},
            {"name": "Authorization", "value": "=Bearer {{ $credentials.supabase.anonKey }}"},
            {"name": "Prefer", "value": "return=representation"}
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {"name": "calories", "value": "={{ $json.calories }}"},
            {"name": "protein", "value": "={{ $json.protein }}"},
            {"name": "fat", "value": "={{ $json.fat }}"},
            {"name": "carbs", "value": "={{ $json.carbs }}"}
          ]
        }
      }
    },
    {
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { success: true, entry_id: $json.entry_id } }}"
      }
    }
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "OpenAI Vision"}]]},
    "OpenAI Vision": {"main": [[{"node": "Parse JSON"}]]},
    "Parse JSON": {"main": [[{"node": "Update Supabase"}]]},
    "Update Supabase": {"main": [[{"node": "Respond to Webhook"}]]}
  }
}
```

## ✅ Checklist

- [ ] n8n workflow создан и активирован
- [ ] Webhook URL добавлен в `.env`
- [ ] OpenAI/Anthropic API key настроен в n8n
- [ ] Supabase credentials настроены в n8n
- [ ] Протестирована отправка фото
- [ ] Данные обновляются в Supabase
- [ ] Daily stats пересчитываются корректно

---

**Готово!** Теперь при загрузке фото еды, AI автоматически проанализирует изображение и обновит КБЖУ в базе данных! 🎉
