-- This script reverts the database functions to their state before the recent changes.
-- Please apply this to your database manually to complete the rollback.

-- 1. Drop the incorrectly created functions
DROP FUNCTION IF EXISTS get_all_media_financial_monthly_data(integer);
DROP FUNCTION IF EXISTS get_all_media_financial_daily_data(integer);

-- 2. Revert get_financial_monthly_data to its original state
CREATE OR REPLACE FUNCTION get_financial_monthly_data(p_media_id uuid, p_fiscal_year integer)
RETURNS TABLE (
    item_year integer,
    item_month integer,
    account_item_id uuid,
    budget numeric,
    actual numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    fiscal_year_start_month integer;
    start_date date;
    end_date date;
BEGIN
    -- Get fiscal year start month from settings
    SELECT value::integer INTO fiscal_year_start_month
    FROM public.app_settings
    WHERE key = 'fiscal_year_start_month'
    LIMIT 1;
    fiscal_year_start_month := COALESCE(fiscal_year_start_month, 6);

    -- Calculate start and end dates for the fiscal year
    IF fiscal_year_start_month = 1 THEN
        start_date := make_date(p_fiscal_year, 1, 1);
    ELSE
        start_date := make_date(p_fiscal_year, fiscal_year_start_month, 1);
    END IF;
    end_date := start_date + interval '1 year' - interval '1 day';

    RETURN QUERY
    WITH budget_data AS (
        SELECT
            EXTRACT(YEAR FROM b.date)::integer AS year,
            EXTRACT(MONTH FROM b.date)::integer AS month,
            b.account_item_id,
            SUM(b.amount)::numeric AS budget,
            0::numeric AS actual
        FROM
            budgets b
        WHERE
            (p_media_id IS NULL OR b.media_id = p_media_id)
            AND b.date BETWEEN start_date AND end_date
        GROUP BY EXTRACT(YEAR FROM b.date), EXTRACT(MONTH FROM b.date), b.account_item_id
    ),
    actual_data AS (
        SELECT
            EXTRACT(YEAR FROM a.date)::integer AS year,
            EXTRACT(MONTH FROM a.date)::integer AS month,
            a.account_item_id,
            0::numeric AS budget,
            SUM(a.amount)::numeric AS actual
        FROM
            actuals a
        WHERE
            (p_media_id IS NULL OR a.media_id = p_media_id)
            AND a.date BETWEEN start_date AND end_date
        GROUP BY EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date), a.account_item_id
    ),
    combined_data AS (
        SELECT * FROM budget_data
        UNION ALL
        SELECT * FROM actual_data
    )
    SELECT
        cd.year AS item_year,
        cd.month AS item_month,
        cd.account_item_id,
        SUM(cd.budget) AS budget,
        SUM(cd.actual) AS actual
    FROM
        combined_data cd
    GROUP BY
        cd.year,
        cd.month,
        cd.account_item_id
    ORDER BY
        cd.year,
        cd.month,
        cd.account_item_id;
END;
$$;

-- 3. Revert get_financial_daily_data to its original state
CREATE OR REPLACE FUNCTION get_financial_daily_data(p_media_id uuid, p_fiscal_year integer)
RETURNS TABLE (
    item_date date,
    account_item_id uuid,
    budget numeric,
    actual numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    fiscal_year_start_month integer;
    start_date date;
    end_date date;
BEGIN
    -- Get fiscal year start month from settings
    SELECT value::integer INTO fiscal_year_start_month
    FROM public.app_settings
    WHERE key = 'fiscal_year_start_month'
    LIMIT 1;
    fiscal_year_start_month := COALESCE(fiscal_year_start_month, 6);

    -- Calculate start and end dates for the fiscal year
    IF fiscal_year_start_month = 1 THEN
        start_date := make_date(p_fiscal_year, 1, 1);
    ELSE
        start_date := make_date(p_fiscal_year, fiscal_year_start_month, 1);
    END IF;
    end_date := start_date + interval '1 year' - interval '1 day';

    RETURN QUERY
    WITH budget_data AS (
        SELECT
            db.date,
            db.account_item_id,
            SUM(db.amount)::numeric AS budget,
            0::numeric AS actual
        FROM
            daily_budgets db
        WHERE
            (p_media_id IS NULL OR db.media_id = p_media_id)
            AND db.date BETWEEN start_date AND end_date
        GROUP BY db.date, db.account_item_id
    ),
    actual_data AS (
        SELECT
            da.date,
            da.account_item_id,
            0::numeric AS budget,
            SUM(da.amount)::numeric AS actual
        FROM
            daily_actuals da
        WHERE
            (p_media_id IS NULL OR da.media_id = p_media_id)
            AND da.date BETWEEN start_date AND end_date
        GROUP BY da.date, da.account_item_id
    ),
    combined_data AS (
        SELECT * FROM budget_data
        UNION ALL
        SELECT * FROM actual_data
    )
    SELECT
        cd.date AS item_date,
        cd.account_item_id,
        SUM(cd.budget) AS budget,
        SUM(cd.actual) AS actual
    FROM
        combined_data cd
    GROUP BY
        cd.date,
        cd.account_item_id
    ORDER BY
        cd.date,
        cd.account_item_id;
END;
$$;
