-- Create a function to get ASP-based monthly financial data
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
    WITH combined_actuals AS (
        -- Get data from actuals table
        SELECT
            EXTRACT(YEAR FROM a.date)::integer AS year,
            EXTRACT(MONTH FROM a.date)::integer AS month,
            a.asp_id,
            a.amount
        FROM
            actuals a
        WHERE
            (p_media_id IS NULL OR a.media_id = p_media_id)
            AND a.date BETWEEN start_date AND end_date
            AND a.asp_id IS NOT NULL

        UNION ALL

        -- Get data from daily_actuals table
        SELECT
            EXTRACT(YEAR FROM da.date)::integer AS year,
            EXTRACT(MONTH FROM da.date)::integer AS month,
            da.asp_id,
            da.amount
        FROM
            daily_actuals da
        WHERE
            (p_media_id IS NULL OR da.media_id = p_media_id)
            AND da.date BETWEEN start_date AND end_date
            AND da.asp_id IS NOT NULL
    )
    SELECT
        ca.year AS item_year,
        ca.month AS item_month,
        ca.asp_id,
        asp.name AS asp_name,
        SUM(ca.amount)::numeric AS actual
    FROM
        combined_actuals ca
    INNER JOIN
        asps asp ON ca.asp_id = asp.id
    GROUP BY
        ca.year,
        ca.month,
        ca.asp_id,
        asp.name
    ORDER BY
        item_year,
        item_month,
        asp.name;
END;
$$;
