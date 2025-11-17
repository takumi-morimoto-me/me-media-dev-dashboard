"""動作確認済みのシナリオをSupabaseに保存するスクリプト"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print(f"❌ 環境変数が見つかりません")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Link-AG: TypeScript版の動作を再現（button要素を使用）
linkag_scenario = """1. Link-AGのログインページ (https://link-ag.net/) にアクセス
2. 待機 (3000ms)
3. 最初のテキスト入力フィールド（input[type="text"]の1番目）に {SECRET:LINKAG_USERNAME} を入力
4. 最初のパスワードフィールド（input[type="password"]の1番目）に {SECRET:LINKAG_PASSWORD} を入力
5. 待機 (1000ms)
6. button:has-text("ログイン") の最初の要素をクリック
7. 待機 (5000ms)
8. 日別レポートページ (https://link-ag.net/partner/summaries/dates) に移動
9. 待機 (3000ms)
10. 最後のテーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存
    - 日付は列0（2025/11/01形式）を2025-11-01に変換
    - 確定報酬金額は列9"""

# felmat: 動作確認済み（nav要素経由でレポートメニューにアクセス）
felmat_scenario = """1. felmatのログインページ (https://www.felmat.net/publisher/login) にアクセス
2. 待機 (2000ms)
3. input[name="p_username"] に {SECRET:FELMAT_USERNAME} を入力
4. input[name="p_password"] に {SECRET:FELMAT_PASSWORD} を入力
5. 待機 (1000ms)
6. text=LOG IN をクリック
7. 待機 (5000ms)
8. 日別レポートページ (https://www.felmat.net/publisher/report/daily) に直接移動
9. 待機 (3000ms)
10. 最初のテーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存
    - 日付は列0（2025年11月30日 (日) 形式）から日付部分を抽出して2025-11-30に変換
    - 確定報酬金額は列11（承認報酬額）"""

print("シナリオを更新中...\\n")

# Link-AG
result_linkag = supabase.table("asps").update({
    "prompt": linkag_scenario
}).eq("name", "Link-AG").execute()

print(f"✅ Link-AG: シナリオ更新完了 (更新数: {len(result_linkag.data)})")

# felmat
result_felmat = supabase.table("asps").update({
    "prompt": felmat_scenario
}).eq("name", "felmat").execute()

print(f"✅ felmat: シナリオ更新完了 (更新数: {len(result_felmat.data)})")

print("\\n🎉 すべてのシナリオを更新しました！")
