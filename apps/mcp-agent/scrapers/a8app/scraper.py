"""
A8app (SeedApp) スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
"""
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class A8appScraper(BaseScraper):
    """A8app (SeedApp) スクレイパー"""

    LOGIN_URL = 'https://admin.seedapp.jp/'
    DAILY_REPORT_URL = 'https://admin.seedapp.jp/mo/reports/daily_reports/clear'
    MONTHLY_REPORT_URL = 'https://admin.seedapp.jp/mo/reports/monthly_reports/clear'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL, timeout=60000)
        page.wait_for_timeout(2000)

        print("Filling login form...")
        page.fill('input[name="user[email]"]', self.username)
        page.fill('input[name="user[password]"]', self.password)

        print("Clicking login button...")
        page.locator('input[type="submit"], button[type="submit"]').first.click()
        page.wait_for_timeout(5000)

        # ログイン成功判定
        print("Checking login success...")
        if 'mo' in page.url or page.locator("text=ログアウト").count() > 0 or page.locator("text=ダッシュボード").count() > 0:
            print("Login successful")
            return True

        print("Login failed")
        return False

    def _parse_amount(self, text: str) -> int:
        """金額文字列を整数に変換"""
        cleaned = re.sub(r'[^\d]', '', str(text))
        return int(cleaned) if cleaned else 0

    def _extract_table_data(self, page: Page) -> List[Dict[str, Any]]:
        """テーブルからデータを抽出

        テーブル構造:
        - 日付 (index 0)
        - クリック件数 (index 1)
        - 成果件数 (index 2)
        - 成果報酬額（税抜）(index 3)
        - CVR (index 4)
        - CPC (index 5)
        """
        records = []

        rows = page.locator("table tr").all()
        print(f"Found {len(rows)} table rows")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 4:
                continue

            date_text = cells[0].inner_text().strip()

            # Skip header or summary rows
            if '合計' in date_text or '日付' in date_text:
                continue

            # 日付の解析 (2025/11/02 format)
            match = re.match(r'(\d{4})[年/](\d{1,2})[月/](\d{1,2})', date_text)
            if not match:
                continue

            y, m, d = match.groups()
            date_str = f"{y}-{int(m):02d}-{int(d):02d}"

            try:
                clicks = self._parse_amount(cells[1].inner_text())  # クリック件数
                acquisitions = self._parse_amount(cells[2].inner_text())  # 成果件数
                amount = self._parse_amount(cells[3].inner_text())  # 成果報酬額（税抜）

                records.append({
                    'date': date_str,
                    'amount': amount,  # Required by BaseScraper
                    'clicks': clicks,
                    'acquisitions': acquisitions,
                })
            except (IndexError, ValueError) as e:
                print(f"Error parsing row for {date_str}: {e}")
                continue

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        print("Navigating to daily report...")
        page.goto(self.DAILY_REPORT_URL, timeout=60000)
        page.wait_for_timeout(3000)

        print(f"URL: {page.url}")
        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def _extract_monthly_table_data(self, page: Page) -> List[Dict[str, Any]]:
        """月次テーブルからデータを抽出

        テーブル構造:
        - 年月 (index 0) - "2025年1月" format
        - クリック件数 (index 1)
        - 成果件数 (index 2)
        - 成果報酬額（税抜）(index 3)
        - CVR (index 4)
        - CPC (index 5)
        """
        records = []

        rows = page.locator("table tr").all()
        print(f"Found {len(rows)} table rows")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 4:
                continue

            date_text = cells[0].inner_text().strip()

            # Skip header or summary rows
            if '合計' in date_text or '年月' in date_text:
                continue

            # 年月の解析 (2025年1月 format)
            match = re.match(r'(\d{4})年(\d{1,2})月', date_text)
            if not match:
                continue

            y, m = match.groups()
            # 月次データは月の初日として保存
            date_str = f"{y}-{int(m):02d}-01"

            try:
                clicks = self._parse_amount(cells[1].inner_text())  # クリック件数
                acquisitions = self._parse_amount(cells[2].inner_text())  # 成果件数
                amount = self._parse_amount(cells[3].inner_text())  # 成果報酬額（税抜）

                records.append({
                    'date': date_str,
                    'amount': amount,  # Required by BaseScraper
                    'clicks': clicks,
                    'acquisitions': acquisitions,
                })
            except (IndexError, ValueError) as e:
                print(f"Error parsing row for {date_str}: {e}")
                continue

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        print("Navigating to monthly report...")
        page.goto(self.MONTHLY_REPORT_URL, timeout=60000)
        page.wait_for_timeout(3000)

        print(f"URL: {page.url}")
        print("Extracting data from table...")
        records = self._extract_monthly_table_data(page)

        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="A8app Scraper")
    parser.add_argument('--asp', default='SeedApp（ビギナーズ）', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = A8appScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
