"""
Webridge スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
ドル建ての報酬を円に変換して保存。
"""
import csv
import requests
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class WebridgeScraper(BaseScraper):
    """Webridge スクレイパー"""

    LOGIN_URL = 'https://mobile.webridge.co.jp/login'
    DAILY_REPORT_URL = 'https://mobile.webridge.co.jp/report/daily'
    MONTHLY_REPORT_URL = 'https://mobile.webridge.co.jp/report/monthly'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._usd_jpy_rate = None

    @property
    def usd_jpy_rate(self) -> float:
        """USD/JPY 為替レートを取得（キャッシュ）"""
        if self._usd_jpy_rate is None:
            try:
                response = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=10)
                data = response.json()
                self._usd_jpy_rate = data['rates']['JPY']
                print(f"USD/JPY rate: {self._usd_jpy_rate}")
            except Exception as e:
                print(f"Failed to get exchange rate: {e}, using default 150.0")
                self._usd_jpy_rate = 150.0
        return self._usd_jpy_rate

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        login_url = self.login_url or self.LOGIN_URL
        print(f"Navigating to {login_url}...")
        page.goto(login_url)
        page.wait_for_load_state("networkidle")
        self.human_delay(1000, 2000)

        # 人間らしいタイピング
        page.click("input[name='loginUser']")
        self.human_delay(200, 500)
        page.fill("input[name='loginUser']", self.username)
        self.human_delay(500, 1000)

        page.click("input[name='loginPassword']")
        self.human_delay(200, 500)
        page.fill("input[name='loginPassword']", self.password)
        self.human_delay(500, 1000)

        # Enterキーでログイン
        page.press("input[name='loginPassword']", "Enter")
        page.wait_for_load_state("networkidle")
        self.human_delay(2000, 3000)

        # ログイン後のスクリーンショット
        page.screenshot(path="/tmp/webridge_after_login.png")

        # 500エラーページかどうかチェック（reCAPTCHA block）
        if "500" in page.title() or page.locator("text=500 Internal Server Error").count() > 0:
            print("Detected 500 error page (reCAPTCHA block)")
            return False

        # ログイン成功確認
        if page.locator("text=ホーム").count() == 0 and "login" in page.url.lower():
            print("Login failed - still on login page")
            return False

        return True

    def _navigate_to_daily_report(self, page: Page):
        """日次レポートページへ移動"""
        print("Navigating to Daily Report...")

        # サイドバーの「詳細レポート」をクリックして展開
        detail_report = page.locator("text=詳細レポート").first
        if detail_report.is_visible():
            detail_report.click()
            self.human_delay(800, 1200)

        # 展開後に「日別」リンクを探してクリック
        daily_link = page.locator("a:has-text('日別')").first
        daily_link.wait_for(state="visible", timeout=5000)
        daily_link.click()
        page.wait_for_load_state("networkidle")
        self.human_delay(2000, 3000)

    def _navigate_to_monthly_report(self, page: Page):
        """月次レポートページへ移動"""
        print("Navigating to Monthly Report...")

        # サイドバーの「詳細レポート」をクリックして展開
        detail_report = page.locator("text=詳細レポート").first
        if detail_report.is_visible():
            detail_report.click()
            self.human_delay(800, 1200)

        # 展開後に「月別」リンクを探してクリック
        monthly_link = page.locator("a:has-text('月別')").first
        monthly_link.wait_for(state="visible", timeout=5000)
        monthly_link.click()
        page.wait_for_load_state("networkidle")
        self.human_delay(2000, 3000)

    def _set_search_period_this_month(self, page: Page):
        """検索期間を今月に設定"""
        print("Opening search conditions...")
        search_btn = page.locator("text=条件を追加して検索").first
        if search_btn.is_visible():
            search_btn.click()
            self.human_delay(1000, 1500)

        print("Setting date range: This Month...")
        this_month_radio = page.locator("label:has-text('今月')").first
        if this_month_radio.is_visible():
            this_month_radio.click()
            self.human_delay(500, 800)

        print("Executing search...")
        search_exec_btn = page.locator("button:has-text('検索実行')").first
        search_exec_btn.click()
        page.wait_for_load_state("networkidle")
        self.human_delay(3000, 4000)

    def _set_search_period_this_year(self, page: Page):
        """検索期間を今年に設定"""
        print("Opening search conditions...")
        search_btn = page.locator("text=条件を追加して検索").first
        if search_btn.is_visible():
            search_btn.click()
            self.human_delay(1000, 1500)

        print("Setting date range: This Year...")
        this_year_radio = page.locator("label:has-text('今年')").first
        if this_year_radio.is_visible():
            this_year_radio.click()
            self.human_delay(500, 800)

        print("Executing search...")
        search_exec_btn = page.locator("button:has-text('検索実行')").first
        search_exec_btn.click()
        page.wait_for_load_state("networkidle")
        self.human_delay(3000, 4000)

    def _download_csv(self, page: Page, download_dir: Path) -> Path:
        """CSVダウンロード"""
        print("Downloading CSV...")
        with page.expect_download() as download_info:
            page.click("button:has-text('CSVダウンロード'), a:has-text('CSVダウンロード')")

        download = download_info.value
        csv_path = download_dir / download.suggested_filename
        download.save_as(csv_path)
        print(f"CSV downloaded to: {csv_path}")
        return csv_path

    def _parse_csv(self, csv_path: Path, is_monthly: bool = False) -> List[Dict[str, Any]]:
        """CSVを解析してレコードリストを返す"""
        records = []
        usd_rate = self.usd_jpy_rate

        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            print(f"CSV Headers: {headers}")

            for row in reader:
                # 日付カラム
                if is_monthly:
                    date_str = row.get('年月') or row.get('Month')
                    if date_str and not date_str.endswith('-01'):
                        # 2025-11 -> 2025-11-01
                        date_str = f"{date_str}-01"
                else:
                    date_str = row.get('年月日') or row.get('Date') or row.get('date')

                if not date_str:
                    continue

                # 承認報酬 (Approved Commissions)
                amount_usd = 0.0
                # 日本語カラム名
                amount_cols = [k for k in row.keys() if '承認' in k and '報酬' in k]
                # 英語カラム名
                if not amount_cols:
                    amount_cols = [k for k in row.keys() if 'approved' in k.lower() and 'commission' in k.lower()]

                if amount_cols:
                    raw_val = row[amount_cols[0]]
                    clean_val = raw_val.replace('$', '').replace(',', '').strip()
                    if clean_val:
                        try:
                            amount_usd = float(clean_val)
                        except ValueError:
                            print(f"Warning: Could not parse amount: {raw_val}")
                            continue

                amount_jpy = int(amount_usd * usd_rate)
                print(f"  {date_str}: ${amount_usd} -> ¥{amount_jpy}")

                records.append({
                    'date': date_str,
                    'amount': amount_jpy,
                })

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        download_dir = self.create_download_dir("webridge_daily")

        self._navigate_to_daily_report(page)
        self._set_search_period_this_month(page)
        csv_path = self._download_csv(page, download_dir)
        records = self._parse_csv(csv_path, is_monthly=False)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        download_dir = self.create_download_dir("webridge_monthly")

        self._navigate_to_monthly_report(page)
        self._set_search_period_this_year(page)
        csv_path = self._download_csv(page, download_dir)
        records = self._parse_csv(csv_path, is_monthly=True)

        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="Webridge Scraper")
    parser.add_argument('--asp', default='Webridge（ビギナーズ・OJ）', help='ASP name')
    parser.add_argument('--media', default='ビギナーズ', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = WebridgeScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
