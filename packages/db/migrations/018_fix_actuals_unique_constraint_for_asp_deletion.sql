-- Fix unique constraint issue when deleting ASPs
-- The problem: When an ASP is deleted, ON DELETE SET NULL sets asp_id to NULL,
-- but if there's already a record with NULL asp_id for the same (date, media_id, account_item_id),
-- it violates the unique constraint.
--
-- Solution: Change from ON DELETE SET NULL to ON DELETE CASCADE
-- This ensures that when an ASP is deleted, related actuals records are also deleted
-- to maintain data integrity.

-- Step 1: Drop the existing foreign key constraint on actuals.asp_id
ALTER TABLE public.actuals
DROP CONSTRAINT IF EXISTS actuals_asp_id_fkey;

-- Step 2: Re-add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.actuals
ADD CONSTRAINT actuals_asp_id_fkey
FOREIGN KEY (asp_id) REFERENCES public.asps(id) ON DELETE CASCADE;

-- Step 3: Do the same for daily_actuals table
ALTER TABLE public.daily_actuals
DROP CONSTRAINT IF EXISTS daily_actuals_asp_id_fkey;

ALTER TABLE public.daily_actuals
ADD CONSTRAINT daily_actuals_asp_id_fkey
FOREIGN KEY (asp_id) REFERENCES public.asps(id) ON DELETE CASCADE;
