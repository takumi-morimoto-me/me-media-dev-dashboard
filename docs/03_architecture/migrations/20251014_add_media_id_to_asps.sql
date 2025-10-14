-- Migration: Add media_id to asps table and improve constraints
-- Date: 2025-10-14
-- Purpose:
--   1. Add media_id column to track which media each ASP belongs to
--   2. Remove category column (not needed for MVP)
--   3. Add NOT NULL constraints for required fields
--   4. Update UNIQUE constraint to prevent duplicate ASP names per media
--   5. Add updated_at column for tracking changes

-- Step 1: Add new columns
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.media(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Step 2: Set NOT NULL constraints for existing nullable columns
-- Note: Ensure existing data has values before running these
-- For now, we'll keep them nullable until data is populated
-- ALTER TABLE public.asps ALTER COLUMN login_url SET NOT NULL;
-- ALTER TABLE public.asps ALTER COLUMN prompt SET NOT NULL;
-- ALTER TABLE public.asps ALTER COLUMN media_id SET NOT NULL;

-- Step 3: Remove category column (not needed)
ALTER TABLE public.asps
DROP COLUMN IF EXISTS category;

-- Step 4: Update UNIQUE constraint
-- Drop old constraint (name only)
ALTER TABLE public.asps
DROP CONSTRAINT IF EXISTS asps_name_key;

-- Add new constraint (name + media_id)
-- Note: This will fail if there are existing duplicate (name, media_id) pairs
-- ALTER TABLE public.asps
-- ADD CONSTRAINT asps_name_media_key UNIQUE (name, media_id);

-- Step 5: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_asps_media_id ON public.asps(media_id);

-- Step 6: Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_asps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_asps_updated_at ON public.asps;
CREATE TRIGGER trigger_asps_updated_at
    BEFORE UPDATE ON public.asps
    FOR EACH ROW
    EXECUTE FUNCTION update_asps_updated_at();

-- Notes for manual steps:
-- 1. Populate media_id for existing ASP records
-- 2. Ensure login_url and prompt have values for all records
-- 3. Once data is clean, uncomment and run the NOT NULL and UNIQUE constraint statements above
