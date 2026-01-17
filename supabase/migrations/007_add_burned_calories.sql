-- Add burned_calories column to daily_stats
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS burned_calories INTEGER DEFAULT 0;
