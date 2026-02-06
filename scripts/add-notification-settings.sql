-- Add notification settings columns to user_profiles table
-- Run this migration to add notification features

-- Add bank details columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN bank_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'bank_account_number'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN bank_account_number TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'bank_branch'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN bank_branch TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'bank_swift'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN bank_swift TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'pdf_primary_color'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN pdf_primary_color TEXT DEFAULT '#2563EB';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'pdf_accent_color'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN pdf_accent_color TEXT DEFAULT '#059669';
    END IF;
END $$;

-- Add notification settings columns
DO $$
BEGIN
    -- Long timer notification settings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'long_timer_enabled'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN long_timer_enabled BOOLEAN DEFAULT TRUE NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'long_timer_threshold'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN long_timer_threshold INTEGER DEFAULT 120 NOT NULL; -- 2 hours in minutes
    END IF;

    -- Daily reminder settings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'daily_reminder_enabled'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN daily_reminder_enabled BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'daily_reminder_time'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN daily_reminder_time TEXT DEFAULT '09:00' NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'last_reminder_date'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN last_reminder_date DATE;
    END IF;
END $$;
