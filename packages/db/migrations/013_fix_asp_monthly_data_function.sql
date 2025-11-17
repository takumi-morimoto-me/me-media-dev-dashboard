-- Fix get_asp_monthly_data to only use actuals table (not daily_actuals)
-- This prevents double-counting of monthly and daily data

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
    -- Get data from actuals table ONLY (monthly data)
    SELECT
        EXTRACT(YEAR FROM a.date)::integer AS item_year,
        EXTRACT(MONTH FROM a.date)::integer AS item_month,
        a.asp_id,
        asp.name AS asp_name,
        SUM(a.amount)::numeric AS actual
    FROM
        actuals a
    INNER JOIN
        asps asp ON a.asp_id = asp.id
    WHERE
        (p_media_id IS NULL OR a.media_id = p_media_id)
        AND a.date BETWEEN start_date AND end_date
        AND a.asp_id IS NOT NULL
    GROUP BY
        EXTRACT(YEAR FROM a.date)::integer,
        EXTRACT(MONTH FROM a.date)::integer,
        a.asp_id,
        asp.name
    ORDER BY
        item_year,
        item_month,
        asp.name;
END;
$$;
