
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
        return 150.0

def human_delay(min_ms=500, max_ms=1500):
    """人間らしいランダムな待機時間"""
    time.sleep(random.randint(min_ms, max_ms) / 1000)

def run_scraper(headless=True, max_retries=3):
    settings = Settings.from_env()

    username = os.getenv('WEBRIDGE_USERNAME')
    password = os.getenv('WEBRIDGE_PASSWORD')

    if not username or not password:
        print("Error: WEBRIDGE_USERNAME and WEBRIDGE_PASSWORD environment variables are required")
        return {"success": False, "error": "Missing credentials"}

    # リトライループ
    for attempt in range(1, max_retries + 1):
        print(f"\n=== Attempt {attempt}/{max_retries} ===")
        result = _run_scraper_attempt(settings, username, password, headless)
        if result["success"]:
            return result
        print(f"Attempt {attempt} failed: {result.get('error', 'Unknown error')}")
        if attempt < max_retries:
            wait_time = 10 * attempt  # 10秒、20秒と増やす
            print(f"Waiting {wait_time} seconds before retry...")
            time.sleep(wait_time)

    return {"success": False, "error": f"Failed after {max_retries} attempts"}


def _run_scraper_attempt(settings, username, password, headless):

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    asp_name = "Webridge（ビギナーズ・OJ）"
    asp_response = supabase.table('asps').select('*').eq('name', asp_name).execute()

    if not asp_response.data:
        print(f"Error: ASP '{asp_name}' not found")
        return {"success": False, "error": "ASP not found"}

    asp_id = asp_response.data[0]['id']
    login_url = asp_response.data[0]['login_url']

    download_dir = Path(f"/tmp/webridge_downloads_daily_{int(time.time())}")
    download_dir.mkdir(parents=True, exist_ok=True)

    records = []

    with sync_playwright() as p:
        # シンプルな設定で起動（debug_webridge_visible.pyと同様）
        browser = p.chromium.launch(
            headless=headless,
            slow_mo=1000 if not headless else 0  # ゆっくり操作
        )
        context = browser.new_context(accept_downloads=True)
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
                raise e

            # ログイン後のスクリーンショットを保存
            page.screenshot(path="/tmp/webridge_after_login_attempt.png")

            # ログイン成功確認
            print(f"After login - URL: {page.url}")
            print(f"After login - Title: {page.title()}")

            # 500エラーページかどうかチェック
            if "500" in page.title() or page.locator("text=500 Internal Server Error").count() > 0:
                print("Detected 500 error page (reCAPTCHA block)")
                raise Exception("reCAPTCHA blocked - 500 error")

            # ログイン成功確認（URLではなくページ内容で判定）
            if page.locator("text=ホーム").count() == 0 and "login" in page.url.lower():
                raise Exception("Login failed")

            print("Login successful")
            human_delay(1000, 2000)

            # 詳細レポートへ移動 (日別)
            print("Navigating to Daily Report...")
            try:
                # サイドバーの「詳細レポート」をクリックして展開
                detail_report = page.locator("text=詳細レポート").first
                if detail_report.is_visible():
                    detail_report.click()
                    human_delay(800, 1200)

                # 展開後に「日別」リンクを探してクリック
                daily_link = page.locator("a:has-text('日別')").first
                daily_link.wait_for(state="visible", timeout=5000)
                daily_link.click()
                page.wait_for_load_state("networkidle")
                human_delay(2000, 3000)
            except Exception as e:
                print(f"Navigation failed: {e}")
                page.screenshot(path="/tmp/webridge_nav_error.png")
                raise Exception(f"Failed to navigate to daily report: {e}")

            # 詳細条件を追加
            print("Opening search conditions...")
            search_btn = page.locator("text=条件を追加して検索").first
            if search_btn.is_visible():
                search_btn.click()
                human_delay(1000, 1500)

            # 期間指定: 今月
            print("Setting date range: This Month...")
            this_month_radio = page.locator("label:has-text('今月')").first
            if this_month_radio.is_visible():
                this_month_radio.click()
                human_delay(500, 800)

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
            
            # 為替レート
            usd_rate = get_usd_jpy_rate()
            
            # CSV解析
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                print(f"CSV Headers: {headers}")
                
                for row in reader:
                    # 日付カラム (例: 2025-11-28)
                    date_str = row.get('年月日') or row.get('Date') or row.get('date')
                    if not date_str:
                        continue

                    # 承認報酬 (Approved Commissions)
                    amount_usd = 0.0
                    # 日本語カラム名
                    amount_cols = [k for k in row.keys() if '承認' in k and '報酬' in k]
                    # 英語カラム名: "Approved Commissions"
                    if not amount_cols:
                        amount_cols = [k for k in row.keys() if 'approved' in k.lower() and 'commission' in k.lower()]

                    if amount_cols:
                        raw_val = row[amount_cols[0]]
                        # $記号、カンマを除去
                        clean_val = raw_val.replace('$', '').replace(',', '').strip()
                        if clean_val:
                            try:
                                amount_usd = float(clean_val)
                            except ValueError:
                                print(f"Warning: Could not parse amount: {raw_val}")
                                continue
                    
                    amount_jpy = int(amount_usd * usd_rate)
                    print(f"  Processing: date={date_str}, amount_usd={amount_usd}, amount_jpy={amount_jpy}")

                    # メディアID (ビギナーズ)
                    media_name = "ビギナーズ"
                    media_res = supabase.table('media').select('id').eq('name', media_name).execute()
                    if not media_res.data:
                        print(f"  Warning: Media '{media_name}' not found")
                        continue
                    media_id = media_res.data[0]['id']

                    # account_item_id
                    ai_res = supabase.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
                    if not ai_res.data:
                        print(f"  Warning: Account item 'アフィリエイト' not found for media_id={media_id}")
                        continue
                    account_item_id = ai_res.data[0]['id']

                    records.append({
                        'date': date_str,
                        'amount': amount_jpy,
                        'media_id': media_id,
                        'asp_id': asp_id,
                        'account_item_id': account_item_id
                    })
                    print(f"  Added record: {date_str} -> {amount_jpy} JPY")

            # DB保存 (delete -> insert)
            if records:
                print(f"Saving {len(records)} records...")
                # 今月の範囲
                now = datetime.now()
                start_date = now.strftime('%Y-%m-01')
                end_date = now.strftime('%Y-%m-%d')
                
                try:
                    supabase.table('daily_actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).gte('date', start_date).lte('date', end_date).execute()
                except Exception as e:
                    print(f"Delete failed: {e}")
                
                result = supabase.table('daily_actuals').insert(records).execute()
                print(f"Inserted {len(result.data)} records")
                return {"success": True, "records_saved": len(result.data)}
            else:
                print("No records found")
                return {"success": True, "records_saved": 0}

        except Exception as e:
            print(f"Scraping failed: {e}")
            try:
                page.screenshot(path="/tmp/webridge_daily_error.png")
                with open("/tmp/webridge_daily_error.html", "w") as f:
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
