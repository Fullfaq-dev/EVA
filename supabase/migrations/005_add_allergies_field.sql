-- Add allergies field to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS allergies TEXT;
