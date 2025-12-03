-- Remove prompt column from asps table
-- This column is no longer used after migrating to scraper-based approach
--
-- Run this in Supabase SQL Editor

-- First, check if the column exists
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
