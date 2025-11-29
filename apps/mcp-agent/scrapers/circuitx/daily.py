"""CircuitX daily scraper."""

import os
import re
from playwright.sync_api import sync_playwright
from supabase import create_client

def run_scraper():
    """CircuitX 日次データ取得スクレイパー"""
    
    # Supabase接続
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 認証情報
    username = os.getenv('CIRCUITX_USERNAME')
    password = os.getenv('CIRCUITX_PASSWORD')
    
    if not username or not password:
        print("Error: CircuitX credentials not found")
        return {"success": False, "records_saved": 0, "error": "Missing credentials"}
    
    # ASP情報を取得
    asp_response = client.table('asps').select('id').eq('name', 'CircuitX（ビギナーズ）').execute()
    if not asp_response.data:
        print("Error: CircuitX not found in database")
        return {"success": False, "records_saved": 0, "error": "ASP not found"}
    
    asp_id = asp_response.data[0]['id']
    
    # メディア情報を取得
    media_response = client.table('media').select('id').eq('name', 'ReRe').execute()
    if not media_response.data:
        return {"success": False, "records_saved": 0, "error": "Media not found"}
    
    media_id = media_response.data[0]['id']
    
    # account_item_id取得
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    if not account_item_response.data:
        return {"success": False, "records_saved": 0, "error": "Account item not found"}
    
    account_item_id = account_item_response.data[0]['id']
    
    # スクレイピング
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            print("Logging in to CircuitX...")
            page.goto("https://x-dashboard.cir.io/")
            page.wait_for_timeout(3000)
            
            page.fill("input[type='email'], input[name='email']", username)
            page.fill("input[type='password']", password)
            page.click("button[type='submit'], button:has-text('ログイン')")
            page.wait_for_timeout(5000)
            
            print("Navigating to reports...")
            page.click("a:has-text('レポート')")
            page.wait_for_timeout(3000)
            
            page.evaluate("window.scrollBy(0, 500)")
            page.wait_for_timeout(2000)
            
            page.click("span:has-text('日別'), a:has-text('日別'), button:has-text('日別')")
            page.wait_for_timeout(3000)
            
            print("Extracting data...")
            # TODO: テーブルからデータ抽出
            records = []
            
            browser.close()
            
            if records:
                client.table('daily_actuals').delete().eq('asp_id', asp_id).eq('media_id', media_id).execute()
                db_records = [{'date': r['date'], 'amount': r['amount'], 'media_id': media_id, 'asp_id': asp_id, 'account_item_id': account_item_id} for r in records]
                result = client.table('daily_actuals').insert(db_records).execute()
                return {"success": True, "records_saved": len(result.data)}
            
            return {"success": True, "records_saved": 0}
                
        except Exception as e:
            print(f"Error: {e}")
            browser.close()
            return {"success": False, "records_saved": 0, "error": str(e)}

if __name__ == "__main__":
    result = run_scraper()
    print(f"Result: {result}")
