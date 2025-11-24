-- マイグレーション: ASPテーブルとASP認証情報テーブルにRLSポリシーを追加
-- 作成日: 2025-11-24
-- 説明: asps と asp_credentials テーブルに対する全操作を許可するポリシーを追加

-- asps テーブルの既存ポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Enable all operations for asps" ON public.asps;

-- asp_credentials テーブルの既存ポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Enable all operations for asp_credentials" ON public.asp_credentials;

-- asps テーブルに対する全操作を許可するポリシーを作成
CREATE POLICY "Enable all operations for asps" ON public.asps
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- asp_credentials テーブルに対する全操作を許可するポリシーを作成
CREATE POLICY "Enable all operations for asp_credentials" ON public.asp_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLSが有効になっているか確認し、無効なら有効化
ALTER TABLE public.asps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asp_credentials ENABLE ROW LEVEL SECURITY;
