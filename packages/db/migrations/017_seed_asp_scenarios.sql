-- Seed data for ASP scenarios
-- Depends on media_id from 002_seed_test_data.sql

-- A8.net
INSERT INTO public.asps (name, login_url, prompt, media_id)
VALUES (
    'A8.net',
    'https://www.a8.net/',
    '1. https://www.a8.net/ にアクセス
2. 「メディア会員」の「ID」入力欄に {SECRET:A8NET_USERNAME} を入力
3. 「メディア会員」の「PASS」入力欄に {SECRET:A8NET_PASSWORD} を入力
4. 「ログイン」ボタンをクリック
5. ログイン完了を待機 (3000ms)
6. https://pub.a8.net/a8v2/asReportAction.do にアクセス
7. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存',
    '11111111-1111-1111-1111-111111111111'
) ON CONFLICT (name) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    login_url = EXCLUDED.login_url;

-- もしもアフィリエイト
INSERT INTO public.asps (name, login_url, prompt, media_id)
VALUES (
    'もしもアフィリエイト',
    'https://af.moshimo.com/af/shop/login',
    '1. https://af.moshimo.com/af/shop/login にアクセス
2. 「ユーザーID」入力欄に {SECRET:MOSHIMO_USERNAME} を入力
3. 「パスワード」入力欄に {SECRET:MOSHIMO_PASSWORD} を入力
4. 「ログイン」ボタンをクリック
5. ログイン完了を待機 (3000ms)
6. https://af.moshimo.com/af/shop/income/daily にアクセス
7. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存',
    '11111111-1111-1111-1111-111111111111'
) ON CONFLICT (name) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    login_url = EXCLUDED.login_url;

-- Link-AG
INSERT INTO public.asps (name, login_url, prompt, media_id)
VALUES (
    'Link-AG',
    'https://link-ag.net/',
    '1. https://link-ag.net/ にアクセス
2. 「パートナーログイン」をクリック
3. 「ログインID」に {SECRET:LINKAG_USERNAME} を入力
4. 「パスワード」に {SECRET:LINKAG_PASSWORD} を入力
5. 「ログイン」をクリック
6. ログイン完了を待機 (3000ms)
7. https://link-ag.net/partner/report/daily にアクセス
8. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存',
    '11111111-1111-1111-1111-111111111111'
) ON CONFLICT (name) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    login_url = EXCLUDED.login_url;
