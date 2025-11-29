"""
汎用スクレイパーベースクラス

ASP IDとメディアIDをパラメータとして受け取り、
認証情報はasp_credentialsテーブルから動的に取得する。
"""
import os
import time
import random
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from supabase import create_client, Client


class BaseScraper(ABC):
    """
    スクレイパーの基底クラス

    Usage:
        class MoshimoScraper(BaseScraper):
            def login(self, page):
                # ログイン処理

            def scrape_daily(self, page):
                # スクレイピング処理
                return [{"date": "2025-01-01", "amount": 1000}, ...]

        # 実行
        scraper = MoshimoScraper(asp_id="xxx", media_id="yyy")
        result = scraper.run_daily()
    """

    def __init__(
        self,
        asp_id: str,
        media_id: str,
        headless: bool = True,
        max_retries: int = 3
    ):
        self.asp_id = asp_id
        self.media_id = media_id
        self.headless = headless
        self.max_retries = max_retries

        # Supabase接続
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)

        # キャッシュ
        self._asp_info: Optional[Dict] = None
        self._media_info: Optional[Dict] = None
        self._credentials: Optional[Dict] = None
        self._account_item_id: Optional[str] = None

    # ==================== プロパティ ====================

    @property
    def asp_info(self) -> Dict:
        """ASP情報を取得（キャッシュ）"""
        if self._asp_info is None:
            result = self.supabase.table('asps').select('*').eq('id', self.asp_id).execute()
            if not result.data:
                raise ValueError(f"ASP not found: {self.asp_id}")
            self._asp_info = result.data[0]
        return self._asp_info

    @property
    def media_info(self) -> Dict:
        """メディア情報を取得（キャッシュ）"""
        if self._media_info is None:
            result = self.supabase.table('media').select('*').eq('id', self.media_id).execute()
            if not result.data:
                raise ValueError(f"Media not found: {self.media_id}")
            self._media_info = result.data[0]
        return self._media_info

    @property
    def credentials(self) -> Dict:
        """認証情報を取得（asp_credentialsテーブルから）"""
        if self._credentials is None:
            result = self.supabase.table('asp_credentials').select('*').eq(
                'asp_id', self.asp_id
            ).eq(
                'media_id', self.media_id
            ).execute()

            if not result.data:
                raise ValueError(
                    f"Credentials not found for ASP={self.asp_id}, Media={self.media_id}"
                )
            self._credentials = result.data[0]
        return self._credentials

    @property
    def username(self) -> str:
        """ユーザー名を取得"""
        return self.credentials.get('username_secret_key', '')

    @property
    def password(self) -> str:
        """パスワードを取得"""
        return self.credentials.get('password_secret_key', '')

    @property
    def account_item_id(self) -> str:
        """アカウント項目IDを取得（アフィリエイト）"""
        if self._account_item_id is None:
            result = self.supabase.table('account_items').select('id').eq(
                'media_id', self.media_id
            ).eq('name', 'アフィリエイト').execute()

            if not result.data:
                raise ValueError(f"Account item 'アフィリエイト' not found for media {self.media_id}")
            self._account_item_id = result.data[0]['id']
        return self._account_item_id

    @property
    def asp_name(self) -> str:
        """ASP名"""
        return self.asp_info.get('name', '')

    @property
    def media_name(self) -> str:
        """メディア名"""
        return self.media_info.get('name', '')

    @property
    def login_url(self) -> str:
        """ログインURL"""
        return self.asp_info.get('login_url', '')

    # ==================== ユーティリティ ====================

    @staticmethod
    def human_delay(min_ms: int = 500, max_ms: int = 1500):
        """人間らしいランダムな待機時間"""
        time.sleep(random.randint(min_ms, max_ms) / 1000)

    @staticmethod
    def parse_yen(value: str) -> int:
        """¥123,456 形式の文字列を整数に変換"""
        if not value:
            return 0
        cleaned = value.replace('¥', '').replace('\\', '').replace(',', '').strip()
        if not cleaned:
            return 0
        try:
            return int(cleaned)
        except ValueError:
            return 0

    @staticmethod
    def parse_date_jp(value: str) -> Optional[str]:
        """2025年11月01日 形式を 2025-11-01 に変換"""
        try:
            parts = value.replace('年', '-').replace('月', '-').replace('日', '')
            year, month, day = parts.split('-')
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except:
            return None

    @staticmethod
    def parse_month_jp(value: str) -> Optional[str]:
        """2025年01月 形式を 2025-01-01 に変換"""
        try:
            parts = value.replace('年', '-').replace('月', '')
            year, month = parts.split('-')
            return f"{year}-{month.zfill(2)}-01"
        except:
            return None

    def create_download_dir(self, prefix: str = "download") -> Path:
        """一時ダウンロードディレクトリを作成"""
        download_dir = Path(f"/tmp/{prefix}_{int(time.time())}")
        download_dir.mkdir(parents=True, exist_ok=True)
        return download_dir

    # ==================== 抽象メソッド ====================

    @abstractmethod
    def login(self, page: Page) -> bool:
        """
        ログイン処理（サブクラスで実装）

        Returns:
            bool: ログイン成功ならTrue
        """
        pass

    @abstractmethod
    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """
        日次データのスクレイピング（サブクラスで実装）

        Returns:
            List[Dict]: [{"date": "2025-01-01", "amount": 1000}, ...]
        """
        pass

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """
        月次データのスクレイピング（オプション）

        Returns:
            List[Dict]: [{"date": "2025-01-01", "amount": 10000}, ...]
        """
        raise NotImplementedError("Monthly scraping not implemented")

    # ==================== 実行メソッド ====================

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
            print(f"ASP: {self.asp_name}, Media: {self.media_name}")

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
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                slow_mo=1000 if not self.headless else 0
            )
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()

            try:
                # ログイン
                print(f"Logging in to {self.asp_name}...")
                if not self.login(page):
                    return {"success": False, "error": "Login failed"}

                print("Login successful")
                self.human_delay(1000, 2000)

                # スクレイピング
                print("Scraping daily data...")
                records = self.scrape_daily(page)

                # データ保存
                if records:
                    saved_count = self._save_daily_records(records)
                    return {"success": True, "records_saved": saved_count}
                else:
                    print("No records found")
                    return {"success": True, "records_saved": 0}

            except Exception as e:
                print(f"Scraping failed: {e}")
                self._take_error_screenshot(page)
                return {"success": False, "error": str(e)}
            finally:
                browser.close()

    def _execute_monthly(self) -> Dict[str, Any]:
        """月次スクレイピング実行"""
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                slow_mo=1000 if not self.headless else 0
            )
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()

            try:
                # ログイン
                print(f"Logging in to {self.asp_name}...")
                if not self.login(page):
                    return {"success": False, "error": "Login failed"}

                print("Login successful")
                self.human_delay(1000, 2000)

                # スクレイピング
                print("Scraping monthly data...")
                records = self.scrape_monthly(page)

                # データ保存
                if records:
                    saved_count = self._save_monthly_records(records)
                    return {"success": True, "records_saved": saved_count}
                else:
                    print("No records found")
                    return {"success": True, "records_saved": 0}

            except Exception as e:
                print(f"Scraping failed: {e}")
                self._take_error_screenshot(page)
                return {"success": False, "error": str(e)}
            finally:
                browser.close()

    # ==================== データ保存 ====================

    def _save_daily_records(self, records: List[Dict]) -> int:
        """日次レコードを保存"""
        # レコードにメタデータを追加
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

        # 既存データを削除（今月分）
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

        # 新規データを挿入
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

        # 既存データを削除（今年分）
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

        # 新規データを挿入
        print(f"Inserting {len(enriched_records)} records...")
        result = self.supabase.table('actuals').insert(enriched_records).execute()

        return len(result.data)

    # ==================== ステータス更新 ====================

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

    def _take_error_screenshot(self, page: Page):
        """エラー時のスクリーンショットを保存"""
        try:
            filename = f"/tmp/{self.asp_name.replace(' ', '_')}_error_{int(time.time())}.png"
            page.screenshot(path=filename)
            print(f"Error screenshot saved: {filename}")
        except:
            pass


# ==================== ヘルパー関数 ====================

def get_scraper_params(asp_name: str, media_name: str) -> tuple:
    """
    ASP名とメディア名からIDを取得するヘルパー

    Usage:
        asp_id, media_id = get_scraper_params("もしも（ビギナーズ）", "ビギナーズ")
        scraper = MoshimoScraper(asp_id, media_id)
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    supabase = create_client(supabase_url, supabase_key)

    # ASP ID
    asp_result = supabase.table('asps').select('id').eq('name', asp_name).execute()
    if not asp_result.data:
        raise ValueError(f"ASP not found: {asp_name}")
    asp_id = asp_result.data[0]['id']

    # Media ID
    media_result = supabase.table('media').select('id').eq('name', media_name).execute()
    if not media_result.data:
        raise ValueError(f"Media not found: {media_name}")
    media_id = media_result.data[0]['id']

    return asp_id, media_id
