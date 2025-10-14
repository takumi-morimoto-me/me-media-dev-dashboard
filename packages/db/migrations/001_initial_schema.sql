-- メディアDevダッシュボード - 初期スキーマ
-- データベース設計書に基づいたテーブル作成

-- 1. media テーブル
CREATE TABLE IF NOT EXISTS public.media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. account_items テーブル
CREATE TABLE IF NOT EXISTS public.account_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_id uuid REFERENCES public.account_items(id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    display_order integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. asps テーブル
CREATE TABLE IF NOT EXISTS public.asps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    category text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. users テーブル (auth.usersと連携)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    role text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. user_media_assignments テーブル (多対多中間テーブル)
CREATE TABLE IF NOT EXISTS public.user_media_assignments (
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    media_id uuid REFERENCES public.media(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, media_id)
);

-- 6. budgets テーブル
CREATE TABLE IF NOT EXISTS public.budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    amount integer NOT NULL,
    media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    account_item_id uuid NOT NULL REFERENCES public.account_items(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, media_id, account_item_id)
);

-- 7. actuals テーブル
CREATE TABLE IF NOT EXISTS public.actuals (
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

-- インデックス作成 (パフォーマンス最適化)
CREATE INDEX IF NOT EXISTS idx_account_items_media_id ON public.account_items(media_id);
CREATE INDEX IF NOT EXISTS idx_account_items_parent_id ON public.account_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_budgets_date ON public.budgets(date);
CREATE INDEX IF NOT EXISTS idx_budgets_media_id ON public.budgets(media_id);
CREATE INDEX IF NOT EXISTS idx_actuals_date ON public.actuals(date);
CREATE INDEX IF NOT EXISTS idx_actuals_media_id ON public.actuals(media_id);
CREATE INDEX IF NOT EXISTS idx_actuals_asp_id ON public.actuals(asp_id);

-- RLS (Row Level Security) の有効化
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_media_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actuals ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: 認証済みユーザーは全てのデータを読み取り可能
CREATE POLICY "Allow authenticated users to read media"
    ON public.media FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read account_items"
    ON public.account_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read asps"
    ON public.asps FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read budgets"
    ON public.budgets FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read actuals"
    ON public.actuals FOR SELECT
    TO authenticated
    USING (true);

-- RLS ポリシー: 管理者のみがデータを変更可能 (将来的に詳細化)
CREATE POLICY "Allow admin to manage media"
    ON public.media FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Allow admin to manage account_items"
    ON public.account_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Allow admin to manage asps"
    ON public.asps FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Allow users to manage budgets"
    ON public.budgets FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow users to manage actuals"
    ON public.actuals FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actuals_updated_at BEFORE UPDATE ON public.actuals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
