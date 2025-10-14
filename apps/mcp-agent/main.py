import os
from dotenv import load_dotenv
from supabase import create_client, Client

# .envファイルから環境変数を読み込む
load_dotenv()

# 環境変数からSupabaseのURLとキーを取得
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # サーバーサイドなのでSERVICE_ROLE_KEYを使用

# Supabaseクライアントの作成
supabase: Client = create_client(url, key)

def main():
    """
    aspsテーブルからデータを取得し、コンソールに出力する
    """
    print("Fetching data from 'asps' table...")
    response = supabase.table('asps').select("*").execute()

    # データ取得成功時
    if response.data:
        print("Successfully fetched data:")
        for row in response.data:
            print(row)
    # データ取得失敗時
    else:
        print("Failed to fetch data or table is empty.")
        if hasattr(response, 'error') and response.error:
            print("Error:", response.error)

if __name__ == "__main__":
    main()
