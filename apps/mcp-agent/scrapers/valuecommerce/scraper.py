"""
バリューコマース スクレイパー

APIベースのスクレイピング（requestsを使用）
認証情報はasp_credentialsテーブルから取得。
"""
import os
import re
import time
import random
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from supabase import create_client


class ValueCommerceScraper:
    """バリューコマース用スクレイパー（APIベース）"""

    LOGIN_URL = 'https://aff.valuecommerce.ne.jp/login/'
    HOME_URL = 'https://aff.valuecommerce.ne.jp/home'
    FINANCE_API_URL = 'https://aff.valuecommerce.ne.jp/reportApi/finance'
    STATS_API_URL = 'https://aff.valuecommerce.ne.jp/reportApi/stats'

    def __init__(
        self,
        asp_id: str,
        media_id: str,
        headless: bool = True,  # 互換性のため（API使用なので無視）
        max_retries: int = 3
    ):
        self.asp_id = asp_id
        self.media_id = media_id
        self.max_retries = max_retries

        # Supabase接続
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

        self.supabase = create_client(self.supabase_url, self.supabase_key)

        # キャッシュ
        self._asp_info: Optional[Dict] = None
        self._credentials: Optional[Dict] = None
        self._account_item_id: Optional[str] = None

        # HTTPセッション
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        self.session.cookies.set('I_do_Javascript', 'yes', domain='aff.valuecommerce.ne.jp')

        self._csrf_token: Optional[str] = None
        self._api_csrf_token: Optional[str] = None

    @property
    def asp_info(self) -> Dict:
        """ASP情報を取得"""
        if self._asp_info is None:
            result = self.supabase.table('asps').select('*').eq('id', self.asp_id).execute()
            if not result.data:
                raise ValueError(f"ASP not found: {self.asp_id}")
            self._asp_info = result.data[0]
        return self._asp_info

    @property
    def credentials(self) -> Dict:
        """認証情報を取得"""
        if self._credentials is None:
            result = self.supabase.table('asp_credentials').select('*').eq(
                'asp_id', self.asp_id
            ).eq(
                'media_id', self.media_id
            ).execute()

            if not result.data:
                raise ValueError(f"Credentials not found for ASP={self.asp_id}, Media={self.media_id}")
            self._credentials = result.data[0]
        return self._credentials

    @property
    def username(self) -> str:
        return self.credentials.get('username_secret_key', '')

    @property
    def password(self) -> str:
        return self.credentials.get('password_secret_key', '')

    @property
    def asp_name(self) -> str:
        return self.asp_info.get('name', '')

    @property
    def account_item_id(self) -> str:
        """アカウント項目IDを取得"""
        if self._account_item_id is None:
            result = self.supabase.table('account_items').select('id').eq(
                'media_id', self.media_id
            ).eq('name', 'アフィリエイト').execute()

            if not result.data:
                raise ValueError(f"Account item 'アフィリエイト' not found for media {self.media_id}")
            self._account_item_id = result.data[0]['id']
        return self._account_item_id

    @staticmethod
    def human_delay(min_ms: int = 500, max_ms: int = 1500):
        """人間らしいランダムな待機時間"""
        time.sleep(random.randint(min_ms, max_ms) / 1000)

    def login(self) -> bool:
        """バリューコマースにログイン"""
        # ログインページからCSRFトークンを取得
        resp = self.session.get(self.LOGIN_URL)
        if resp.status_code != 200:
            print(f"Failed to get login page: {resp.status_code}")
            return False

        soup = BeautifulSoup(resp.text, 'html.parser')
        token_input = soup.find('input', {'id': 'login_form__token'})
        if not token_input:
            print("CSRF token not found on login page")
            return False

        self._csrf_token = token_input.get('value')

        # ログインPOST
        login_data = {
            'login_form[emailAddress]': self.username,
            'login_form[encryptedPasswd]': self.password,
            'login_form[_token]': self._csrf_token
        }

        self.human_delay(500, 1000)
        resp = self.session.post(self.LOGIN_URL, data=login_data)

        # ログイン成功確認
        if 'home' not in resp.url:
            print(f"Login failed, redirected to: {resp.url}")
            return False

        # API用CSRFトークンを取得
        soup = BeautifulSoup(resp.text, 'html.parser')
        api_csrf_meta = soup.find('meta', {'name': 'vue-csrf-token'})
        if api_csrf_meta:
            self._api_csrf_token = api_csrf_meta.get('content')

        return True

    def scrape_daily(self) -> List[Dict[str, Any]]:
        """日別レポートをスクレイピング（stats API）"""
        # Note: ValueCommerceのstats APIは集計データなので、
        # 日別の詳細データが取得できない場合は空を返す
        records = []

        today = datetime.now()
        start_date = today.replace(day=1).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')

        headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': self._api_csrf_token,
            'Accept': 'application/json'
        }

        payload = {
            'startDate': start_date,
            'endDate': end_date,
            'groupBy': 'daily'
        }

        resp = self.session.post(self.STATS_API_URL, json=payload, headers=headers)

        if resp.status_code != 200:
            print(f"Stats API failed: {resp.status_code}")
            return records

        data = resp.json()

        if not data.get('isValid'):
            print("Stats API returned invalid data")
            return records

        for item in data.get('list', []):
            # 日付フォーマットを変換
            date_str = item.get('date', '')
            if '/' in date_str:
                parts = date_str.split('/')
                if len(parts) == 3:
                    date_str = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif len(parts) == 2:
                    date_str = f"{parts[0]}-{parts[1].zfill(2)}-01"

            amount = item.get('commission', 0) or item.get('amount', 0)

            records.append({
                'date': date_str,
                'amount': int(amount),
            })
            print(f"  {date_str}: {amount}円")

        return records

    def scrape_monthly(self) -> List[Dict[str, Any]]:
        """月別レポートをスクレイピング（finance API）"""
        records = []

        today = datetime.now()
        start_date = '2025-01-01'
        end_date = today.strftime('%Y-%m-%d')

        headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': self._api_csrf_token,
            'Accept': 'application/json'
        }

        payload = {
            'startDate': start_date,
            'endDate': end_date,
        }

        print("Fetching finance data...")
        resp = self.session.post(self.FINANCE_API_URL, json=payload, headers=headers)

        if resp.status_code != 200:
            print(f"Finance API failed: {resp.status_code}")
            return records

        data = resp.json()

        if not data.get('isValid'):
            print("Finance API returned invalid data")
            return records

        for item in data.get('list', []):
            # 日付フォーマット: "2025/09" -> "2025-09-01"
            date_str = item.get('date', '')
            if '/' in date_str:
                parts = date_str.split('/')
                date_str = f"{parts[0]}-{parts[1].zfill(2)}-01"

            amount = item.get('amount', 0)

            records.append({
                'date': date_str,
                'amount': int(amount),
            })
            print(f"  {item.get('date')}: {amount}円")

        return records

    def run_daily(self) -> Dict[str, Any]:
        """日次スクレイピングを実行"""
        return self._run_with_retry(self._execute_daily)

    def run_monthly(self) -> Dict[str, Any]:
        """月次スクレイピングを実行"""
        return self._run_with_retry(self._execute_monthly)

    def _run_with_retry(self, execute_func) -> Dict[str, Any]:
        """リトライ付き実行"""
        for attempt in range(1, self.max_retries + 1):
            print(f"\n=== Attempt {attempt}/{self.max_retries} ===")
            print(f"ASP: {self.asp_name}")

            try:
                result = execute_func()
                if result.get("success"):
                    self._update_asp_status("success")
                    return result
            except Exception as e:
                print(f"Attempt {attempt} failed: {e}")
                result = {"success": False, "error": str(e)}

            if attempt < self.max_retries:
                wait_time = 10 * attempt
                print(f"Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)

        self._update_asp_status("failed", str(result.get("error", "Unknown error")))
        return {"success": False, "error": f"Failed after {self.max_retries} attempts"}

    def _execute_daily(self) -> Dict[str, Any]:
        """日次スクレイピング実行"""
        print(f"Logging in to {self.asp_name}...")
        if not self.login():
            return {"success": False, "error": "Login failed"}

        print("Login successful")
        self.human_delay(1000, 2000)

        print("Scraping daily data...")
        records = self.scrape_daily()

        if records:
            saved_count = self._save_daily_records(records)
            return {"success": True, "records_saved": saved_count}
        else:
            print("No daily records found (this may be normal for ValueCommerce)")
            return {"success": True, "records_saved": 0}

    def _execute_monthly(self) -> Dict[str, Any]:
        """月次スクレイピング実行"""
        print(f"Logging in to {self.asp_name}...")
        if not self.login():
            return {"success": False, "error": "Login failed"}

        print("Login successful")
        self.human_delay(1000, 2000)

        print("Scraping monthly data...")
        records = self.scrape_monthly()

        if records:
            saved_count = self._save_monthly_records(records)
            return {"success": True, "records_saved": saved_count}
        else:
            print("No records found")
            return {"success": True, "records_saved": 0}

    def _save_daily_records(self, records: List[Dict]) -> int:
        """日次レコードを保存"""
        enriched_records = []
        for record in records:
            enriched_records.append({
                'date': record['date'],
                'amount': record['amount'],
                'media_id': self.media_id,
                'asp_id': self.asp_id,
                'account_item_id': self.account_item_id,
            })

        if not enriched_records:
            return 0

        now = datetime.now()
        start_date = now.strftime('%Y-%m-01')
        end_date = now.strftime('%Y-%m-%d')

        print(f"Deleting existing records from {start_date} to {end_date}...")
        try:
            self.supabase.table('daily_actuals').delete().eq(
                'asp_id', self.asp_id
            ).eq(
                'media_id', self.media_id
            ).gte('date', start_date).lte('date', end_date).execute()
        except Exception as e:
            print(f"Delete failed (might be OK): {e}")

        print(f"Inserting {len(enriched_records)} records...")
        result = self.supabase.table('daily_actuals').insert(enriched_records).execute()

        return len(result.data)

    def _save_monthly_records(self, records: List[Dict]) -> int:
        """月次レコードを保存"""
        enriched_records = []
        for record in records:
            enriched_records.append({
                'date': record['date'],
                'amount': record['amount'],
                'media_id': self.media_id,
                'asp_id': self.asp_id,
                'account_item_id': self.account_item_id,
            })

        if not enriched_records:
            return 0

        start_date = "2025-01-01"
        end_date = datetime.now().strftime('%Y-%m-%d')

        print(f"Deleting existing records from {start_date} to {end_date}...")
        try:
            self.supabase.table('actuals').delete().eq(
                'asp_id', self.asp_id
            ).eq(
                'media_id', self.media_id
            ).gte('date', start_date).lte('date', end_date).execute()
        except Exception as e:
            print(f"Delete failed (might be OK): {e}")

        print(f"Inserting {len(enriched_records)} records...")
        result = self.supabase.table('actuals').insert(enriched_records).execute()

        return len(result.data)

    def _update_asp_status(self, status: str, notes: str = None):
        """ASPのスクレイピングステータスを更新"""
        try:
            update_data = {
                'last_scrape_at': datetime.now().isoformat(),
                'last_scrape_status': status,
            }
            if notes:
                update_data['scrape_notes'] = notes[:500]

            self.supabase.table('asps').update(update_data).eq('id', self.asp_id).execute()
        except Exception as e:
            print(f"Note: Could not update ASP status: {e}")


def get_scraper_params(asp_name: str, media_name: str) -> tuple:
    """ASP名とメディア名からIDを取得"""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    supabase = create_client(supabase_url, supabase_key)

    asp_result = supabase.table('asps').select('id').eq('name', asp_name).execute()
    if not asp_result.data:
        raise ValueError(f"ASP not found: {asp_name}")
    asp_id = asp_result.data[0]['id']

    media_result = supabase.table('media').select('id').eq('name', media_name).execute()
    if not media_result.data:
        raise ValueError(f"Media not found: {media_name}")
    media_id = media_result.data[0]['id']

    return asp_id, media_id


def run_daily(asp_id: str = None, media_id: str = None, headless: bool = True):
    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params("バリューコマース（ReRe）", "ReRe")

    scraper = ValueCommerceScraper(asp_id, media_id, headless=headless)
    return scraper.run_daily()


def run_monthly(asp_id: str = None, media_id: str = None, headless: bool = True):
    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params("バリューコマース（ReRe）", "ReRe")

    scraper = ValueCommerceScraper(asp_id, media_id, headless=headless)
    return scraper.run_monthly()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="バリューコマース スクレイパー")
    parser.add_argument('--asp-id', help='ASP ID')
    parser.add_argument('--media-id', help='Media ID')
    parser.add_argument('--asp-name', default='バリューコマース（ReRe）', help='ASP名')
    parser.add_argument('--media-name', default='ReRe', help='メディア名')
    parser.add_argument('--daily', action='store_true', help='日次データを取得')
    parser.add_argument('--monthly', action='store_true', help='月次データを取得')

    args = parser.parse_args()

    asp_id = args.asp_id
    media_id = args.media_id

    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params(args.asp_name, args.media_name)
        print(f"Resolved: ASP={asp_id}, Media={media_id}")

    if args.monthly:
        result = run_monthly(asp_id, media_id)
    else:
        result = run_daily(asp_id, media_id)

    print(f"Result: {result}")
