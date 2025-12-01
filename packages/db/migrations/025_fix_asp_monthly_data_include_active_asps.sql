-- Fix get_asp_monthly_data to include all active ASPs linked to the media
-- Even if they don't have actual data yet, they should appear in the table
-- This ensures that ASPs marked as "稼働中" in the agent page are visible in the table view

CREATE OR REPLACE FUNCTION get_asp_monthly_data(p_media_id uuid, p_fiscal_year integer)
RETURNS TABLE (
    item_year integer,
    item_month integer,
    asp_id uuid,
    asp_name text,
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
    WITH
    -- Get all active ASPs linked to the media
    active_asps AS (
        SELECT DISTINCT
            asp.id AS asp_id,
            asp.name AS asp_name
        FROM
            asps asp
        INNER JOIN
            asp_credentials ac ON asp.id = ac.asp_id
        WHERE
            asp.is_active = true
            AND (p_media_id IS NULL OR ac.media_id = p_media_id)
    ),
    -- Generate all months in the fiscal year
    months AS (
        SELECT
            EXTRACT(YEAR FROM d)::integer AS year,
            EXTRACT(MONTH FROM d)::integer AS month
        FROM
            generate_series(start_date, end_date, '1 month'::interval) AS d
    ),
    -- Cross join to get all ASP-month combinations
    asp_months AS (
        SELECT
            m.year,
            m.month,
            aa.asp_id,
            aa.asp_name
        FROM
            months m
        CROSS JOIN
            active_asps aa
    ),
    -- Get data from actuals table (monthly)
    actuals_data AS (
        SELECT
            EXTRACT(YEAR FROM a.date)::integer AS year,
            EXTRACT(MONTH FROM a.date)::integer AS month,
            a.asp_id AS asp,
            SUM(a.amount)::numeric AS amount
        FROM
            actuals a
        WHERE
            (p_media_id IS NULL OR a.media_id = p_media_id)
            AND a.date BETWEEN start_date AND end_date
            AND a.asp_id IS NOT NULL
        GROUP BY
            EXTRACT(YEAR FROM a.date)::integer,
            EXTRACT(MONTH FROM a.date)::integer,
            a.asp_id
    ),
    -- Get data from daily_actuals table
    daily_data AS (
        SELECT
            EXTRACT(YEAR FROM da.date)::integer AS year,
            EXTRACT(MONTH FROM da.date)::integer AS month,
            da.asp_id AS asp,
            SUM(da.amount)::numeric AS amount
        FROM
            daily_actuals da
        WHERE
            (p_media_id IS NULL OR da.media_id = p_media_id)
            AND da.date BETWEEN start_date AND end_date
            AND da.asp_id IS NOT NULL
        GROUP BY
            EXTRACT(YEAR FROM da.date)::integer,
            EXTRACT(MONTH FROM da.date)::integer,
            da.asp_id
    ),
    -- Combine actuals and daily_actuals
    combined_data AS (
        SELECT year, month, asp, amount FROM actuals_data
        UNION ALL
        SELECT year, month, asp, amount FROM daily_data
    ),
    -- Aggregate combined data by year, month, asp
    aggregated_data AS (
        SELECT
            cd.year,
            cd.month,
            cd.asp,
            SUM(cd.amount)::numeric AS amount
        FROM
            combined_data cd
        GROUP BY
            cd.year, cd.month, cd.asp
    )
    -- Final result: all active ASP-month combinations with actual data (or 0 if no data)
    SELECT
        am.year AS item_year,
        am.month AS item_month,
        am.asp_id AS asp_id,
        am.asp_name AS asp_name,
        COALESCE(ad.amount, 0)::numeric AS actual
    FROM
        asp_months am
    LEFT JOIN
        aggregated_data ad ON am.year = ad.year AND am.month = ad.month AND am.asp_id = ad.asp
    ORDER BY
        item_year,
        item_month,
        asp_name;
END;
$$;
