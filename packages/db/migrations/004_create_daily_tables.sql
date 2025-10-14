-- Create daily_budgets table for storing daily budget data
CREATE TABLE IF NOT EXISTS public.daily_budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    amount integer NOT NULL,
    media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    account_item_id uuid NOT NULL REFERENCES public.account_items(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, media_id, account_item_id)
);

-- Create daily_actuals table for storing daily actual data
CREATE TABLE IF NOT EXISTS public.daily_actuals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    amount integer NOT NULL,
    media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    account_item_id uuid NOT NULL REFERENCES public.account_items(id) ON DELETE CASCADE,
    asp_id uuid REFERENCES public.asps(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, media_id, account_item_id, asp_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_budgets_date ON public.daily_budgets(date);
CREATE INDEX IF NOT EXISTS idx_daily_budgets_media_id ON public.daily_budgets(media_id);
CREATE INDEX IF NOT EXISTS idx_daily_budgets_account_item_id ON public.daily_budgets(account_item_id);
CREATE INDEX IF NOT EXISTS idx_daily_actuals_date ON public.daily_actuals(date);
CREATE INDEX IF NOT EXISTS idx_daily_actuals_media_id ON public.daily_actuals(media_id);
CREATE INDEX IF NOT EXISTS idx_daily_actuals_account_item_id ON public.daily_actuals(account_item_id);
CREATE INDEX IF NOT EXISTS idx_daily_actuals_asp_id ON public.daily_actuals(asp_id);
