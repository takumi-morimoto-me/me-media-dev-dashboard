-- Create a function to get ASP-based daily financial data
CREATE OR REPLACE FUNCTION get_asp_daily_data(p_media_id uuid, p_fiscal_year integer)
RETURNS TABLE (
    item_date date,
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
    SELECT
        da.date AS item_date,
        da.asp_id,
        asp.name AS asp_name,
        SUM(da.amount)::numeric AS actual
    FROM
        daily_actuals da
    INNER JOIN
        asps asp ON da.asp_id = asp.id
    WHERE
        (p_media_id IS NULL OR da.media_id = p_media_id)
        AND da.date BETWEEN start_date AND end_date
        AND da.asp_id IS NOT NULL
    GROUP BY
        da.date,
        da.asp_id,
        asp.name
    ORDER BY
        da.date,
        asp.name;
END;
$$;
