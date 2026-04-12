-- Гарантируем наличие полей подписки (на случай если migration 008 не применялась)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_subscription_active BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- Функция-триггер: автоматически выдаёт 7-дневный пробный период при создании нового профиля
CREATE OR REPLACE FUNCTION assign_trial_on_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Выставляем trial только если подписка не передана явно или передана как FALSE/NULL
    IF NEW.is_subscription_active IS NULL OR NEW.is_subscription_active = FALSE THEN
        NEW.is_subscription_active := TRUE;
        NEW.subscription_end_date := NOW() + INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем триггер если уже существует, затем создаём заново
DROP TRIGGER IF EXISTS assign_trial_trigger ON user_profiles;

CREATE TRIGGER assign_trial_trigger
    BEFORE INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_trial_on_new_profile();
