-- aspsテーブルにreCAPTCHA関連カラムを追加
-- reCAPTCHAの有無と突破状況を管理するため

-- reCAPTCHAの有無
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS has_recaptcha BOOLEAN DEFAULT FALSE;

-- reCAPTCHA突破状況
-- 'not_applicable': reCAPTCHAなし
-- 'bypassed': 突破成功（安定）
-- 'unstable': 突破可能だが不安定
-- 'blocked': 現在ブロック中
-- 'unknown': 未確認
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS recaptcha_status TEXT DEFAULT 'unknown';

-- 最後のスクレイピング日時
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS last_scrape_at TIMESTAMPTZ;

-- 最後のスクレイピング結果
-- 'success': 成功
-- 'failed': 失敗
-- 'partial': 一部成功
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS last_scrape_status TEXT;

-- スクレイピング備考（エラーメッセージなど）
ALTER TABLE public.asps
ADD COLUMN IF NOT EXISTS scrape_notes TEXT;

-- コメント追加
COMMENT ON COLUMN public.asps.has_recaptcha IS 'reCAPTCHA保護の有無';
COMMENT ON COLUMN public.asps.recaptcha_status IS 'reCAPTCHA突破状況: not_applicable, bypassed, unstable, blocked, unknown';
COMMENT ON COLUMN public.asps.last_scrape_at IS '最後のスクレイピング実行日時';
COMMENT ON COLUMN public.asps.last_scrape_status IS '最後のスクレイピング結果: success, failed, partial';
COMMENT ON COLUMN public.asps.scrape_notes IS 'スクレイピングに関する備考（エラーメッセージなど）';

-- Webridgeのデータを更新
UPDATE public.asps
SET
    has_recaptcha = TRUE,
    recaptcha_status = 'unstable',
    scrape_notes = 'reCAPTCHA v3による保護あり。headless=falseで実行推奨。スコア判定が不安定。'
WHERE name = 'Webridge（ビギナーズ・OJ）';
