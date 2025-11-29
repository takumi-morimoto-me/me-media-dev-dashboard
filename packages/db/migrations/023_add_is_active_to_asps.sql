-- aspsテーブルにis_activeカラムを追加
-- 稼働状況を動的に管理するため（promptの有無ではなく明示的なフラグで管理）

ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.asps.is_active IS 'ASPの稼働状況（スクレイピングが有効かどうか）';

-- yahooアドパートナーを稼働中に設定（もしもアフィリエイト経由）
UPDATE public.asps
SET is_active = TRUE
WHERE name = 'yahooアドパートナー';

-- もしも（ビギナーズ）も稼働中に設定
UPDATE public.asps
SET is_active = TRUE
WHERE name = 'もしも（ビギナーズ）';
