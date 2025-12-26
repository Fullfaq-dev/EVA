# Миграция с Base44 на Supabase - Полное руководство

Это руководство поможет вам полностью мигрировать приложение с Base44 на Supabase.

## 📋 Что было сделано

### ✅ Структура базы данных
Создана полная схема базы данных в `/supabase/migrations/001_initial_schema.sql` со следующими таблицами:

1. **user_profiles** - Профили пользователей
2. **food_entries** - Записи о приёмах пищи
3. **analysis_uploads** - Загруженные анализы
4. **reminders** - Напоминания
5. **daily_stats** - Дневная статистика
6. **achievements** - Достижения

### ✅ API слой
- `src/api/supabaseClient.js` - Клиент Supabase
- `src/api/entities.js` - Работа с таблицами (CRUD операции)
- `src/api/functions.js` - Бизнес-логика (manageProfile, getFoodEntries, createFoodEntry и др.)
- `src/api/integrations.js` - Интеграции (загрузка файлов, LLM, email и др.)

### ✅ Обновлённые компоненты
Все компоненты обновлены для использования Supabase вместо Base44:
- Dashboard
- Onboarding
- FoodDiary
- Profile
- Analysis
- Stats

## 🚀 Шаги по установке

### Шаг 1: Создание проекта Supabase

1. Перейдите на [https://supabase.com](https://supabase.com)
2. Нажмите "Start your project"
3. Создайте новый проект (укажите название, пароль БД, регион)
4. Дождитесь создания проекта (2-3 минуты)

### Шаг 2: Настройка базы данных

1. В панели Supabase перейдите в **SQL Editor**
2. Создайте новый запрос
3. Скопируйте содержимое файла `supabase/migrations/001_initial_schema.sql`
4. Вставьте в редактор и нажмите **Run**
5. Убедитесь, что все таблицы созданы без ошибок

### Шаг 3: Настройка Storage (хранилище файлов)

1. Перейдите в раздел **Storage** в панели Supabase
2. Создайте два bucket'а:
   - `uploads` (public) - для фотографий еды
   - `private-uploads` (private) - для приватных файлов анализов

#### Создание публичного bucket для фотографий:
```sql
-- В SQL Editor выполните:
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true);
```

#### Создание приватного bucket для анализов:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-uploads', 'private-uploads', false);
```

#### Настройка политик доступа для uploads:
```sql
-- Разрешить всем загружать файлы
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');

-- Разрешить всем читать файлы
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');
```

### Шаг 4: Получение ключей API

1. Перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon public** key

### Шаг 5: Настройка переменных окружения

1. Создайте файл `.env` в корне проекта:
```bash
cp .env.example .env
```

2. Откройте `.env` и заполните значения:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Шаг 6: Установка зависимостей

```bash
# Удалите старые зависимости и установите новые
npm uninstall @base44/sdk
npm install @supabase/supabase-js@^2.39.0 @tanstack/react-query@^5.17.0
```

### Шаг 7: Удаление старых файлов Base44

```bash
# Можете удалить старый клиент Base44 (опционально, для чистоты)
rm src/api/base44Client.js
```

### Шаг 8: Запуск приложения

```bash
npm run dev
```

## 📊 Миграция данных из Base44

Если у вас уже есть данные в Base44, вам нужно экспортировать их и импортировать в Supabase.

### Экспорт данных из Base44

1. Зайдите в панель Base44
2. Экспортируйте данные из каждой таблицы в JSON/CSV формате

### Импорт данных в Supabase

Используйте SQL для вставки данных. Пример для пользователей:

```sql
INSERT INTO user_profiles (
  telegram_id,
  full_name,
  gender,
  height,
  weight,
  age,
  activity_level,
  goal,
  daily_calories,
  daily_protein,
  daily_fat,
  daily_carbs,
  water_norm,
  total_points,
  onboarding_completed
) VALUES
  ('123456789', 'Иван Иванов', 'male', 180, 75.5, 25, 'moderate', 'weight_loss', 2000, 150, 65, 200, 2500, 150, true),
  -- добавьте остальные записи
ON CONFLICT (telegram_id) DO NOTHING;
```

Или используйте Supabase Dashboard → Table Editor для ручного добавления/импорта.

## 🔧 Дополнительные настройки

### Настройка Row Level Security (RLS)

Текущая конфигурация использует открытые политики (`Allow all`). Для production рекомендуется настроить более строгие правила:

```sql
-- Пример: пользователь может видеть только свои данные
DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON user_profiles;

CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (telegram_id = current_setting('app.current_user_telegram_id', true));

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (telegram_id = current_setting('app.current_user_telegram_id', true));
```

### Настройка для Telegram Bot

Если у вас есть Telegram бот, который работал с Base44, обновите его для работы с Supabase:

1. Установите Supabase клиент в боте: `npm install @supabase/supabase-js`
2. Создайте клиент с **service_role** ключом (не anon!):

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Из Settings → API
)
```

3. Замените все вызовы Base44 на Supabase

## 🎯 Функции, требующие дополнительной реализации

### 1. LLM интеграция (анализ еды)

В `src/api/integrations.js` функция `InvokeLLM` пока заглушка. Варианты реализации:

**Вариант A: Supabase Edge Functions**
```bash
# Создайте Edge Function
supabase functions new analyze-food

# В функции используйте OpenAI API
```

**Вариант B: Прямой вызов OpenAI API из фронтенда**
```javascript
async InvokeLLM({ prompt }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return { response: data.choices[0].message.content };
}
```

### 2. Email уведомления

Supabase имеет встроенную систему email, но для кастомных писем:

**Вариант A: Resend (рекомендуется)**
```bash
npm install resend
```

**Вариант B: Supabase Edge Function + любой email провайдер**

### 3. OCR для анализов (ExtractDataFromUploadedFile)

Используйте:
- Google Vision API
- AWS Textract
- Azure Computer Vision

Пример с Edge Function:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { fileUrl } = await req.json()
  
  // Вызов Google Vision API
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GOOGLE_API_KEY')}`
    },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: fileUrl } },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
      }]
    })
  })
  
  const data = await response.json()
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  })
})
```

## 🔐 Безопасность

### Production чеклист:

- [ ] Настроить строгие RLS политики
- [ ] Использовать service_role ключ только на backend
- [ ] Включить Email verification (если используете Supabase Auth)
- [ ] Настроить CORS для вашего домена
- [ ] Регулярно делать бэкапы БД
- [ ] Мониторить использование API (Supabase Dashboard → Usage)

## 📱 Деплой приложения

### Vercel (рекомендуется для Vite)

```bash
# Установите Vercel CLI
npm i -g vercel

