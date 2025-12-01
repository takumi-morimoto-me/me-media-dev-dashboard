"""
GMO SmaAFFI (SmaAD) スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
"""
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class GmoSmaaffiScraper(BaseScraper):
    """GMO SmaAFFI (SmaAD) スクレイパー"""

    LOGIN_URL = 'https://console.smaad.net/media/login'
    DAILY_REPORT_URL = 'https://console.smaad.net/media/media_report/by_day'
    MONTHLY_REPORT_URL = 'https://console.smaad.net/media/media_report/by_month'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL)
        page.wait_for_timeout(2000)

        # ログインフォーム
        if page.locator("input[name='email']").is_visible():
            print("Filling login form...")
            page.fill("input[name='email']", self.username)
            page.fill("input[name='password']", self.password)
            page.click("button[type='submit'], input[type='submit']")
            page.wait_for_timeout(5000)

        # ログイン後の確認
        print(f"Current URL: {page.url}")

        # ログイン成功判定（ログインページから移動していれば成功）
        if "login" in page.url.lower():
            return False

        return True

    def _select_media(self, page: Page):
        """媒体を選択（メディア名に基づいて動的に選択）"""
        print(f"Selecting media: {self.media_name}...")
        try:
            # ラベルで選択
            page.select_option("select[name='media_id']", label=self.media_name)
        except Exception as e:
            print(f"Media selection by label failed: {e}")
            try:
                # 部分一致でも試す
                options = page.locator("select[name='media_id'] option").all()
                for opt in options:
                    text = opt.inner_text()
                    if self.media_name in text:
                        value = opt.get_attribute('value')
                        page.select_option("select[name='media_id']", value=value)
                        print(f"Selected media by partial match: {text}")
                        break
            except Exception as e2:
                print(f"Media selection fallback also failed: {e2}")

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

    def _parse_daily_csv(self, csv_path: Path) -> List[Dict[str, Any]]:
        """日次CSVを解析"""
        records = []

        # エンコーディングを cp932 (Shift-JIS拡張) に設定
        with open(csv_path, 'r', encoding='cp932') as f:
            reader = csv.DictReader(f)

            for row in reader:
                # 発生金額を取得
                amount_str = row.get('発生金額', '0').replace('¥', '').replace(',', '').strip()
                amount = int(amount_str) if amount_str else 0

                # 日付カラム
                date_str = row.get('日付', '') or row.get('日別', '')

                if date_str and amount >= 0:
                    try:
                        # 日付フォーマットの正規化 (2025/11/01 -> 2025-11-01)
                        date_obj = datetime.strptime(date_str, '%Y/%m/%d')
                        formatted_date = date_obj.strftime('%Y-%m-%d')

                        records.append({
                            'date': formatted_date,
                            'amount': amount,
                        })
                    except ValueError:
                        print(f"Skipping invalid date format: {date_str}")

        return records

    def _parse_monthly_csv(self, csv_path: Path) -> List[Dict[str, Any]]:
        """月次CSVを解析"""
        records = []

        with open(csv_path, 'r', encoding='cp932') as f:
            reader = csv.DictReader(f)

            for row in reader:
                # 発生金額を取得
                amount_str = row.get('発生金額', '0').replace('¥', '').replace(',', '').strip()
                amount = int(amount_str) if amount_str else 0

                # 月別カラム (2025/01 形式)
                month_str = row.get('月別', '')

                if month_str and amount > 0:
                    try:
                        date_obj = datetime.strptime(month_str, '%Y/%m')
                        date_str = date_obj.strftime('%Y-%m-01')

                        records.append({
                            'date': date_str,
                            'amount': amount,
                        })
                    except ValueError:
                        print(f"Skipping invalid date format: {month_str}")

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        download_dir = self.create_download_dir("gmosmaaffi_daily")

        print("Navigating to Daily Report...")
        page.goto(self.DAILY_REPORT_URL)
        page.wait_for_timeout(2000)

        self._select_media(page)

        # 期間指定
        print("Setting date period...")
        try:
            page.fill("input[name='from_date']", "2025/11/01")
            today_str = datetime.now().strftime('%Y/%m/%d')
            page.fill("input[name='to_date']", today_str)
            page.evaluate("document.querySelector(\"input[name='to_date']\").blur()")
        except Exception as e:
            print(f"Date selection failed: {e}")

        # 検索ボタン
        print("Clicking Search...")
        page.click("input[value='検索']")
        page.wait_for_timeout(5000)

        # CSVダウンロード
        csv_path = self._download_csv(page, download_dir)
        records = self._parse_daily_csv(csv_path)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        download_dir = self.create_download_dir("gmosmaaffi_monthly")

        print("Navigating to Monthly Report...")
        page.goto(self.MONTHLY_REPORT_URL)
        page.wait_for_timeout(2000)

        self._select_media(page)

        # 期間指定
        print("Setting date period...")
        try:
            page.fill("input[name='from_month']", "2025/01")
            current_month = datetime.now().strftime('%Y/%m')
            page.fill("input[name='to_month']", current_month)
            page.evaluate("document.querySelector(\"input[name='to_month']\").blur()")
        except Exception as e:
            print(f"Date selection failed: {e}")

        # 検索ボタン
        print("Clicking Search...")
        page.click("input[value='検索']")
        page.wait_for_timeout(5000)

        # CSVダウンロード
        csv_path = self._download_csv(page, download_dir)
        records = self._parse_monthly_csv(csv_path)

        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="GMO SmaAFFI Scraper")
    parser.add_argument('--asp', default='SmaAD', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = GmoSmaaffiScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
