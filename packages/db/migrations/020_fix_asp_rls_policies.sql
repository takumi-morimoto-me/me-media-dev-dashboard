-- マイグレーション: ASPテーブルのRLSポリシーを修正
-- 作成日: 2025-11-24
-- 説明: 匿名ユーザー（anon）とサービスロール（service_role）の両方にアクセスを許可

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Enable all operations for asps" ON public.asps;
DROP POLICY IF EXISTS "Enable all operations for asp_credentials" ON public.asp_credentials;

-- asps テーブル: anonロールとservice_roleロールに対してSELECT権限を付与
CREATE POLICY "Allow anon read access to asps" ON public.asps
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon insert access to asps" ON public.asps
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to asps" ON public.asps
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to asps" ON public.asps
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- asp_credentials テーブル: anonロールとservice_roleロールに対してSELECT権限を付与
CREATE POLICY "Allow anon read access to asp_credentials" ON public.asp_credentials
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon insert access to asp_credentials" ON public.asp_credentials
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to asp_credentials" ON public.asp_credentials
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to asp_credentials" ON public.asp_credentials
  FOR DELETE
  TO anon, authenticated
  USING (true);
