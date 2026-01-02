-- Добавление полей BMI и weight_status в таблицу user_profiles
ALTER TABLE user_profiles 
ADD COLUMN bmi DECIMAL(4,1),
ADD COLUMN weight_status TEXT CHECK (weight_status IN ('underweight', 'normal', 'overweight', 'obese'));

-- Комментарии для документации
COMMENT ON COLUMN user_profiles.bmi IS 'Body Mass Index, рассчитывается автоматически при обновлении профиля';
COMMENT ON COLUMN user_profiles.weight_status IS 'Весовая категория: underweight (BMI < 18.5), normal (18.5-25), overweight (25-30), obese (>= 30)';
