-- ============================================
-- ПОЛНАЯ АВТОМАТИЧЕСКАЯ УСТАНОВКА SUPABASE
-- ============================================
-- Скопируйте весь этот файл и выполните в SQL Editor
-- ============================================

-- 1. СОЗДАНИЕ ТАБЛИЦ
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female')),
    height INTEGER,
    weight DECIMAL(5,2),
    age INTEGER,
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'moderate', 'active', 'very_active')),
    goal TEXT CHECK (goal IN ('gut_health', 'weight_loss', 'muscle_gain', 'maintenance')),
    problems TEXT,
    daily_calories INTEGER,
    daily_protein INTEGER,
    daily_fat INTEGER,
    daily_carbs INTEGER,
    water_norm INTEGER,
    total_points INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    is_subscription_active BOOLEAN DEFAULT FALSE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food Entries Table
CREATE TABLE IF NOT EXISTS food_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    description TEXT,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    photo_url TEXT,
    calories INTEGER DEFAULT 0,
    protein DECIMAL(6,2) DEFAULT 0,
    fat DECIMAL(6,2) DEFAULT 0,
    carbs DECIMAL(6,2) DEFAULT 0,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis Uploads Table
CREATE TABLE IF NOT EXISTS analysis_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('pdf', 'image')),
    analysis_name TEXT NOT NULL,
    supplements_recommendation TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('water', 'exercise', 'food_photo')),
    enabled BOOLEAN DEFAULT TRUE,
    interval_hours INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Stats Table
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_calories INTEGER DEFAULT 0,
    total_protein DECIMAL(6,2) DEFAULT 0,
    total_fat DECIMAL(6,2) DEFAULT 0,
    total_carbs DECIMAL(6,2) DEFAULT 0,
    water_glasses INTEGER DEFAULT 0,
    exercises_done INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_telegram_id, date)
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    earned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. СОЗДАНИЕ ИНДЕКСОВ
-- ============================================

