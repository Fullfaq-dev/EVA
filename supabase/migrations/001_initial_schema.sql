-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female')),
    height INTEGER,
    weight DECIMAL(5,2),
    age INTEGER,
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'moderate', 'active')),
    goal TEXT CHECK (goal IN ('gut_health', 'weight_loss', 'muscle_gain', 'maintenance')),
    problems TEXT,
    daily_calories INTEGER,
    daily_protein INTEGER,
    daily_fat INTEGER,
    daily_carbs INTEGER,
    water_norm INTEGER,
    total_points INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food Entries Table
CREATE TABLE food_entries (
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
CREATE TABLE analysis_uploads (
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
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('water', 'exercise', 'food_photo')),
    enabled BOOLEAN DEFAULT TRUE,
    interval_hours INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Stats Table
CREATE TABLE daily_stats (
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
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    earned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_food_entries_user_telegram_id ON food_entries(user_telegram_id);
CREATE INDEX idx_food_entries_created_date ON food_entries(created_date DESC);
CREATE INDEX idx_analysis_uploads_user_telegram_id ON analysis_uploads(user_telegram_id);
CREATE INDEX idx_analysis_uploads_created_date ON analysis_uploads(created_date DESC);
CREATE INDEX idx_reminders_user_telegram_id ON reminders(user_telegram_id);
CREATE INDEX idx_daily_stats_user_telegram_id ON daily_stats(user_telegram_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX idx_achievements_user_telegram_id ON achievements(user_telegram_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now - you can restrict based on authentication later)
CREATE POLICY "Allow all operations on user_profiles" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Allow all operations on food_entries" ON food_entries FOR ALL USING (true);
CREATE POLICY "Allow all operations on analysis_uploads" ON analysis_uploads FOR ALL USING (true);
CREATE POLICY "Allow all operations on reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Allow all operations on daily_stats" ON daily_stats FOR ALL USING (true);
CREATE POLICY "Allow all operations on achievements" ON achievements FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
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
