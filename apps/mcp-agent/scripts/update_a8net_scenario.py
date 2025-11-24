"""Update A8.net scenario with better instructions."""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def main():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ Missing credentials")
        return

    # Create Supabase client
    supabase = create_client(supabase_url, supabase_key)

    # Updated A8.net prompt with better instructions
    new_prompt = """1. https://www.a8.net/ にアクセス
2. ページ上の最初のログインID入力欄に {SECRET:A8NET_USERNAME} を入力
3. ページ上の最初のパスワード入力欄に {SECRET:A8NET_PASSWORD} を入力
4. 最初の赤い「ログイン」ボタンをクリック
5. ログイン完了を待機 (3000ms)
6. ページ上の「レポート」リンクまたはメニューをクリック
7. ドロップダウンメニューから「成果報酬」リンクをクリック
8. ページ遷移を待機 (2000ms)
9. ページ内のテーブルから全ての日別確定報酬データ（日付と金額のペア）を抽出して daily_actuals テーブルに保存
10. ページを下にスクロール (1000px)
11. 月次合計データを抽出して monthly_actuals テーブルに保存（日付は2025-11-30で保存）"""

    try:
        # Update A8.net prompt
        result = supabase.table("asps").update({
            "prompt": new_prompt
        }).eq("name", "A8.net").execute()

        print(f"✅ A8.net scenario updated successfully!")
        print(f"   Updated prompt:")
        print(f"   {new_prompt[:100]}...")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
