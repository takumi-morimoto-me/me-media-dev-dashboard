-- Update the import function to expand monthly data into daily tables
CREATE OR REPLACE FUNCTION import_financial_data(p_media_id uuid, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    parent_item_id uuid;
    child_item_id uuid;
    val jsonb;
    item_year integer;
    item_month integer;
    month_start_date date;
    month_end_date date;
    daily_budget_amount integer;
    daily_actual_amount integer;
    days_in_month integer;
BEGIN
    -- Loop through each item object in the JSON array
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Step 1: Upsert the parent account item
        INSERT INTO public.account_items (name, media_id, parent_id)
        VALUES (item->>'parent', p_media_id, NULL)
        ON CONFLICT (name, media_id) WHERE parent_id IS NULL
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO parent_item_id;

        -- Step 2: Upsert the child account item
        INSERT INTO public.account_items (name, media_id, parent_id)
        VALUES (item->>'account_item', p_media_id, parent_item_id)
        ON CONFLICT (name, media_id, parent_id)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO child_item_id;

        -- Step 3: Loop through the 'values' array
        FOR val IN SELECT * FROM jsonb_array_elements(item->'values')
        LOOP
            item_year := (val->>'year')::integer;
            item_month := (val->>'month')::integer;

            -- Calculate start and end dates of the month
            month_start_date := make_date(item_year, item_month, 1);
            month_end_date := (month_start_date + interval '1 month - 1 day')::date;
            days_in_month := EXTRACT(DAY FROM month_end_date);

            -- Step 3a: Expand budget data into daily records
            IF val->'budget' IS NOT NULL AND val->>'budget' != 'null' THEN
                -- Calculate daily budget amount (evenly distributed across the month)
                daily_budget_amount := ((val->>'budget')::numeric / days_in_month)::integer;

                -- Delete existing daily budget data for this month
                DELETE FROM public.daily_budgets
                WHERE media_id = p_media_id
                  AND account_item_id = child_item_id
                  AND date >= month_start_date
                  AND date <= month_end_date;

                -- Insert daily budget records using generate_series
                INSERT INTO public.daily_budgets (date, amount, media_id, account_item_id)
                SELECT
                    d::date,
                    daily_budget_amount,
                    p_media_id,
                    child_item_id
                FROM generate_series(month_start_date, month_end_date, '1 day'::interval) AS d;

                -- Also update the monthly budgets table for backward compatibility
                INSERT INTO public.budgets (date, amount, media_id, account_item_id)
                VALUES (month_start_date, (val->>'budget')::integer, p_media_id, child_item_id)
                ON CONFLICT (date, media_id, account_item_id)
                DO UPDATE SET amount = EXCLUDED.amount;
            END IF;

            -- Step 3b: Expand actual data into daily records
            IF val->'actual' IS NOT NULL AND val->>'actual' != 'null' THEN
                -- Calculate daily actual amount (evenly distributed across the month)
                daily_actual_amount := ((val->>'actual')::numeric / days_in_month)::integer;

                -- Delete existing daily actual data for this month
                DELETE FROM public.daily_actuals
                WHERE media_id = p_media_id
                  AND account_item_id = child_item_id
                  AND date >= month_start_date
                  AND date <= month_end_date
                  AND asp_id IS NULL;

                -- Insert daily actual records using generate_series
                INSERT INTO public.daily_actuals (date, amount, media_id, account_item_id, asp_id)
                SELECT
                    d::date,
                    daily_actual_amount,
                    p_media_id,
                    child_item_id,
                    NULL
                FROM generate_series(month_start_date, month_end_date, '1 day'::interval) AS d;

                -- Also update the monthly actuals table for backward compatibility
                INSERT INTO public.actuals (date, amount, media_id, account_item_id, asp_id)
                VALUES (month_start_date, (val->>'actual')::integer, p_media_id, child_item_id, NULL)
                ON CONFLICT (date, media_id, account_item_id) WHERE asp_id IS NULL
                DO UPDATE SET amount = EXCLUDED.amount;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