CREATE INDEX IF NOT EXISTS idx_food_entries_user_telegram_id ON food_entries(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_created_date ON food_entries(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_uploads_user_telegram_id ON analysis_uploads(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_analysis_uploads_created_date ON analysis_uploads(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_user_telegram_id ON reminders(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_telegram_id ON daily_stats(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_user_telegram_id ON achievements(user_telegram_id);

-- 3. ФУНКЦИИ ДЛЯ AUTO-UPDATE
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. ТРИГГЕРЫ
-- ============================================

-- Drop triggers if exist
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_food_entries_updated_at ON food_entries;
DROP TRIGGER IF EXISTS update_analysis_uploads_updated_at ON analysis_uploads;
DROP TRIGGER IF EXISTS update_reminders_updated_at ON reminders;
DROP TRIGGER IF EXISTS update_daily_stats_updated_at ON daily_stats;

-- Create triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_entries_updated_at BEFORE UPDATE ON food_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_uploads_updated_at BEFORE UPDATE ON analysis_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON daily_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО СУММИРОВАНИЯ КБЖУ
-- ============================================

-- Функция для пересчета статистики за день
CREATE OR REPLACE FUNCTION recalculate_daily_stats(
    p_user_telegram_id TEXT,
    p_date DATE
)
RETURNS void AS $$
DECLARE
    v_total_calories INTEGER;
    v_total_protein DECIMAL(6,2);
    v_total_fat DECIMAL(6,2);
    v_total_carbs DECIMAL(6,2);
BEGIN
    -- Суммируем все записи о еде за указанную дату
    SELECT
        COALESCE(SUM(calories), 0),
        COALESCE(SUM(protein), 0),
        COALESCE(SUM(fat), 0),
        COALESCE(SUM(carbs), 0)
    INTO
        v_total_calories,
        v_total_protein,
        v_total_fat,
        v_total_carbs
    FROM food_entries
    WHERE user_telegram_id = p_user_telegram_id
        AND DATE(created_date) = p_date;

    -- Вставляем или обновляем запись в daily_stats
    INSERT INTO daily_stats (
        user_telegram_id,
        date,
        total_calories,
        total_protein,
        total_fat,
        total_carbs
    ) VALUES (
        p_user_telegram_id,
        p_date,
        v_total_calories,
        v_total_protein,
        v_total_fat,
        v_total_carbs
    )
    ON CONFLICT (user_telegram_id, date)
    DO UPDATE SET
        total_calories = EXCLUDED.total_calories,
        total_protein = EXCLUDED.total_protein,
        total_fat = EXCLUDED.total_fat,
        total_carbs = EXCLUDED.total_carbs,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Функция-триггер для INSERT и UPDATE food_entries
CREATE OR REPLACE FUNCTION trigger_update_daily_stats_on_food_entry_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Пересчитываем статистику для новой/измененной записи
    PERFORM recalculate_daily_stats(
        NEW.user_telegram_id,
        DATE(NEW.created_date)
    );
    
    -- Если дата изменилась при UPDATE, пересчитываем и старую дату
    IF TG_OP = 'UPDATE' AND DATE(OLD.created_date) != DATE(NEW.created_date) THEN
        PERFORM recalculate_daily_stats(
            OLD.user_telegram_id,
            DATE(OLD.created_date)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция-триггер для DELETE food_entries
CREATE OR REPLACE FUNCTION trigger_update_daily_stats_on_food_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Пересчитываем статистику после удаления записи
    PERFORM recalculate_daily_stats(
        OLD.user_telegram_id,
        DATE(OLD.created_date)
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Удаляем триггеры если они уже существуют
DROP TRIGGER IF EXISTS food_entry_insert_update_trigger ON food_entries;
DROP TRIGGER IF EXISTS food_entry_delete_trigger ON food_entries;

-- Создаем триггер на INSERT и UPDATE
CREATE TRIGGER food_entry_insert_update_trigger
    AFTER INSERT OR UPDATE ON food_entries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_daily_stats_on_food_entry_change();

-- Создаем триггер на DELETE
CREATE TRIGGER food_entry_delete_trigger
    AFTER DELETE ON food_entries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_daily_stats_on_food_entry_delete();

-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if exist
DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations on food_entries" ON food_entries;
DROP POLICY IF EXISTS "Allow all operations on analysis_uploads" ON analysis_uploads;
DROP POLICY IF EXISTS "Allow all operations on reminders" ON reminders;
DROP POLICY IF EXISTS "Allow all operations on daily_stats" ON daily_stats;
DROP POLICY IF EXISTS "Allow all operations on achievements" ON achievements;

-- Create policies (открытые для начала, потом можно настроить строже)
CREATE POLICY "Allow all operations on user_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on food_entries" ON food_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on analysis_uploads" ON analysis_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on daily_stats" ON daily_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on achievements" ON achievements FOR ALL USING (true) WITH CHECK (true);

-- 7. STORAGE BUCKETS
-- ============================================

-- Создаем public bucket для фото еды
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

-- Создаем private bucket для медицинских анализов
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-uploads',
  'private-uploads',
  false,
  104857600, -- 100MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 8. STORAGE POLICIES
-- ============================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow private uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow private reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow private deletes" ON storage.objects;

-- Public bucket policies (uploads)
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'uploads');

-- Private bucket policies (private-uploads)
CREATE POLICY "Allow private uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'private-uploads');

CREATE POLICY "Allow private reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'private-uploads');

CREATE POLICY "Allow private deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'private-uploads');

-- 9. ТЕСТОВЫЕ ДАННЫЕ (опционально)
-- ============================================

-- Раскомментируйте если нужны тестовые данные
/*
-- Тестовый пользователь
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
) VALUES (
  '123456789',
  'Тестовый Пользователь',
  'male',
  180,
  75.5,
  25,
  'moderate',
  'weight_loss',
  2000,
  150,
  65,
  200,
  2500,
  0,
  true
) ON CONFLICT (telegram_id) DO NOTHING;

-- Тестовая запись о еде
INSERT INTO food_entries (
  user_telegram_id,
  description,
  meal_type,
  calories,
  protein,
  fat,
  carbs
) VALUES (
  '123456789',
  'Овсянка с бананом',
  'breakfast',
  350,
  12,
  8,
  55
);

-- Тестовая статистика за сегодня
INSERT INTO daily_stats (
  user_telegram_id,
  date,
  total_calories,
  total_protein,
  total_fat,
  total_carbs,
  water_glasses,
  exercises_done,
  points_earned
) VALUES (
  '123456789',
  CURRENT_DATE,
  350,
  12,
  8,
  55,
  2,
  0,
  15
) ON CONFLICT (user_telegram_id, date) DO NOTHING;
*/

-- 10. ПРОВЕРКА УСТАНОВКИ
-- ============================================

-- Проверим что все таблицы созданы
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_profiles',
    'food_entries',
    'analysis_uploads',
    'reminders',
    'daily_stats',
    'achievements'
  )
ORDER BY tablename;

-- Проверим что storage buckets созданы
SELECT 
  id,
  name,
  public,
  file_size_limit
FROM storage.buckets
WHERE id IN ('uploads', 'private-uploads');

-- ============================================
-- ГОТОВО! 🎉
-- ============================================
-- Если все запросы выполнились успешно:
-- ✅ Все таблицы созданы
-- ✅ Индексы добавлены
-- ✅ Триггеры для автоматического суммирования КБЖУ настроены
-- ✅ RLS политики настроены
-- ✅ Storage buckets созданы
-- ✅ Storage policies настроены
-- ============================================
