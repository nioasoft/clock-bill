-- Add working_hours column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS working_hours REAL DEFAULT 8;
