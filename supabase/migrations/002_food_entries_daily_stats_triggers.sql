-- ============================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО СУММИРОВАНИЯ КБЖУ
-- ============================================
-- Эта миграция добавляет автоматическое обновление daily_stats
-- при добавлении, изменении или удалении записей из food_entries
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

-- ============================================
-- ГОТОВО! 🎉
-- ============================================
-- Теперь при любом изменении в food_entries:
-- ✅ INSERT - автоматически обновляется daily_stats
-- ✅ UPDATE - пересчитывается для новой и старой даты
-- ✅ DELETE - пересчитывается daily_stats
-- ============================================
