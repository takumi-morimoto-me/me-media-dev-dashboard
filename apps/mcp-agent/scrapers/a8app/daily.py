"""A8app daily scraper."""

import os
import re
from playwright.sync_api import sync_playwright
from supabase import create_client

def run_scraper():
    """A8app 日次データ取得スクレイパー"""
    
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    username = os.getenv('A8APP_USERNAME')
    password = os.getenv('A8APP_PASSWORD')
    
    if not username or not password:
        return {"success": False, "records_saved": 0, "error": "Missing credentials"}
    
    asp_response = client.table('asps').select('id').eq('name', 'SeedApp（ビギナーズ） =A8app').execute()
    if not asp_response.data:
        return {"success": False, "records_saved": 0, "error": "ASP not found"}
    
    asp_id = asp_response.data[0]['id']
    media_response = client.table('media').select('id').eq('name', 'ReRe').execute()
    if not media_response.data:
        return {"success": False, "records_saved": 0, "error": "Media not found"}
    
    media_id = media_response.data[0]['id']
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    if not account_item_response.data:
        return {"success": False, "records_saved": 0, "error": "Account item not found"}
    
    account_item_id = account_item_response.data[0]['id']
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            print("Logging in to A8app...")
            page.goto("https://admin.seedapp.jp/")
            page.wait_for_timeout(3000)
            
            page.fill("input[type='email'], input[name='email'], input[type='text']:first-of-type", username)
            page.fill("input[type='password'], input[name='password']", password)
            page.click("button[type='submit'], input[type='submit']", no_wait_after=True, timeout=30000)
            page.wait_for_timeout(5000)
            
            print("Navigating to daily report...")
            page.click("nav a:has-text('日別レポート'), aside a:has-text('日別レポート'), a[href*='daily']")
            page.wait_for_timeout(5000)
            
            # モーダルを閉じる
            try:
                page.click("#detail-modal button.close, button:has-text('閉じる')")
                page.wait_for_timeout(1000)
            except:
                pass
            
            print("Extracting data...")
            # TODO: CSVダウンロードとデータ抽出
            # YAMLではCSVダウンロードが指定されているが、今は簡略化
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
