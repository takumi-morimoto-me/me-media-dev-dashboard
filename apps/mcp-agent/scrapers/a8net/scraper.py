"""
A8.net スクレイパー（新形式）

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


class A8netScraper(BaseScraper):
    """A8.net スクレイパー"""

    LOGIN_URL = 'https://www.a8.net/'
    REPORT_URL = 'https://www.a8.net/as/report/'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL)
        page.wait_for_timeout(2000)

        print("Filling login form...")
        page.fill("input[name='login'], input[type='text']:first-of-type", self.username)
        page.fill("input[name='passwd'], input[type='password']", self.password)

        print("Clicking login button...")
        page.click("input[type='submit'][value*='ログイン'], button:has-text('ログイン')")
        page.wait_for_timeout(3000)

        # ログイン成功判定
        if page.locator("text=マイページ").count() > 0 or page.locator("text=レポート").count() > 0:
            return True

        return False

    def _parse_amount(self, text: str) -> int:
        """金額文字列を整数に変換"""
        cleaned = re.sub(r'[^\d]', '', str(text))
        return int(cleaned) if cleaned else 0

    def _extract_table_data(self, page: Page) -> List[Dict[str, Any]]:
        """テーブルからデータを抽出"""
        records = []

        # テーブル行を取得
        rows = page.locator("table tbody tr, table tr").all()
        print(f"Found {len(rows)} table rows")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 2:
                continue

            # 最初のセルが日付、最後のセルが金額と仮定
            date_text = cells[0].inner_text().strip()
            amount_text = cells[-1].inner_text().strip()

            # 合計行をスキップ
            if '合計' in date_text or '計' in date_text:
                continue

            # 日付の解析
            match = re.match(r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})', date_text)
            if match:
                y, m, d = match.groups()
                date_str = f"{y}-{int(m):02d}-{int(d):02d}"
                amount = self._parse_amount(amount_text)

                if amount > 0:
                    records.append({
                        'date': date_str,
                        'amount': amount,
                    })
                    print(f"  {date_str}: ¥{amount:,}")

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        print("Navigating to reports...")
        page.click("text=レポート")
        page.wait_for_timeout(1000)

        page.click("text=成果報酬")
        page.wait_for_timeout(2000)

        page.click("text=日別")
        page.wait_for_timeout(2000)

        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        print("Navigating to reports...")
        page.click("text=レポート")
        page.wait_for_timeout(1000)

        page.click("text=成果報酬")
        page.wait_for_timeout(2000)

        page.click("text=月別")
        page.wait_for_timeout(2000)

        print("Extracting data from table...")
        records = []

        # テーブル行を取得
        rows = page.locator("table tbody tr, table tr").all()

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 2:
                continue

            month_text = cells[0].inner_text().strip()
            amount_text = cells[-1].inner_text().strip()

            if '合計' in month_text:
                continue

            # 月の解析
            match = re.match(r'(\d{4})[年/-](\d{1,2})', month_text)
            if match:
                y, m = match.groups()
                date_str = f"{y}-{int(m):02d}-01"
                amount = self._parse_amount(amount_text)

                if amount > 0:
                    records.append({
                        'date': date_str,
                        'amount': amount,
                    })

        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="A8.net Scraper")
    parser.add_argument('--asp', default='A8.net', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = A8netScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
