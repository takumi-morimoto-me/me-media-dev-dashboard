-- Add UNIQUE constraints to prevent duplicate records in actuals and daily_actuals tables

-- Drop existing constraints if they exist
ALTER TABLE actuals DROP CONSTRAINT IF EXISTS actuals_unique_constraint;
ALTER TABLE daily_actuals DROP CONSTRAINT IF EXISTS daily_actuals_unique_constraint;

-- Add UNIQUE constraint to actuals table
ALTER TABLE actuals
ADD CONSTRAINT actuals_unique_constraint
UNIQUE (date, media_id, account_item_id, asp_id);

-- Add UNIQUE constraint to daily_actuals table
ALTER TABLE daily_actuals
ADD CONSTRAINT daily_actuals_unique_constraint
UNIQUE (date, media_id, account_item_id, asp_id);
