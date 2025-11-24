"""Seed A8.net ASP data."""

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

    # A8.net ASP data
    asp_data = {
        "name": "A8.net",
        "login_url": "https://www.a8.net/",
        "prompt": """1. https://www.a8.net/ にアクセス
2. 「メディア会員」の「ID」入力欄に {SECRET:A8NET_USERNAME} を入力
3. 「メディア会員」の「PASS」入力欄に {SECRET:A8NET_PASSWORD} を入力
4. 「ログイン」ボタンをクリック
5. ログイン完了を待機 (3000ms)
6. https://pub.a8.net/a8v2/asReportAction.do にアクセス
7. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存""",
    }

    try:
        # Check if A8.net already exists
        result = supabase.table("asps").select("*").eq("name", "A8.net").execute()

        if result.data and len(result.data) > 0:
            print(f"✅ A8.net already exists (ID: {result.data[0]['id']})")
            print(f"   Login URL: {result.data[0]['login_url']}")
            print(f"   Prompt preview: {result.data[0]['prompt'][:100]}...")
        else:
            # Insert A8.net
            result = supabase.table("asps").insert(asp_data).execute()
            print(f"✅ A8.net inserted successfully!")
            print(f"   ID: {result.data[0]['id']}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
