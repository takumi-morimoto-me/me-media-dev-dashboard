"""afb（アフィリエイトB） daily scraper."""

import os
import re
from playwright.sync_api import sync_playwright
from supabase import create_client

def run_scraper():
    """afb 日次データ取得スクレイパー"""
    
    # Supabase接続
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 認証情報
    username = os.getenv('AFB_USERNAME')
    password = os.getenv('AFB_PASSWORD')
    
    if not username or not password:
        print("Error: AFB credentials not found in environment variables")
        return {"success": False, "records_saved": 0, "error": "Missing credentials"}
    
    # ASP情報を取得
    asp_response = client.table('asps').select('id').eq('name', 'afb（ビギナーズ・OJ）').execute()
    if not asp_response.data:
        print("Error: afb not found in database")
        return {"success": False, "records_saved": 0, "error": "ASP not found"}
    
    asp_id = asp_response.data[0]['id']
    print(f"ASP ID: {asp_id}")
    
    # メディア情報を取得（ReRe）
    media_response = client.table('media').select('id,name').eq('name', 'ReRe').execute()
    if not media_response.data:
        print("Error: ReRe media not found")
        return {"success": False, "records_saved": 0, "error": "Media not found"}
    
    media_id = media_response.data[0]['id']
    print(f"Media ID: {media_id}")
    
    # account_item_id（アフィリエイト）を取得
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    if not account_item_response.data:
        print("Error: アフィリエイト account_item not found")
        return {"success": False, "records_saved": 0, "error": "Account item not found"}
    
    account_item_id = account_item_response.data[0]['id']
    print(f"Account Item ID: {account_item_id}")
    
    # ブラウザでスクレイピング
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # ログイン
            print("Navigating to afb...")
            page.goto("https://www.afi-b.com/")
            page.wait_for_timeout(2000)
            
            print("Filling login form...")
            page.fill("input[type='text']", username)
            page.fill("input[type='password']", password)
            
            print("Clicking login button...")
            page.click("input[type='submit'], button[type='submit']")
            page.wait_for_timeout(5000)
            
            # ポップアップを閉じる
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
            
            # 直接日別レポートページに移動
            print("Navigating to daily report...")
            page.goto("https://www.afi-b.com/pa/report/?r=daily")
            page.wait_for_timeout(3000)
            
            # 日別タブをクリック
            try:
                page.click("a[href*='#tab_btn_top'][title='日別レポート'], #tab_btn_top a:has-text('日別')")
                page.wait_for_timeout(2000)
            except:
                print("Daily tab click failed, continuing...")
            
            # レポート表示ボタンをクリック
            try:
                page.click("input[data-testid='daily-display-report'], input.send_report:visible")
                page.wait_for_timeout(5000)
            except:
                print("Display report button click failed, continuing...")
            
            # スクロールしてメインテーブルを表示
            page.evaluate("window.scrollBy(0, 500)")
            page.wait_for_timeout(1000)
            
            print("Extracting data from table...")
            # テーブルからデータを抽出
            tables = page.locator("table").all()
            print(f"Found {len(tables)} tables")
            
            records = []
            # TODO: テーブルからデータを抽出するロジックを実装
            # 今はテスト用にダミーデータ
            
            browser.close()
            
            # データベースに保存
            if records:
                print(f"Saving {len(records)} records to database...")
                # 既存データを削除
                client.table('daily_actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).execute()
                
                # 新規登録
                db_records = []
                for record in records:
                    db_records.append({
                        'date': record['date'],
                        'amount': record['amount'],
                        'media_id': media_id,
                        'asp_id': asp_id,
                        'account_item_id': account_item_id
                    })
                
                result = client.table('daily_actuals').insert(db_records).execute()
                print(f"Inserted {len(result.data)} records")
                
                return {"success": True, "records_saved": len(result.data)}
            else:
                print("No records extracted")
                return {"success": True, "records_saved": 0}
                
        except Exception as e:
            print(f"Error during scraping: {e}")
            browser.close()
            return {"success": False, "records_saved": 0, "error": str(e)}

if __name__ == "__main__":
    result = run_scraper()
    print(f"Result: {result}")
