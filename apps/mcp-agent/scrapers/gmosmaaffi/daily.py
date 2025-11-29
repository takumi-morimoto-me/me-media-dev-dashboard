"""GMO SmaAFFI daily scraper."""

import os
import time
import csv
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from supabase import create_client

def run_scraper():
    """GMO SmaAFFI 日次データ取得スクレイパー"""
    
    # Supabase接続
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 認証情報
    username = os.getenv('GMOSMAAFFI_USERNAME')
    password = os.getenv('GMOSMAAFFI_PASSWORD')
    
    if not username or not password:
        print("Error: GMO SmaAFFI credentials not found")
        return {"success": False, "records_saved": 0, "error": "Missing credentials"}
    
    # ASP情報を取得
    asp_name = "SmaAD"
    asp_response = client.table('asps').select('id').eq('name', asp_name).execute()
    
    if not asp_response.data:
        print(f"Error: ASP '{asp_name}' not found in database")
        return {"success": False, "records_saved": 0, "error": "ASP not found"}
    
    asp_id = asp_response.data[0]['id']
    
    # メディア情報を取得 (ReRe)
    media_response = client.table('media').select('id').eq('name', 'ReRe').execute()
    if not media_response.data:
        return {"success": False, "records_saved": 0, "error": "Media not found"}
    
    media_id = media_response.data[0]['id']
    
    # account_item_id (アフィリエイト)
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    account_item_id = account_item_response.data[0]['id'] if account_item_response.data else None

    # スクレイピング
    with sync_playwright() as p:
        # ダウンロード設定
        download_dir = "/tmp/gmosmaaffi_downloads_daily"
        os.makedirs(download_dir, exist_ok=True)
        
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            print("Logging in to GMO SmaAFFI...")
            page.goto("https://console.smaad.net/media/login")
            page.wait_for_timeout(2000)
            
            if page.locator("input[name='email']").is_visible():
                print("Login form found, submitting credentials...")
                page.fill("input[name='email']", username)
                page.fill("input[name='password']", password)
                page.click("button[type='submit'], input[type='submit']")
                page.wait_for_timeout(5000)
            
            # ログイン後の確認
            print(f"Current URL: {page.url}")
            
            print("Navigating to Daily Report...")
            # 直接遷移
            page.goto("https://console.smaad.net/media/media_report/by_day")
            page.wait_for_timeout(2000)
            
            # 媒体名を「ビギナーズ」で選択
            print("Selecting media: Beginners...")
            try:
                page.select_option("select[name='media_id']", value="767506694")
            except Exception as e:
                print(f"Media selection failed: {e}")
                try:
                    page.select_option("select[name='media_id']", label="ビギナーズ ")
                except:
                    print("Media selection fallback failed")
            
            # 期間指定: 2025/11/01 〜
            print("Setting date period...")
            
            try:
                # 日次レポートは name="from_date", name="to_date" と推測
                page.fill("input[name='from_date']", "2025/11/01")
                
                today_str = datetime.now().strftime('%Y/%m/%d')
                page.fill("input[name='to_date']", today_str)
                
                # フォーカスを外す
                page.evaluate("document.querySelector(\"input[name='to_date']\").blur()")
            except Exception as e:
                print(f"Date selection failed: {e}")
                # 失敗時はHTMLダンプ
                with open("/tmp/gmosmaaffi_daily_error.html", "w") as f:
                    f.write(page.content())
                raise e
            
            # 検索ボタン
            print("Clicking Search...")
            page.click("input[value='検索']")
            page.wait_for_timeout(5000)
            
            # CSVダウンロード
            print("Downloading CSV...")
            with page.expect_download() as download_info:
                page.click("button:has-text('CSVダウンロード'), a:has-text('CSVダウンロード')")
            
            download = download_info.value
            csv_path = os.path.join(download_dir, download.suggested_filename)
            download.save_as(csv_path)
            print(f"CSV downloaded to: {csv_path}")
            
            # CSV解析とDB保存
            records = []
            # エンコーディングを cp932 に変更
            with open(csv_path, 'r', encoding='cp932') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # カラム名は実際のCSVに合わせて調整が必要
                    # スクリーンショットのカラムは月別と同じような構成と推測
                    
                    amount_str = row.get('発生金額', '0').replace('¥', '').replace(',', '').strip()
                    amount = int(amount_str) if amount_str else 0
                    
                    date_str = row.get('日付', '') # 2025/11/01 形式と仮定
                    if not date_str:
                        date_str = row.get('日別', '')

                    if date_str and amount >= 0: # 0円でもレコードはあるかもしれない
                        try:
                            # 日付フォーマットの正規化
                            date_obj = datetime.strptime(date_str, '%Y/%m/%d')
                            formatted_date = date_obj.strftime('%Y-%m-%d')
                            
                            records.append({
                                'date': formatted_date,
                                'amount': amount,
                                'media_id': media_id,
                                'asp_id': asp_id,
                                'account_item_id': account_item_id
                            })
                        except ValueError:
                            print(f"Skipping invalid date format: {date_str}")

            browser.close()
            
            # DB保存
            if records:
                print(f"Saving {len(records)} records to database...")
                # 日次データは delete -> insert で更新
                
                # 期間内のデータを削除
                start_date = "2025-11-01"
                end_date = datetime.now().strftime('%Y-%m-%d')
                
                client.table('daily_actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).gte('date', start_date).lte('date', end_date).execute()
                
                # insert
                result = client.table('daily_actuals').insert(records).execute()
                print(f"Inserted {len(result.data)} records")
                return {"success": True, "records_saved": len(result.data)}
            
            return {"success": True, "records_saved": 0}
            
        except Exception as e:
            print(f"Error: {e}")
            browser.close()
            return {"success": False, "records_saved": 0, "error": str(e)}

if __name__ == "__main__":
    run_scraper()
