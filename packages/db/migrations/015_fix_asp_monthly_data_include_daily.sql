-- Fix get_asp_monthly_data to include both actuals and daily_actuals tables
-- This ensures daily scraped data is included in ASP monthly reports

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
    -- Combine data from both actuals and daily_actuals tables
    WITH combined_data AS (
        -- Get data from actuals table (monthly data)
        SELECT
            EXTRACT(YEAR FROM a.date)::integer AS item_year,
            EXTRACT(MONTH FROM a.date)::integer AS item_month,
            a.asp_id,
            asp.name AS asp_name,
            a.amount
        FROM
            actuals a
        INNER JOIN
            asps asp ON a.asp_id = asp.id
        WHERE
            (p_media_id IS NULL OR a.media_id = p_media_id)
            AND a.date BETWEEN start_date AND end_date
            AND a.asp_id IS NOT NULL

        UNION ALL

        -- Get data from daily_actuals table and aggregate by month
        SELECT
            EXTRACT(YEAR FROM da.date)::integer AS item_year,
            EXTRACT(MONTH FROM da.date)::integer AS item_month,
            da.asp_id,
            asp.name AS asp_name,
            da.amount
        FROM
            daily_actuals da
        INNER JOIN
            asps asp ON da.asp_id = asp.id
        WHERE
            (p_media_id IS NULL OR da.media_id = p_media_id)
            AND da.date BETWEEN start_date AND end_date
            AND da.asp_id IS NOT NULL
    )
    SELECT
        cd.item_year,
        cd.item_month,
        cd.asp_id,
        cd.asp_name,
        SUM(cd.amount)::numeric AS actual
    FROM
        combined_data cd
    GROUP BY
        cd.item_year,
        cd.item_month,
        cd.asp_id,
        cd.asp_name
    ORDER BY
        item_year,
        item_month,
        asp_name;
END;
$$;
