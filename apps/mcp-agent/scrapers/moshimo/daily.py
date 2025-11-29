"""
もしもアフィリエイト - 日次レポートスクレイパー
"""
import os
import sys
import csv
import time
import random
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from config import Settings


def human_delay(min_ms=500, max_ms=1500):
    """人間らしいランダムな待機時間"""
    time.sleep(random.randint(min_ms, max_ms) / 1000)


def parse_yen(value: str) -> int:
    """¥123,456 形式の文字列を整数に変換"""
    if not value:
        return 0
    # ¥記号、バックスラッシュ（Shift_JISの円記号）、カンマを除去
    cleaned = value.replace('¥', '').replace('\\', '').replace(',', '').strip()
    if not cleaned:
        return 0
    return int(cleaned)


def parse_date(value: str) -> str:
    """2025年11月01日 形式を 2025-11-01 に変換"""
    try:
        parts = value.replace('年', '-').replace('月', '-').replace('日', '')
        year, month, day = parts.split('-')
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except:
        return None


def run_scraper(headless=True, max_retries=3):
    settings = Settings.from_env()

    username = os.getenv('MOSHIMO_USERNAME')
    password = os.getenv('MOSHIMO_PASSWORD')

    if not username or not password:
        print("Error: MOSHIMO_USERNAME and MOSHIMO_PASSWORD environment variables are required")
        return {"success": False, "error": "Missing credentials"}

    for attempt in range(1, max_retries + 1):
        print(f"\n=== Attempt {attempt}/{max_retries} ===")
        result = _run_scraper_attempt(settings, username, password, headless)
        if result["success"]:
            return result
        print(f"Attempt {attempt} failed: {result.get('error', 'Unknown error')}")
        if attempt < max_retries:
            wait_time = 10 * attempt
            print(f"Waiting {wait_time} seconds before retry...")
            time.sleep(wait_time)

    return {"success": False, "error": f"Failed after {max_retries} attempts"}


def _run_scraper_attempt(settings, username, password, headless):
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    asp_name = "もしも（ビギナーズ）"
    asp_response = supabase.table('asps').select('*').eq('name', asp_name).execute()

    if not asp_response.data:
        print(f"Error: ASP '{asp_name}' not found in database")
        return {"success": False, "error": "ASP not found"}

    asp_id = asp_response.data[0]['id']

    download_dir = Path(f"/tmp/moshimo_downloads_daily_{int(time.time())}")
    download_dir.mkdir(parents=True, exist_ok=True)

    records = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            slow_mo=1000 if not headless else 0
        )
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        try:
            # ログイン
            print(f"Logging in to {asp_name}...")
            page.goto('https://af.moshimo.com/af/shop/index', wait_until='domcontentloaded')
            human_delay(1000, 2000)

            page.fill('input[name="account"]', username)
            human_delay(300, 500)
            page.fill('input[name="password"]', password)
            human_delay(300, 500)
            page.click('input[name="login"]')
            page.wait_for_timeout(5000)

            # ログイン確認
            print(f"After login - URL: {page.url}")
            if 'login' in page.url and 'shop/index' not in page.url:
                raise Exception("Login failed")

            print("Login successful")
            human_delay(1000, 2000)

            # 売上レポートへ移動
            print("Navigating to report page...")
            page.click('text=売上レポート')
            human_delay(2000, 3000)

            # 日次タブへ
            print("Clicking daily tab...")
            page.click('text=日次')
            human_delay(2000, 3000)

            # CSVダウンロード
            print("Downloading CSV...")
            with page.expect_download() as download_info:
                page.click('text=CSVダウンロード')

            download = download_info.value
            csv_path = download_dir / download.suggested_filename
            download.save_as(csv_path)
            print(f"CSV downloaded to: {csv_path}")

            # CSV解析（Shift_JISエンコーディング）
            with open(csv_path, 'r', encoding='shift_jis') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                print(f"CSV Headers: {headers}")

                for row in reader:
                    # 成果発生日（2025年11月01日形式）
                    period = row.get('成果発生日', '') or row.get('期間', '')
                    date_str = parse_date(period)
                    if not date_str:
                        continue

                    # 報酬額
                    amount = parse_yen(row.get('報酬額', '0'))

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
                        print(f"  Warning: Account item 'アフィリエイト' not found")
                        continue
                    account_item_id = ai_res.data[0]['id']

                    records.append({
                        'date': date_str,
                        'amount': amount,
                        'media_id': media_id,
                        'asp_id': asp_id,
                        'account_item_id': account_item_id
                    })
                    print(f"  {date_str}: {amount}円")

            # DB保存
            if records:
                print(f"Saving {len(records)} records...")
                now = datetime.now()
                start_date = now.strftime('%Y-%m-01')
                end_date = now.strftime('%Y-%m-%d')

                try:
                    supabase.table('daily_actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).gte('date', start_date).lte('date', end_date).execute()
                except Exception as e:
                    print(f"Delete failed: {e}")

                result = supabase.table('daily_actuals').insert(records).execute()
                print(f"Inserted {len(result.data)} records")

                # ASPのスクレイピング状況を更新（カラムが存在する場合のみ）
                try:
                    supabase.table('asps').update({
                        'last_scrape_at': datetime.now().isoformat(),
                        'last_scrape_status': 'success'
                    }).eq('id', asp_id).execute()
                except Exception as e:
                    print(f"Note: Could not update ASP status: {e}")

                return {"success": True, "records_saved": len(result.data)}
            else:
                print("No records found")
                return {"success": True, "records_saved": 0}

        except Exception as e:
            print(f"Scraping failed: {e}")
            try:
                page.screenshot(path="/tmp/moshimo_daily_error.png")
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
