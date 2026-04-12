-- Fix activity_level CHECK constraint to include 'very_active'
-- The original constraint in 001_initial_schema.sql only allowed ('sedentary', 'moderate', 'active')
-- but the UI exposes a 4th option 'very_active' which caused a constraint violation on registration.

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_activity_level_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_activity_level_check
  CHECK (activity_level IN ('sedentary', 'moderate', 'active', 'very_active'));
