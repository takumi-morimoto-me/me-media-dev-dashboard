-- Remove unused columns from asps table
-- Run this in Supabase SQL Editor
--
-- Columns to remove:
-- 1. prompt - no longer used after migrating to scraper-based approach
-- 2. has_recaptcha - redundant with recaptcha_status

-- Remove prompt column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'asps'
        AND column_name = 'prompt'
    ) THEN
        ALTER TABLE asps DROP COLUMN prompt;
        RAISE NOTICE 'Column prompt has been dropped from asps table';
    ELSE
        RAISE NOTICE 'Column prompt does not exist in asps table';
    END IF;
END $$;

-- Remove has_recaptcha column (redundant with recaptcha_status)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'asps'
        AND column_name = 'has_recaptcha'
    ) THEN
        ALTER TABLE asps DROP COLUMN has_recaptcha;
        RAISE NOTICE 'Column has_recaptcha has been dropped from asps table';
    ELSE
        RAISE NOTICE 'Column has_recaptcha does not exist in asps table';
    END IF;
END $$;
