-- Fix get_asp_monthly_data to include both actuals and daily_actuals tables
-- This makes it consistent with get_financial_monthly_data which also combines both tables
-- The data is grouped by (year, month, asp_id) so there won't be duplicates in the output

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
    WITH combined_data AS (
        -- Get data from actuals table (monthly)
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

        UNION ALL

        -- Get data from daily_actuals table
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
    )
    SELECT
        cd.year AS item_year,
        cd.month AS item_month,
        cd.asp AS asp_id,
        asp.name AS asp_name,
        SUM(cd.amount)::numeric AS actual
    FROM
        combined_data cd
    INNER JOIN
        asps asp ON cd.asp = asp.id
    GROUP BY
        cd.year,
        cd.month,
        cd.asp,
        asp.name
    ORDER BY
        item_year,
        item_month,
        asp_name;
END;
$$;
