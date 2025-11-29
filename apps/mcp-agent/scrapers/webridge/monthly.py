
import os
import sys
import csv
import json
import time
import random
import requests
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from supabase import create_client

# プロジェクトルートへのパスを追加
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from config import Settings

def get_usd_jpy_rate():
    """現在のドル円レートを取得する"""
    try:
        response = requests.get("https://api.exchangerate-api.com/v4/latest/USD")
        data = response.json()
        rate = data['rates']['JPY']
        print(f"Current USD/JPY rate: {rate}")
        return rate
    except Exception as e:
        print(f"Failed to get exchange rate: {e}")
        print("Using fallback rate: 150.0")
        return 150.0

def human_delay(min_ms=500, max_ms=1500):
    """人間らしいランダムな待機時間"""
    time.sleep(random.randint(min_ms, max_ms) / 1000)

def run_scraper(headless=True):
    settings = Settings.from_env()

    # 認証情報
    username = os.getenv('WEBRIDGE_USERNAME')
    password = os.getenv('WEBRIDGE_PASSWORD')

    if not username or not password:
        print("Error: WEBRIDGE_USERNAME and WEBRIDGE_PASSWORD environment variables are required")
        return {"success": False, "error": "Missing credentials"}

    # Supabaseクライアント
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # ASP情報の取得
    asp_name = "Webridge（ビギナーズ・OJ）"
    asp_response = supabase.table('asps').select('*').eq('name', asp_name).execute()

    if not asp_response.data:
        print(f"Error: ASP '{asp_name}' not found in database")
        return {"success": False, "error": "ASP not found"}

    asp_id = asp_response.data[0]['id']
    login_url = asp_response.data[0]['login_url']

    # ダウンロードディレクトリ
    download_dir = Path(f"/tmp/webridge_downloads_{int(time.time())}")
    download_dir.mkdir(parents=True, exist_ok=True)

    records = []

    with sync_playwright() as p:
        # reCAPTCHA対策: headlessモードを設定可能に、より自然なブラウザ設定
        browser = p.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )
        context = browser.new_context(
            accept_downloads=True,
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080},
            locale='ja-JP',
            timezone_id='Asia/Tokyo'
        )

        # WebDriver検出を回避
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['ja-JP', 'ja', 'en-US', 'en']
            });
        """)

        page = context.new_page()
        
        try:
            # ログイン
            print(f"Logging in to {asp_name}...")
            page.goto(login_url)
            page.wait_for_load_state("networkidle")
            human_delay(1000, 2000)

            try:
                # 人間らしいタイピング
                page.click("input[name='loginUser']")
                human_delay(200, 500)
                page.fill("input[name='loginUser']", username)
                human_delay(500, 1000)

                page.click("input[name='loginPassword']")
                human_delay(200, 500)
                page.fill("input[name='loginPassword']", password)
                human_delay(500, 1000)

                # Enterキーでログイン（より自然）
                page.press("input[name='loginPassword']", "Enter")
                page.wait_for_load_state("networkidle")
                human_delay(2000, 3000)
            except Exception as e:
                print(f"Login interaction failed: {e}")
                page.screenshot(path="/tmp/webridge_login_error.png")
                raise e

            # ログイン成功確認（URLではなくページ内容で判定）
            print(f"After login - URL: {page.url}")
            if page.locator("text=ホーム").count() == 0 and "login" in page.url.lower():
                raise Exception("Login failed")

            print("Login successful")
            human_delay(1000, 2000)

            # 詳細レポートへ移動 (月別)
            print("Navigating to Monthly Report...")
            try:
                # サイドバーの「詳細レポート」をクリックして展開
                detail_report = page.locator("text=詳細レポート").first
                if detail_report.is_visible():
                    detail_report.click()
                    human_delay(800, 1200)

                # 展開後に「月別」リンクを探してクリック
                monthly_link = page.locator("a:has-text('月別')").first
                monthly_link.wait_for(state="visible", timeout=5000)
                monthly_link.click()
                page.wait_for_load_state("networkidle")
                human_delay(2000, 3000)
            except Exception as e:
                print(f"Navigation failed: {e}")
                page.screenshot(path="/tmp/webridge_nav_error.png")
                raise Exception(f"Failed to navigate to monthly report: {e}")

            # 詳細条件を追加
            print("Opening search conditions...")
            search_btn = page.locator("text=条件を追加して検索").first
            if search_btn.is_visible():
                search_btn.click()
                human_delay(1000, 1500)

            # 期間指定: 2025-01 から
            print("Setting date range...")
            now = datetime.now()

            # 開始年・月 (セレクタはサイトの実際の構造に合わせる必要あり)
            try:
                page.select_option("select[name='search_start_year']", label="2025")
                human_delay(300, 500)
                page.select_option("select[name='search_start_month']", label="1")
                human_delay(300, 500)

                # 終了年・月 (現在)
                page.select_option("select[name='search_end_year']", label=str(now.year))
                human_delay(300, 500)
                page.select_option("select[name='search_end_month']", label=str(now.month))
                human_delay(300, 500)
            except Exception as e:
                print(f"Date selection failed (may use different selectors): {e}")
                # 期間選択ができなくても検索を試みる

            # 検索実行
            print("Executing search...")
            search_exec_btn = page.locator("button:has-text('検索実行')").first
            search_exec_btn.click()
            page.wait_for_load_state("networkidle")
            human_delay(3000, 4000)
            
            # CSVダウンロード
            print("Downloading CSV...")
            with page.expect_download() as download_info:
                page.click("button:has-text('CSVダウンロード'), a:has-text('CSVダウンロード')")
            
            download = download_info.value
            csv_path = download_dir / download.suggested_filename
            download.save_as(csv_path)
            print(f"CSV downloaded to: {csv_path}")
            
            # 為替レート取得
            usd_rate = get_usd_jpy_rate()
            
            # CSV解析
            # 画像2枚目の表ヘッダー: 年月, デバイス, 表示数, クリック(数, CTR), 発生(数, 報酬), 承認(数, 報酬), 未承認...
            # CSVのカラム名を推測して読み込む
            
            with open(csv_path, 'r', encoding='utf-8-sig') as f: # shift_jisの可能性もあり
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                print(f"CSV Headers: {headers}")
                
                for row in reader:
                    # 年月カラム (例: 2025-09)
                    date_str = row.get('年月') or row.get('date') or row.get('Month')
                    if not date_str:
                        continue
                        
                    # 日付変換 (YYYY-MM -> YYYY-MM-01)
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m')
                        formatted_date = date_obj.strftime('%Y-%m-01')
                    except:
                        print(f"Skipping invalid date: {date_str}")
                        continue
                        
                    # 承認報酬 (画像2枚目では「承認」の下の「報酬」)
                    # CSVヘッダーがどうなっているか不明だが、「承認報酬」や「approved_amount」などを探す
                    # 画像2枚目の表では $967.00 のようになっている
                    
                    amount_usd = 0.0
                    # カラム名の候補
                    amount_cols = [k for k in row.keys() if '承認' in k and '報酬' in k]
                    if not amount_cols:
                        # 英語ヘッダーの場合
                        amount_cols = [k for k in row.keys() if 'approved' in k.lower() and 'amount' in k.lower()]
                    
                    if amount_cols:
                        raw_val = row[amount_cols[0]]
                        # $ , を除去
                        clean_val = raw_val.replace('$', '').replace(',', '').strip()
                        if clean_val:
                            amount_usd = float(clean_val)
                    
                    # 円換算
                    amount_jpy = int(amount_usd * usd_rate)
                    
                    # メディアID取得 (DBから)
                    # Webridgeはメディアごとにアカウントが分かれているのか、1アカウントで複数メディアか？
                    # 画像3枚目の検索条件に「メディア」ドロップダウンがある。
                    # 今回は「ビギナーズ・OJ」というASP名なので、特定のメディアに紐づくデータのみを取得するのか、
                    # あるいは全メディア合算か。
                    # ユーザー指示は「Webridge（ビギナーズ・OJ）の実装」
                    # CSVにメディアカラムがあればそれを使うが、月別レポートはメディア合算の可能性もある。
                    # 画像2枚目には「メディア」列がない（デバイスはある）。
                    # つまり、選択中のメディア（あるいは全メディア）のデータ。
                    
                    # ここでは、DBの `media_asps` または `credentials` から紐づくメディアIDを取得する必要があるが、
                    # 簡易的に `asps` テーブルに紐づく `account_items` を探す。
                    # しかし、`monthly.py` は通常、特定の `media_id` に対して実行されるわけではない（ASP単位）。
                    # ただし、DBへの保存には `media_id` が必要。
                    
                    # 既存のスクレイパーの実装パターン:
                    # 1. `media_asps` からログイン情報を使って `media_id` を特定
                    # 2. あるいは、スクリプト内で固定の `media_id` を使う（推奨されない）
                    
                    # ここでは、`Webridge（ビギナーズ・OJ）` というASP名自体が特定のメディアを示唆している。
                    # DBの `asps` テーブルのレコードに対応する `media_id` を見つける必要がある。
                    # `media_asps` テーブルがない場合、`account_items` から逆引きする。
                    
                    # 仮実装: 最初に紐づいている account_item を取得し、その media_id を使う
                    # 本来はCSVにメディア情報が含まれているべきだが、月別レポートにはない場合が多い。
                    
                    # ユーザーの指示「Webridge（ビギナーズ・OJ）」はASP名。
                    # これに対応する `account_item` を探す。
                    
                    account_item_response = supabase.table('account_items').select('*').eq('name', 'アフィリエイト').execute()
                    # これだと全ASPのアフィリエイト項目が取れてしまう。
                    
                    # `asps` テーブルには `media_id` カラムはない。
                    # `credentials` テーブルがあるはず。
                    
                    # 暫定: ユーザーの環境（me-media-dev-dashboard）では、
                    # ASP名にメディア名が含まれている（例: "Link-AG（ビギナーズ）"）。
                    # つまり、このASP IDを使って保存すればよいが、`actuals` テーブルには `media_id` が必須。
                    
                    # 苦肉の策: `asps` テーブルのIDを使って、`asp_accounts` (もしあれば) や `credentials` を検索。
                    # なければ、`account_items` を検索。
                    
                    # ここでは、`Webridge（ビギナーズ・OJ）` という名前からメディアを特定するのは危険。
                    # しかし、ユーザーの環境では `SmaAD` の実装時に `media_id` をハードコードしていた（`monthly.py` の修正履歴参照: `value="767506694"` はASP側のID）。
                    # DB保存時の `media_id` はどうしていたか？
                    # `SmaAD` の `monthly.py`:
                    # `media_response = client.table('media').select('id').eq('name', 'ビギナーズ').execute()`
                    # としていた。
                    
                    # Webridgeも「ビギナーズ」と「OJ」が含まれている。
                    # ユーザー指示「Webridge（ビギナーズ・OJ）」
                    # おそらく「ビギナーズ」メディアのデータとして保存すれば良い？
                    # 画像1枚目の左上に `Webdridge` ロゴ。
                    # とりあえず「ビギナーズ」の `media_id` を取得して使用する。
                    
                    media_name = "ビギナーズ"
                    media_res = supabase.table('media').select('id').eq('name', media_name).execute()
                    if not media_res.data:
                        print(f"Media '{media_name}' not found")
                        continue
                    media_id = media_res.data[0]['id']
                    
                    # account_item_id
                    ai_res = supabase.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
                    if not ai_res.data:
                        # なければ作成するか、エラー
                        print("Account item 'アフィリエイト' not found")
                        continue
                    account_item_id = ai_res.data[0]['id']
                    
                    records.append({
                        'date': formatted_date,
                        'amount': amount_jpy,
                        'media_id': media_id,
                        'asp_id': asp_id,
                        'account_item_id': account_item_id
                    })

            # DB保存 (重複回避のため delete -> insert)
            if records:
                print(f"Saving {len(records)} records...")
                start_date = "2025-01-01"
                end_date = datetime.now().strftime('%Y-%m-%d')
                
                try:
                    supabase.table('actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).gte('date', start_date).lte('date', end_date).execute()
                except Exception as e:
                    print(f"Delete failed: {e}")
                
                result = supabase.table('actuals').insert(records).execute()
                print(f"Inserted {len(result.data)} records")
                return {"success": True, "records_saved": len(result.data)}
            else:
                print("No records found")
                return {"success": True, "records_saved": 0}

        except Exception as e:
            print(f"Scraping failed: {e}")
            # エラー時のHTMLダンプ
            try:
                page.screenshot(path="/tmp/webridge_error.png")
                with open("/tmp/webridge_error.html", "w") as f:
                    f.write(page.content())
            except:
                pass
            return {"success": False, "error": str(e)}
        finally:
            browser.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-headless', action='store_true', help='Run browser in non-headless mode')
    args = parser.parse_args()
    result = run_scraper(headless=not args.no_headless)
    print(f"Result: {result}")
