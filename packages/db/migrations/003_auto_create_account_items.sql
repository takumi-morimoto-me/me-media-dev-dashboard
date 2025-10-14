-- メディア作成時に基本的な勘定科目を自動生成するトリガー

-- トリガー関数: メディア作成時に基本勘定科目を作成
CREATE OR REPLACE FUNCTION create_default_account_items()
RETURNS TRIGGER AS $$
BEGIN
  -- 売上（大項目）
  INSERT INTO public.account_items (name, parent_id, media_id, display_order)
  VALUES ('売上', NULL, NEW.id, 1);

  -- 費用（大項目）
  INSERT INTO public.account_items (name, parent_id, media_id, display_order)
  VALUES ('費用', NULL, NEW.id, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー: メディア挿入後に実行
CREATE TRIGGER trigger_create_default_account_items
AFTER INSERT ON public.media
FOR EACH ROW
EXECUTE FUNCTION create_default_account_items();
