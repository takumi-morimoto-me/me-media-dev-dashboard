"""
すべてのASP用のシナリオを生成してSupabaseに登録するスクリプト
"""

import os
from supabase import create_client

# Supabase設定
url = os.getenv('SUPABASE_URL', 'https://pkjrepxggkbybkjifiqt.supabase.co')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranJlcHhnZ2tieWJramlmaXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTcyNzA3NiwiZXhwIjoyMDc1MzAzMDc2fQ.HpV3ZJxATuesWehBG9Y9dSi4XRIeWXe05vCHXktY-1Y')
client = create_client(url, key)

# 各ASP用のシナリオ定義
scenarios = {
    "A8app": """1. A8app(SeedApp)のログインページ (https://app-af.a8.net/) にアクセス
2. 待機 (2000ms)
3. input[type="email"] に {SECRET:A8APP_USERNAME} を入力
4. input[type="password"] に {SECRET:A8APP_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "afb": """1. afbのログインページ (https://www.afi-b.com/) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:AFB_USERNAME} を入力
4. input[type="password"] に {SECRET:AFB_PASSWORD} を入力
5. button, input[type="submit"] をクリック
6. 待機 (3000ms)
7. text=レポート をホバー
8. 待機 (2000ms)
9. text=日別レポート をクリック
10. 待機 (3000ms)
11. input[type="image"] で alt に "表示" を含むボタンをクリック
12. 待機 (5000ms)
13. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "アクセストレード": """1. アクセストレードのログインページ (https://member.accesstrade.net/) にアクセス
2. 待機 (2000ms)
3. 2番目のinput[name="userId"] に {SECRET:ACCESSTRADE_USERNAME} を入力
4. 2番目のinput[name="userPass"] に {SECRET:ACCESSTRADE_PASSWORD} を入力
5. 待機 (1000ms)
6. 2番目のsubmitボタンをクリック
7. 待機 (5000ms)
8. text=レポート をクリック
9. 待機 (3000ms)
10. text=日別 をクリック
11. 待機 (3000ms)
12. 表示ボタンをクリック
13. 待機 (5000ms)
14. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "affitown": """1. affitownのログインページ にアクセス
2. 待機 (2000ms)
3. ログインID入力フィールドに {SECRET:AFFITOWN_USERNAME} を入力
4. パスワード入力フィールドに {SECRET:AFFITOWN_PASSWORD} を入力
5. 待機 (1000ms)
6. ログインボタンをクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Amazonアソシエイト": """1. Amazonアソシエイトのログインページ (https://affiliate.amazon.co.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="email"] に {SECRET:AMAZON_USERNAME} を入力
4. 待機 (1000ms)
5. button[type="submit"], input[type="submit"] をクリック
6. 待機 (2000ms)
7. input[type="password"] に {SECRET:AMAZON_PASSWORD} を入力
8. 待機 (1000ms)
9. button[type="submit"], input[type="submit"] をクリック
10. 待機 (5000ms)
11. レポートメニューをクリック
12. 待機 (2000ms)
13. 日別レポートをクリック
14. 待機 (3000ms)
15. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "CASTALK": """1. CASTALKのログインページ (https://www.castalk.net/) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:CASTALK_USERNAME} を入力
4. input[type="password"] に {SECRET:CASTALK_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "CircuitX": """1. CircuitXのログインページ にアクセス
2. 待機 (2000ms)
3. input[type="email"], input[type="text"] に {SECRET:CIRCUITX_USERNAME} を入力
4. input[type="password"] に {SECRET:CIRCUITX_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートリンクをクリック
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "DMMアフィリエイト": """1. DMMアフィリエイトのログインページ (https://affiliate.dmm.com/) にアクセス
2. 待機 (2000ms)
3. input[type="email"], input[type="text"] に {SECRET:DMM_USERNAME} を入力
4. input[type="password"] に {SECRET:DMM_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"], input[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Gro-fru": """1. Gro-fruのログインページ にアクセス
2. 待機 (2000ms)
3. ログインID入力フィールドに入力
4. パスワード入力フィールドに入力
5. 待機 (1000ms)
6. ログインボタンをクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "i-mobile": """1. i-mobileのログインページ (https://www.i-mobile.co.jp/login.aspx) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:IMOBILE_USERNAME} を入力
4. input[type="password"] に {SECRET:IMOBILE_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"], input[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "JANet": """1. JANetのログインページ (https://j-a-net.jp/) にアクセス
2. 待機 (2000ms)
3. ログインID入力フィールドに入力
4. パスワード入力フィールドに入力
5. 待機 (1000ms)
6. ログインボタンをクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "PRESCO": """1. PRESCOのログインページ にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:PRESCO_USERNAME} を入力
4. input[type="password"] に {SECRET:PRESCO_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Ratel AD": """1. Ratel ADのログインページ にアクセス
2. 待機 (2000ms)
3. ログインID入力フィールドに入力
4. パスワード入力フィールドに入力
5. 待機 (1000ms)
6. ログインボタンをクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "SKYFLAG": """1. SKYFLAGのログインページ (https://www.skyflag.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:SKYFLAG_USERNAME} を入力
4. input[type="password"] に {SECRET:SKYFLAG_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "SLVRbullet": """1. SLVRbulletのログインページ (https://www.slvrbullet.com/) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:SLVRBULLET_USERNAME} を入力
4. input[type="password"] に {SECRET:SLVRBULLET_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "SmaAD": """1. SmaADのログインページ にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:SMAAD_USERNAME} を入力
4. input[type="password"] に {SECRET:SMAAD_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Smart-C": """1. Smart-Cのログインページ (https://smart-c.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="text"], input[name="loginID"] に {SECRET:SMARTC_USERNAME} を入力
4. input[type="password"] に {SECRET:SMARTC_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"], input[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Sphere": """1. Sphereのログインページ にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:SPHERE_USERNAME} を入力
4. input[type="password"] に {SECRET:SPHERE_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "TGアフィリエイト": """1. TGアフィリエイトのログインページ (https://tg-affiliate.com/) にアクセス
2. 待機 (2000ms)
3. input[type="text"], input[name="login_id"] に {SECRET:TG_USERNAME} を入力
4. input[type="password"] に {SECRET:TG_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "webridge": """1. webridgeのログインページ にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:WEBRIDGE_USERNAME} を入力
4. input[type="password"] に {SECRET:WEBRIDGE_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "Zucks Affiliate": """1. Zucks Affiliateのログインページ (https://zucks.co.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="email"], input[type="text"] に {SECRET:ZUCKS_USERNAME} を入力
4. input[type="password"] に {SECRET:ZUCKS_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "アルテガアフィリエイト": """1. アルテガアフィリエイトのログインページ (https://www.rentracks.jp/ultiga/) にアクセス
2. 待機 (2000ms)
3. input[type="text"] に {SECRET:ULTIGA_USERNAME} を入力
4. input[type="password"] に {SECRET:ULTIGA_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "ドコモアフィリエイト": """1. ドコモアフィリエイトのログインページ (https://aff.docomo.ne.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="text"], input[name="login_id"] に {SECRET:DOCOMO_USERNAME} を入力
4. input[type="password"] に {SECRET:DOCOMO_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "バリューコマース": """1. バリューコマースのログインページ (https://www.valuecommerce.ne.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="text"], input[name="login_id"] に {SECRET:VALUECOMMERCE_USERNAME} を入力
4. input[type="password"] に {SECRET:VALUECOMMERCE_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"], input[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "リンクシェア": """1. リンクシェアのログインページ (https://www.linkshare.ne.jp/) にアクセス
2. 待機 (2000ms)
3. input[type="text"], input[name="login_id"] に {SECRET:LINKSHARE_USERNAME} を入力
4. input[type="password"] に {SECRET:LINKSHARE_PASSWORD} を入力
5. 待機 (1000ms)
6. button[type="submit"] をクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",

    "レントラックス": """1. レントラックスのログインページ (https://www.rentracks.co.jp/) にアクセス
2. 待機 (2000ms)
3. ログインID入力フィールドに入力
4. パスワード入力フィールドに入力
5. 待機 (1000ms)
6. ログインボタンをクリック
7. 待機 (5000ms)
8. レポートページに移動
9. 待機 (3000ms)
10. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",
}

def update_scenarios():
    """全ASPのシナリオをSupabaseに登録"""

    # 全ASPを取得
    response = client.table('asps').select('id,name').execute()
    asps = {asp['name']: asp['id'] for asp in response.data}

    print(f'\n📋 {len(asps)} 件のASPが見つかりました\n')

    updated_count = 0
    skipped_count = 0

    for asp_name, scenario in scenarios.items():
        if asp_name in asps:
            # promptを更新
            result = client.table('asps').update({
                'prompt': scenario
            }).eq('name', asp_name).execute()

            print(f'✅ {asp_name}: シナリオ更新完了')
            updated_count += 1
        else:
            print(f'⚠️  {asp_name}: データベースに見つかりません')
            skipped_count += 1

    print(f'\n📊 結果サマリー')
    print(f'  更新: {updated_count}件')
    print(f'  スキップ: {skipped_count}件')
    print(f'  合計: {len(scenarios)}件\n')

if __name__ == '__main__':
    print('=' * 60)
    print('ASPシナリオ一括登録スクリプト')
    print('=' * 60)
    update_scenarios()
    print('✅ 完了しました！')