# Деплой
vercel

# Добавьте переменные окружения в Vercel Dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

### Netlify

```bash
# Создайте netlify.toml
cat > netlify.toml << EOF
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOF

# Деплой
netlify deploy --prod
```

### Собственный сервер

```bash
# Build
npm run build

# Файлы в папке dist/ готовы к деплою
# Используйте nginx/apache для раздачи статики
```

## 🐛 Troubleshooting

### Ошибка: "Missing Supabase credentials"
- Проверьте, что `.env` создан и содержит правильные значения
- Перезапустите dev сервер после создания `.env`

### Ошибка загрузки файлов
- Убедитесь, что bucket'ы созданы
- Проверьте политики доступа к storage
- Для публичных файлов bucket должен быть public

### Ошибка "relation does not exist"
- Выполните миграцию SQL снова
- Проверьте, что вы подключены к правильному проекту

### CORS ошибки
- В Supabase Dashboard → Settings → API → CORS добавьте ваш домен

## 📚 Полезные ссылки

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## ✅ Финальная проверка

После миграции проверьте:
- [ ] Регистрация нового пользователя
- [ ] Сохранение профиля
- [ ] Добавление записи о еде
- [ ] Загрузка фото
- [ ] Просмотр статистики
- [ ] Загрузка анализов
- [ ] Напоминания работают

## 🎉 Готово!

Теперь ваше приложение полностью работает на Supabase и независимо от Base44!

Если возникли вопросы - проверьте логи в браузере (console) и Supabase Dashboard (Logs & Analytics).
